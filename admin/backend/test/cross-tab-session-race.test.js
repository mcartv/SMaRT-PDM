'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..', '..');
const authStoragePath = path.join(root, 'admin', 'frontend', 'src', 'utils', 'authStorage.js');

function waitForEvents() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createBus() {
  return {
    channels: new Map(),
    localValues: new Map(),
    windows: new Map(),
  };
}

function createWindow(tabId, bus, pathname) {
  const listeners = new Map();
  const location = {
    pathname,
    replacements: [],
    reloadCount: 0,
    replace(next) {
      this.replacements.push(next);
      this.pathname = next;
    },
    reload() {
      this.reloadCount += 1;
    },
  };

  const window = {
    location,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) {
        handler(event);
      }
      return true;
    },
    __dispatchStorage(event) {
      for (const handler of listeners.get('storage') || []) {
        handler(event);
      }
    },
  };

  bus.windows.set(tabId, window);
  return window;
}

function createSessionStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

function createLocalStorage(tabId, bus) {
  function notify(key, oldValue, newValue) {
    for (const [otherId, targetWindow] of bus.windows.entries()) {
      if (otherId === tabId) continue;
      queueMicrotask(() => {
        targetWindow.__dispatchStorage({
          key,
          oldValue,
          newValue,
          storageArea: null,
        });
      });
    }
  }

  return {
    getItem(key) {
      return bus.localValues.has(key) ? bus.localValues.get(key) : null;
    },
    setItem(key, value) {
      const oldValue = bus.localValues.has(key) ? bus.localValues.get(key) : null;
      const next = String(value);
      bus.localValues.set(key, next);
      notify(key, oldValue, next);
    },
    removeItem(key) {
      const oldValue = bus.localValues.has(key) ? bus.localValues.get(key) : null;
      bus.localValues.delete(key);
      if (oldValue !== null) notify(key, oldValue, null);
    },
    clear() {
      for (const key of [...bus.localValues.keys()]) {
        this.removeItem(key);
      }
    },
  };
}

function createBroadcastChannelClass(bus) {
  return class MockBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      this.closed = false;
      if (!bus.channels.has(name)) bus.channels.set(name, new Set());
      bus.channels.get(name).add(this);
    }

    postMessage(payload) {
      if (this.closed) throw new Error('channel closed');
      const peers = [...(bus.channels.get(this.name) || [])];
      for (const peer of peers) {
        if (peer === this || peer.closed) continue;
        const copy = JSON.parse(JSON.stringify(payload));
        queueMicrotask(() => {
          if (!peer.closed) peer.onmessage?.({ data: copy });
        });
      }
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      bus.channels.get(this.name)?.delete(this);
    }
  };
}

function loadAuthStorage({
  tabId,
  bus,
  pathname = '/admin/dashboard',
  broadcastChannel = true,
  fetchImpl = async () => ({ status: 200 }),
}) {
  const window = createWindow(tabId, bus, pathname);
  const sessionStorage = createSessionStorage();
  const localStorage = createLocalStorage(tabId, bus);
  let uuidCounter = 0;

  window.fetch = fetchImpl;

  class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  const context = vm.createContext({
    console,
    window,
    localStorage,
    sessionStorage,
    CustomEvent,
    Request: undefined,
    BroadcastChannel: broadcastChannel
      ? createBroadcastChannelClass(bus)
      : undefined,
    crypto: {
      randomUUID() {
        uuidCounter += 1;
        return `${tabId}-uuid-${uuidCounter}`;
      },
    },
    atob(value) {
      return Buffer.from(value, 'base64').toString('binary');
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });

  let source = fs.readFileSync(authStoragePath, 'utf8');
  source = source.replace(/\bexport\s+(?=(?:async\s+)?function\b|const\b)/g, '');
  source += `
globalThis.__authStorageTestApi = {
  PAGE_INSTANCE_ID,
  savePortalSession,
  getStoredPortalSession,
  clearPortalSession,
  invalidateStoredPortalSession,
  hydratePortalSessionFromPeerTabs,
  installPortalSessionSync,
  installSessionInvalidationFetchGuard,
  broadcastPortalSessionCleared,
};`;

  vm.runInContext(source, context, { filename: authStoragePath });

  return {
    api: context.__authStorageTestApi,
    context,
    window,
    sessionStorage,
    localStorage,
  };
}

test('peer tab hydrates the same shared browser session without creating another login', async () => {
  const bus = createBus();
  const tabA = loadAuthStorage({ tabId: 'A', bus });

  const saved = tabA.api.savePortalSession({
    portalName: 'admin',
    token: 'token-A',
    user: { role: 'admin', user_id: 'user-1' },
    stayLoggedIn: false,
  });
  tabA.api.installPortalSessionSync();

  const tabB = loadAuthStorage({ tabId: 'B', bus });
  const hydrated = await tabB.api.hydratePortalSessionFromPeerTabs({
    portalName: 'admin',
    timeoutMs: 100,
  });

  assert.equal(hydrated.token, 'token-A');
  assert.equal(hydrated.browserSessionId, saved.browserSessionId);
  assert.equal(tabA.api.getStoredPortalSession('admin').token, 'token-A');
  assert.equal(tabB.api.getStoredPortalSession('admin').token, 'token-A');
});

test('stale invalidation and stale clear event cannot erase a newer shared session', async () => {
  const bus = createBus();
  const tabA = loadAuthStorage({ tabId: 'A', bus });
  const oldSession = tabA.api.savePortalSession({
    portalName: 'admin',
    token: 'token-A',
    user: { role: 'admin', user_id: 'user-1' },
    stayLoggedIn: false,
  });
  tabA.api.installPortalSessionSync();

  const tabB = loadAuthStorage({ tabId: 'B', bus });
  await tabB.api.hydratePortalSessionFromPeerTabs({
    portalName: 'admin',
    timeoutMs: 100,
  });
  tabB.api.installPortalSessionSync();

  const newSession = tabB.api.savePortalSession({
    portalName: 'admin',
    token: 'token-B',
    user: { role: 'admin', user_id: 'user-1' },
    stayLoggedIn: false,
  });
  await waitForEvents();

  assert.equal(tabA.api.getStoredPortalSession('admin').token, 'token-B');
  assert.equal(tabB.api.getStoredPortalSession('admin').token, 'token-B');

  const staleResult = tabA.api.invalidateStoredPortalSession({
    portalName: 'admin',
    expectedToken: oldSession.token,
    expectedBrowserSessionId: oldSession.browserSessionId,
    code: 'ADMIN_SESSION_INACTIVE',
    message: 'Old session ended.',
  });

  assert.equal(staleResult.ignored, true);
  assert.equal(tabA.api.getStoredPortalSession('admin').token, 'token-B');

  tabA.api.broadcastPortalSessionCleared('admin', oldSession);
  await waitForEvents();

  assert.equal(tabA.api.getStoredPortalSession('admin').token, 'token-B');
  assert.equal(tabB.api.getStoredPortalSession('admin').token, 'token-B');
  assert.equal(
    tabB.api.getStoredPortalSession('admin').browserSessionId,
    newSession.browserSessionId
  );
});

test('logout of the current shared session clears peer tabs', async () => {
  const bus = createBus();
  const tabA = loadAuthStorage({ tabId: 'A', bus });
  tabA.api.savePortalSession({
    portalName: 'admin',
    token: 'token-A',
    user: { role: 'admin', user_id: 'user-1' },
    stayLoggedIn: false,
  });
  tabA.api.installPortalSessionSync();

  const tabB = loadAuthStorage({ tabId: 'B', bus });
  await tabB.api.hydratePortalSessionFromPeerTabs({
    portalName: 'admin',
    timeoutMs: 100,
  });
  tabB.api.installPortalSessionSync();

  const active = tabA.api.getStoredPortalSession('admin');
  tabA.api.broadcastPortalSessionCleared('admin', active);
  tabA.api.clearPortalSession('admin', {
    expectedToken: active.token,
    expectedBrowserSessionId: active.browserSessionId,
  });
  await waitForEvents();

  assert.equal(tabA.api.getStoredPortalSession('admin'), null);
  assert.equal(tabB.api.getStoredPortalSession('admin'), null);
  assert.deepEqual(tabB.window.location.replacements, ['/login']);
});

test('storage-event fallback hydrates the same session when BroadcastChannel is unavailable', async () => {
  const bus = createBus();
  const tabA = loadAuthStorage({
    tabId: 'A',
    bus,
    broadcastChannel: false,
  });
  tabA.api.savePortalSession({
    portalName: 'sdo',
    token: 'sdo-token-A',
    user: { role: 'sdo', user_id: 'user-2' },
    stayLoggedIn: false,
  });
  tabA.api.installPortalSessionSync();

  const tabB = loadAuthStorage({
    tabId: 'B',
    bus,
    pathname: '/sdo/dashboard',
    broadcastChannel: false,
  });
  const hydrated = await tabB.api.hydratePortalSessionFromPeerTabs({
    portalName: 'sdo',
    timeoutMs: 100,
  });

  assert.equal(hydrated.token, 'sdo-token-A');
  assert.equal(
    hydrated.browserSessionId,
    tabA.api.getStoredPortalSession('sdo').browserSessionId
  );
});

test('cross-tab login stores the session on a public page without hijacking its route', async () => {
  const bus = createBus();
  const publicTab = loadAuthStorage({
    tabId: 'P',
    bus,
    pathname: '/privacy',
  });
  publicTab.api.installPortalSessionSync();

  const loginTab = loadAuthStorage({
    tabId: 'L',
    bus,
    pathname: '/login',
  });
  loginTab.api.installPortalSessionSync();
  loginTab.api.savePortalSession({
    portalName: 'admin',
    token: 'token-A',
    user: { role: 'admin', user_id: 'user-1' },
    stayLoggedIn: false,
  });

  await waitForEvents();

  assert.equal(publicTab.api.getStoredPortalSession('admin').token, 'token-A');
  assert.equal(publicTab.window.location.pathname, '/privacy');
  assert.deepEqual(publicTab.window.location.replacements, []);
});

test('a delayed 401 from an old request cannot invalidate the replacement token', async () => {
  const bus = createBus();
  let resolveFetch;

  const tab = loadAuthStorage({
    tabId: 'A',
    bus,
    fetchImpl: () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
  });

  tab.api.savePortalSession({
    portalName: 'admin',
    token: 'token-A',
    user: { role: 'admin', user_id: 'user-1' },
    stayLoggedIn: false,
  });
  tab.api.installSessionInvalidationFetchGuard();

  const pending = tab.window.fetch('/api/example', {
    headers: {
      Authorization: 'Bearer token-A',
    },
  });

  tab.api.savePortalSession({
    portalName: 'admin',
    token: 'token-B',
    user: { role: 'admin', user_id: 'user-1' },
    stayLoggedIn: false,
  });

  resolveFetch({
    status: 401,
    clone() {
      return {
        async json() {
          return {
            code: 'ADMIN_SESSION_INACTIVE',
            message: 'Old session is inactive.',
          };
        },
      };
    },
  });

  await pending;

  assert.equal(tab.api.getStoredPortalSession('admin').token, 'token-B');
  assert.deepEqual(tab.window.location.replacements, []);
});


test('stale tab invalidation cannot delete a newer remembered session from localStorage', () => {
  const bus = createBus();
  const staleTab = loadAuthStorage({ tabId: 'A', bus });
  const newerTab = loadAuthStorage({ tabId: 'B', bus });

  const oldSession = staleTab.api.savePortalSession({
    portalName: 'admin',
    token: 'token-A',
    user: { role: 'admin', user_id: 'user-1' },
    stayLoggedIn: false,
  });

  newerTab.api.savePortalSession({
    portalName: 'admin',
    token: 'token-B',
    user: { role: 'admin', user_id: 'user-1' },
    stayLoggedIn: true,
  });

  const result = staleTab.api.invalidateStoredPortalSession({
    portalName: 'admin',
    expectedToken: oldSession.token,
    expectedBrowserSessionId: oldSession.browserSessionId,
    code: 'ADMIN_SESSION_INACTIVE',
    message: 'Old session ended.',
  });

  assert.equal(result.ignored, true);
  assert.equal(result.reason, 'replacement-session-present');
  assert.equal(staleTab.localStorage.getItem('adminToken'), 'token-B');
  assert.equal(staleTab.api.getStoredPortalSession('admin').token, 'token-B');
  assert.deepEqual(staleTab.window.location.replacements, []);
});
