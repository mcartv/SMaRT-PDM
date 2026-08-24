#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);

  while (true) {
    const required = [
      path.join(dir, 'mobile', 'backend', 'src', 'config', 'socket.js'),
      path.join(dir, 'mobile', 'backend', 'src', 'services', 'realtimeBridgeService.js'),
      path.join(dir, 'mobile', 'backend', 'src', 'services', 'adminRealtimeRelayService.js'),
      path.join(dir, 'mobile', 'backend', 'src', 'routes', 'internalRealtimeRoutes.js'),
      path.join(dir, 'admin', 'backend', 'services', 'studentRealtimeRelayService.js'),
      path.join(dir, 'admin', 'backend', 'routes', 'internalRealtimeRoutes.js'),
      path.join(dir, 'admin', 'backend', 'controllers', 'messageController.js'),
      path.join(dir, 'mobile', 'frontend', 'test', 'messaging_provider_test.dart'),
    ];

    if (required.every(fs.existsSync)) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Could not find the current SMaRT-PDM repository root. Run this from D:\\projects\\SMaRT-PDM.'
  );
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

function restoreEol(text, crlf) {
  return crlf ? text.replace(/\n/g, '\r\n') : text;
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;

  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}.`);
  }
}

function replaceOnce(text, oldText, newText, label) {
  if (text.includes(newText)) return text;

  const count = text.split(oldText).length - 1;

  if (count !== 1) {
    throw new Error(
      `Preflight failed for ${label}: expected exactly one match, found ${count}. No project files were written.`
    );
  }

  return text.replace(oldText, newText);
}

const repo = findRepoRoot(process.cwd());
const mobileBackend = path.join(repo, 'mobile', 'backend');
const adminBackend = path.join(repo, 'admin', 'backend');
const mobileFrontend = path.join(repo, 'mobile', 'frontend');

const files = {
  mobileSocket: path.join(
    mobileBackend,
    'src',
    'config',
    'socket.js'
  ),
  mobileBridge: path.join(
    mobileBackend,
    'src',
    'services',
    'realtimeBridgeService.js'
  ),
  mobileAdminRelay: path.join(
    mobileBackend,
    'src',
    'services',
    'adminRealtimeRelayService.js'
  ),
  mobileInternalRoutes: path.join(
    mobileBackend,
    'src',
    'routes',
    'internalRealtimeRoutes.js'
  ),
  adminStudentRelay: path.join(
    adminBackend,
    'services',
    'studentRealtimeRelayService.js'
  ),
  adminInternalRoutes: path.join(
    adminBackend,
    'routes',
    'internalRealtimeRoutes.js'
  ),
  adminEnvExample: path.join(
    adminBackend,
    '.env.example'
  ),
  mobileTest: path.join(
    mobileBackend,
    'test',
    'cross-environment-messaging-realtime.test.js'
  ),
  adminTest: path.join(
    adminBackend,
    'test',
    'cross-environment-messaging-realtime.test.js'
  ),
};

const originals = {};
const crlf = {};

for (const key of [
  'mobileSocket',
  'mobileBridge',
  'mobileAdminRelay',
  'mobileInternalRoutes',
  'adminStudentRelay',
  'adminInternalRoutes',
]) {
  originals[key] = fs.readFileSync(files[key], 'utf8');
  crlf[key] = originals[key].includes('\r\n');
}

if (fs.existsSync(files.adminEnvExample)) {
  originals.adminEnvExample = fs.readFileSync(files.adminEnvExample, 'utf8');
  crlf.adminEnvExample = originals.adminEnvExample.includes('\r\n');
} else {
  originals.adminEnvExample = '';
  crlf.adminEnvExample = false;
}

/* ========================================================================== */
/* PRE-AUDIT                                                                  */
/* ========================================================================== */

const requiredMarkers = [
  [
    originals.mobileSocket,
    "const { Server } = require('socket.io');",
    'mobile Socket.IO config',
  ],
  [
    originals.mobileBridge,
    "table: 'messages'",
    'mobile Supabase messages realtime subscription',
  ],
  [
    originals.mobileAdminRelay,
    'relayMessageCreated',
    'mobile -> admin realtime relay',
  ],
  [
    originals.mobileInternalRoutes,
    "router.post('/message-event'",
    'mobile internal realtime receiver',
  ],
  [
    originals.adminStudentRelay,
    'relayMessageEvent',
    'admin -> mobile realtime relay',
  ],
  [
    originals.adminInternalRoutes,
    "router.post('/message-event'",
    'admin internal realtime receiver',
  ],
];

for (const [source, marker, label] of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(
      `Preflight failed: ${label} marker not found. No project files were written.`
    );
  }
}

/* ========================================================================== */
/* 1. MOBILE SOCKET.IO CORS                                                    */
/* ========================================================================== */

/*
 * Flutter Web uses a dynamic localhost port by default. The old Socket.IO CORS
 * array allowed only a few hard-coded ports, so HTTP messaging could work while
 * realtime Socket.IO was silently blocked.
 */
const newMobileSocket = `const { Server } = require('socket.io');
const { authenticateSocket } = require('../middleware/authMiddleware');

const DEFAULT_SOCKET_ORIGIN_SUFFIXES = [
    '.vercel.app',
    '.onrender.com',
];

function normalizeOrigin(value) {
    return String(value || '').trim().replace(/\\/+$/, '');
}

function configuredSocketOrigins() {
    return new Set(
        String(
            process.env.MOBILE_SOCKET_ORIGINS ||
            process.env.FRONTEND_ORIGINS ||
            ''
        )
            .split(',')
            .map(normalizeOrigin)
            .filter(Boolean)
    );
}

function configuredSocketOriginSuffixes() {
    return [
        ...new Set([
            ...DEFAULT_SOCKET_ORIGIN_SUFFIXES,
            ...String(process.env.MOBILE_SOCKET_ORIGIN_SUFFIXES || '')
                .split(',')
                .map((value) => value.trim().toLowerCase())
                .filter(Boolean),
        ]),
    ];
}

function isPrivateIpv4Host(hostname) {
    const parts = hostname.split('.').map((value) => Number(value));

    if (
        parts.length !== 4 ||
        parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
    ) {
        return false;
    }

    if (parts[0] === 10) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    return false;
}

function isAllowedSocketOrigin(origin) {
    // Native Flutter / server-to-server Socket.IO clients commonly have no
    // browser Origin header.
    if (!origin) return true;

    const normalizedOrigin = normalizeOrigin(origin);

    if (configuredSocketOrigins().has(normalizedOrigin)) {
        return true;
    }

    try {
        const parsed = new URL(normalizedOrigin);
        const hostname = parsed.hostname.toLowerCase();

        if (
            parsed.protocol !== 'http:' &&
            parsed.protocol !== 'https:'
        ) {
            return false;
        }

        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname === '::1' ||
            isPrivateIpv4Host(hostname)
        ) {
            // Any local/private port is valid. This is required for
            // flutter run -d edge, which commonly chooses a random port.
            return true;
        }

        if (
            configuredSocketOriginSuffixes().some(
                (suffix) => hostname.endsWith(suffix)
            )
        ) {
            return true;
        }

        return false;
    } catch (_) {
        return false;
    }
}

function configureSocket(server) {
    const io = new Server(server, {
        cors: {
            origin(origin, callback) {
                if (isAllowedSocketOrigin(origin)) {
                    return callback(null, true);
                }

                console.error(
                    '[Socket.IO] CORS blocked origin:',
                    origin
                );

                return callback(
                    new Error(\`Socket.IO CORS blocked origin: \${origin}\`)
                );
            },
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    io.engine.on('connection_error', (err) => {
        console.log('Socket.IO connection error:', {
            message: err.message,
            code: err.code,
            context: err.context,
        });
    });

    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        console.log('Socket connected:', socket.id);

        const userId =
            socket.user?.user_id ||
            socket.user?.userId ||
            socket.user?.id ||
            null;

        if (userId) {
            socket.join(\`user:\${userId}\`);
            console.log(\`Socket joined user room: user:\${userId}\`);
        }

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', socket.id, reason);
        });
    });

    return io;
}

module.exports = {
    configureSocket,
    isAllowedSocketOrigin,
};
`;

/* ========================================================================== */
/* 2. MOBILE SUPABASE REALTIME BRIDGE RECOVERY                                */
/* ========================================================================== */

let mobileBridge = normalize(originals.mobileBridge);

if (!mobileBridge.includes('const REALTIME_BRIDGE_RETRY_MS = 3000;')) {
  mobileBridge = replaceOnce(
    mobileBridge,
    `let realtimeChannel = null;
`,
    `let realtimeChannel = null;
let realtimeRetryTimer = null;
const REALTIME_BRIDGE_RETRY_MS = 3000;

function clearRealtimeBridgeRetry() {
  if (!realtimeRetryTimer) return;

  clearTimeout(realtimeRetryTimer);
  realtimeRetryTimer = null;
}

function scheduleRealtimeBridgeRestart({ io, supabase, reason }) {
  if (realtimeRetryTimer) return;

  console.warn('[Realtime Bridge] scheduling reconnect:', {
    reason: String(reason || 'unknown'),
    retry_in_ms: REALTIME_BRIDGE_RETRY_MS,
  });

  realtimeRetryTimer = setTimeout(() => {
    realtimeRetryTimer = null;

    try {
      configureRealtimeBridge({ io, supabase });
    } catch (error) {
      console.error(
        '[Realtime Bridge] reconnect failed:',
        error?.message || error
      );

      scheduleRealtimeBridgeRestart({
        io,
        supabase,
        reason: error?.message || 'restart_failed',
      });
    }
  }, REALTIME_BRIDGE_RETRY_MS);

  if (typeof realtimeRetryTimer.unref === 'function') {
    realtimeRetryTimer.unref();
  }
}

`,
    'mobile realtime retry state'
  );
}

const oldSubscribe = `    .subscribe((status, error) => {
      if (error) {
        console.error('[Realtime Bridge] subscription error:', error);
        return;
      }

      console.log('Realtime bridge status:', status);
    });`;

const newSubscribe = `    .subscribe((status, error) => {
      const normalizedStatus = String(status || '').trim().toUpperCase();

      if (error) {
        console.error('[Realtime Bridge] subscription error:', error);

        scheduleRealtimeBridgeRestart({
          io,
          supabase,
          reason:
            error?.message ||
            normalizedStatus ||
            'subscription_error',
        });
        return;
      }

      console.log('Realtime bridge status:', normalizedStatus || status);

      if (normalizedStatus === 'SUBSCRIBED') {
        clearRealtimeBridgeRetry();
        return;
      }

      if (
        normalizedStatus === 'CHANNEL_ERROR' ||
        normalizedStatus === 'TIMED_OUT'
      ) {
        scheduleRealtimeBridgeRestart({
          io,
          supabase,
          reason: normalizedStatus,
        });
      }
    });`;

mobileBridge = replaceOnce(
  mobileBridge,
  oldSubscribe,
  newSubscribe,
  'mobile realtime subscription recovery'
);

/* ========================================================================== */
/* 3. MOBILE -> ADMIN MULTI-TARGET RELAY                                       */
/* ========================================================================== */

const newMobileAdminRelay = `const DEFAULT_LOCAL_ADMIN_BACKEND_URL =
    'http://127.0.0.1:5000';
const DEFAULT_REMOTE_ADMIN_BACKEND_URL =
    'https://smart-pdm.onrender.com';

function cleanUrl(value) {
    return String(value || '').trim().replace(/\\/+$/, '');
}

function uniqueUrls(values = []) {
    return [
        ...new Set(
            values
                .flatMap((value) => String(value || '').split(','))
                .map(cleanUrl)
                .filter(Boolean)
        ),
    ];
}

function getInternalRealtimeSecret() {
    return String(
        process.env.INTERNAL_REALTIME_SECRET ||
        process.env.INTERNAL_NOTIFICATION_SECRET ||
        ''
    ).trim();
}

function getAdminBackendUrls() {
    const configured = uniqueUrls([
        process.env.ADMIN_BACKEND_URLS,
        process.env.ADMIN_BACKEND_URL,
    ]);

    const defaults = [
        DEFAULT_REMOTE_ADMIN_BACKEND_URL,
    ];

    if (process.env.NODE_ENV !== 'production') {
        defaults.unshift(DEFAULT_LOCAL_ADMIN_BACKEND_URL);
    }

    return uniqueUrls([...configured, ...defaults]);
}

async function postOneAdminBackend(baseUrl, path, payload, secret) {
    const url = \`\${baseUrl}\${path}\`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-realtime-secret': secret,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.warn('[Admin Realtime Relay] target rejected:', {
                url,
                status: response.status,
                data,
            });

            return {
                success: false,
                url,
                status: response.status,
                data,
            };
        }

        console.log('[Admin Realtime Relay] delivered:', {
            url,
            event:
                payload.event ||
                payload.event_name ||
                'message-created',
            message_id:
                payload.message_id ||
                payload.messageId ||
                payload.payload?.message_id ||
                payload.payload?.messageId ||
                null,
        });

        return {
            success: true,
            url,
            data,
        };
    } catch (error) {
        console.warn('[Admin Realtime Relay] target unavailable:', {
            url,
            error: error?.name === 'AbortError'
                ? 'timeout'
                : error?.message || String(error),
        });

        return {
            success: false,
            url,
            error:
                error?.name === 'AbortError'
                    ? 'timeout'
                    : error?.message || String(error),
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function postToAdminBackend(path, payload = {}) {
    const secret = getInternalRealtimeSecret();
    const targets = getAdminBackendUrls();

    if (!secret) {
        console.warn(
            '[Admin Realtime Relay] skipped direct relay: no shared internal realtime secret. Supabase message bridge remains active.'
        );

        return {
            success: false,
            skipped: true,
            reason: 'missing_secret',
            targets,
        };
    }

    const results = await Promise.all(
        targets.map((baseUrl) =>
            postOneAdminBackend(baseUrl, path, payload, secret)
        )
    );

    return {
        success: results.some((result) => result.success),
        results,
    };
}

async function relayRoUpdated(payload = {}) {
    return postToAdminBackend('/api/internal/realtime/ro-updated', {
        source: 'mobile-backend',
        updated_at: new Date().toISOString(),
        ...payload,
    });
}

async function relayMessageCreated(payload = {}) {
    return postToAdminBackend(
        '/api/internal/realtime/message-created',
        payload
    );
}

async function relayMessageEvent(event, payload = {}, targetUserIds = []) {
    return postToAdminBackend('/api/internal/realtime/message-event', {
        event,
        payload,
        targetUserIds,
    });
}

async function relayNotificationCreated(payload = {}) {
    return postToAdminBackend(
        '/api/internal/realtime/notification-created',
        payload
    );
}

module.exports = {
    relayRoUpdated,
    relayMessageCreated,
    relayMessageEvent,
    relayNotificationCreated,
    getAdminBackendUrls,
    getInternalRealtimeSecret,
};
`;

/* ========================================================================== */
/* 4. ADMIN -> MOBILE MULTI-TARGET RELAY                                       */
/* ========================================================================== */

const newAdminStudentRelay = `const DEFAULT_LOCAL_STUDENT_BACKEND_URL =
  'http://127.0.0.1:3000';
const DEFAULT_REMOTE_STUDENT_BACKEND_URL =
  'https://smart-pdm-3tbv.onrender.com';

function cleanUrl(value) {
  return String(value || '').trim().replace(/\\/+$/, '');
}

function uniqueUrls(values = []) {
  return [
    ...new Set(
      values
        .flatMap((value) => String(value || '').split(','))
        .map(cleanUrl)
        .filter(Boolean)
    ),
  ];
}

function getInternalRealtimeSecret() {
  return String(
    process.env.INTERNAL_REALTIME_SECRET ||
    process.env.INTERNAL_NOTIFICATION_SECRET ||
    ''
  ).trim();
}

function getStudentBackendUrls() {
  const configured = uniqueUrls([
    process.env.STUDENT_BACKEND_BASE_URLS,
    process.env.STUDENT_BACKEND_BASE_URL,
  ]);

  const defaults = [
    DEFAULT_REMOTE_STUDENT_BACKEND_URL,
  ];

  if (process.env.NODE_ENV !== 'production') {
    defaults.unshift(DEFAULT_LOCAL_STUDENT_BACKEND_URL);
  }

  return uniqueUrls([...configured, ...defaults]);
}

async function postOneStudentBackend(
  baseUrl,
  path,
  body,
  secret
) {
  const url = \`\${baseUrl}\${path}\`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-realtime-secret': secret,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('[Student Realtime Relay] target rejected:', {
        url,
        event: body.event,
        status: response.status,
        data,
      });

      return {
        success: false,
        url,
        status: response.status,
        data,
      };
    }

    console.log('[Student Realtime Relay] delivered:', {
      url,
      event: body.event,
      message_id:
        body.payload?.message_id ||
        body.payload?.messageId ||
        null,
    });

    return {
      success: true,
      url,
      data,
    };
  } catch (error) {
    console.warn('[Student Realtime Relay] target unavailable:', {
      url,
      event: body.event,
      error:
        error?.name === 'AbortError'
          ? 'timeout'
          : error?.message || String(error),
    });

    return {
      success: false,
      url,
      error:
        error?.name === 'AbortError'
          ? 'timeout'
          : error?.message || String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function relayMessageEvent({
  event,
  payload = {},
  targetUserIds = [],
}) {
  const secret = getInternalRealtimeSecret();
  const targets = getStudentBackendUrls();

  if (!secret) {
    console.warn(
      '[Student Realtime Relay] skipped direct relay: no shared internal realtime secret. Supabase message bridge remains active.'
    );

    return {
      success: false,
      skipped: true,
      reason: 'missing_secret',
      targets,
    };
  }

  const body = {
    event,
    payload,
    targetUserIds,
  };

  const results = await Promise.all(
    targets.map((baseUrl) =>
      postOneStudentBackend(
        baseUrl,
        '/api/internal/realtime/message-event',
        body,
        secret
      )
    )
  );

  return {
    success: results.some((result) => result.success),
    results,
  };
}

module.exports = {
  relayMessageEvent,
  getStudentBackendUrls,
  getInternalRealtimeSecret,
};
`;

/* ========================================================================== */
/* 5. INTERNAL SECRET COMPATIBILITY                                            */
/* ========================================================================== */

let mobileInternalRoutes = normalize(originals.mobileInternalRoutes);
let adminInternalRoutes = normalize(originals.adminInternalRoutes);

mobileInternalRoutes = mobileInternalRoutes.replace(
  `const expected = cleanText(process.env.INTERNAL_REALTIME_SECRET);`,
  `const expected = cleanText(
    process.env.INTERNAL_REALTIME_SECRET ||
    process.env.INTERNAL_NOTIFICATION_SECRET
  );`
);

adminInternalRoutes = adminInternalRoutes.replace(
  `const expected = String(process.env.INTERNAL_REALTIME_SECRET || '').trim();`,
  `const expected = String(
        process.env.INTERNAL_REALTIME_SECRET ||
        process.env.INTERNAL_NOTIFICATION_SECRET ||
        ''
    ).trim();`
);

if (
  !mobileInternalRoutes.includes(
    'process.env.INTERNAL_NOTIFICATION_SECRET'
  )
) {
  throw new Error(
    'Preflight failed: unable to add mobile internal-secret compatibility. No project files were written.'
  );
}

if (
  !adminInternalRoutes.includes(
    'process.env.INTERNAL_NOTIFICATION_SECRET'
  )
) {
  throw new Error(
    'Preflight failed: unable to add admin internal-secret compatibility. No project files were written.'
  );
}

/* ========================================================================== */
/* 6. ENV EXAMPLE DOCUMENTATION                                                */
/* ========================================================================== */

let adminEnvExample = normalize(originals.adminEnvExample);

if (
  adminEnvExample &&
  !adminEnvExample.includes('INTERNAL_REALTIME_SECRET=')
) {
  if (
    adminEnvExample.includes(
      'INTERNAL_NOTIFICATION_SECRET=replace-with-the-same-shared-secret'
    )
  ) {
    adminEnvExample = adminEnvExample.replace(
      'INTERNAL_NOTIFICATION_SECRET=replace-with-the-same-shared-secret',
      `INTERNAL_NOTIFICATION_SECRET=replace-with-the-same-shared-secret
INTERNAL_REALTIME_SECRET=replace-with-the-same-shared-secret-used-by-both-backends`
    );
  } else {
    adminEnvExample +=
      '\\nINTERNAL_REALTIME_SECRET=replace-with-the-same-shared-secret-used-by-both-backends\\n';
  }
}

/* ========================================================================== */
/* 7. PRE-WRITE SEMANTIC VALIDATION                                            */
/* ========================================================================== */

const checks = [
  [
    newMobileSocket.includes('isAllowedSocketOrigin') &&
      newMobileSocket.includes("hostname === 'localhost'") &&
      newMobileSocket.includes('isPrivateIpv4Host(hostname)'),
    'mobile dynamic Socket.IO origin policy',
  ],
  [
    mobileBridge.includes('scheduleRealtimeBridgeRestart') &&
      mobileBridge.includes("normalizedStatus === 'CHANNEL_ERROR'") &&
      mobileBridge.includes("normalizedStatus === 'TIMED_OUT'") &&
      mobileBridge.includes("table: 'messages'"),
    'mobile Supabase realtime bridge recovery',
  ],
  [
    newMobileAdminRelay.includes(
      'https://smart-pdm.onrender.com'
    ) &&
      newMobileAdminRelay.includes(
        'http://127.0.0.1:5000'
      ) &&
      newMobileAdminRelay.includes(
        'process.env.INTERNAL_NOTIFICATION_SECRET'
      ),
    'mobile -> admin local+deployed relay',
  ],
  [
    newAdminStudentRelay.includes(
      'https://smart-pdm-3tbv.onrender.com'
    ) &&
      newAdminStudentRelay.includes(
        'http://127.0.0.1:3000'
      ) &&
      newAdminStudentRelay.includes(
        'process.env.INTERNAL_NOTIFICATION_SECRET'
      ),
    'admin -> mobile local+deployed relay',
  ],
  [
    mobileInternalRoutes.includes(
      'process.env.INTERNAL_NOTIFICATION_SECRET'
    ) &&
      adminInternalRoutes.includes(
        'process.env.INTERNAL_NOTIFICATION_SECRET'
      ),
    'internal realtime secret compatibility',
  ],
];

const failed = checks
  .filter(([ok]) => !ok)
  .map(([, label]) => label);

if (failed.length) {
  throw new Error(
    `Validation failed before writing: ${failed.join(', ')}. No project files were written.`
  );
}

/* ========================================================================== */
/* 8. CONTRACT TESTS                                                          */
/* ========================================================================== */

const mobileTestSource = `'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  isAllowedSocketOrigin,
} = require('../src/config/socket');
const mobileRelay = require('../src/services/adminRealtimeRelayService');

test('Flutter Web localhost/random ports and private LAN origins are allowed', () => {
  assert.equal(
    isAllowedSocketOrigin('http://localhost:54721'),
    true
  );
  assert.equal(
    isAllowedSocketOrigin('http://127.0.0.1:61001'),
    true
  );
  assert.equal(
    isAllowedSocketOrigin('http://192.168.100.9:54002'),
    true
  );
  assert.equal(
    isAllowedSocketOrigin('https://smart-pdm.vercel.app'),
    true
  );
  assert.equal(
    isAllowedSocketOrigin('https://example.invalid'),
    false
  );
});

test('mobile realtime relay targets local and deployed admin in development', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousUrls = process.env.ADMIN_BACKEND_URLS;
  const previousUrl = process.env.ADMIN_BACKEND_URL;

  try {
    process.env.NODE_ENV = 'development';
    delete process.env.ADMIN_BACKEND_URLS;
    delete process.env.ADMIN_BACKEND_URL;

    const urls = mobileRelay.getAdminBackendUrls();

    assert.ok(urls.includes('http://127.0.0.1:5000'));
    assert.ok(urls.includes('https://smart-pdm.onrender.com'));
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }

    if (previousUrls === undefined) {
      delete process.env.ADMIN_BACKEND_URLS;
    } else {
      process.env.ADMIN_BACKEND_URLS = previousUrls;
    }

    if (previousUrl === undefined) {
      delete process.env.ADMIN_BACKEND_URL;
    } else {
      process.env.ADMIN_BACKEND_URL = previousUrl;
    }
  }
});

test('mobile direct relay accepts existing notification secret as compatibility fallback', () => {
  const previousRealtime =
    process.env.INTERNAL_REALTIME_SECRET;
  const previousNotification =
    process.env.INTERNAL_NOTIFICATION_SECRET;

  try {
    delete process.env.INTERNAL_REALTIME_SECRET;
    process.env.INTERNAL_NOTIFICATION_SECRET =
      'shared-test-secret';

    assert.equal(
      mobileRelay.getInternalRealtimeSecret(),
      'shared-test-secret'
    );
  } finally {
    if (previousRealtime === undefined) {
      delete process.env.INTERNAL_REALTIME_SECRET;
    } else {
      process.env.INTERNAL_REALTIME_SECRET =
        previousRealtime;
    }

    if (previousNotification === undefined) {
      delete process.env.INTERNAL_NOTIFICATION_SECRET;
    } else {
      process.env.INTERNAL_NOTIFICATION_SECRET =
        previousNotification;
    }
  }
});

test('mobile Supabase bridge retries failed subscriptions and includes messages', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'src',
      'services',
      'realtimeBridgeService.js'
    ),
    'utf8'
  );

  assert.match(source, /table:\\s*'messages'/);
  assert.match(source, /scheduleRealtimeBridgeRestart/);
  assert.match(source, /CHANNEL_ERROR/);
  assert.match(source, /TIMED_OUT/);
});
`;

const adminTestSource = `'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const studentRelay = require('../services/studentRealtimeRelayService');

test('admin realtime relay targets local and deployed mobile backends in development', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousUrls =
    process.env.STUDENT_BACKEND_BASE_URLS;
  const previousUrl =
    process.env.STUDENT_BACKEND_BASE_URL;

  try {
    process.env.NODE_ENV = 'development';
    delete process.env.STUDENT_BACKEND_BASE_URLS;
    delete process.env.STUDENT_BACKEND_BASE_URL;

    const urls = studentRelay.getStudentBackendUrls();

    assert.ok(urls.includes('http://127.0.0.1:3000'));
    assert.ok(
      urls.includes('https://smart-pdm-3tbv.onrender.com')
    );
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }

    if (previousUrls === undefined) {
      delete process.env.STUDENT_BACKEND_BASE_URLS;
    } else {
      process.env.STUDENT_BACKEND_BASE_URLS =
        previousUrls;
    }

    if (previousUrl === undefined) {
      delete process.env.STUDENT_BACKEND_BASE_URL;
    } else {
      process.env.STUDENT_BACKEND_BASE_URL =
        previousUrl;
    }
  }
});

test('admin direct relay accepts existing notification secret as compatibility fallback', () => {
  const previousRealtime =
    process.env.INTERNAL_REALTIME_SECRET;
  const previousNotification =
    process.env.INTERNAL_NOTIFICATION_SECRET;

  try {
    delete process.env.INTERNAL_REALTIME_SECRET;
    process.env.INTERNAL_NOTIFICATION_SECRET =
      'shared-test-secret';

    assert.equal(
      studentRelay.getInternalRealtimeSecret(),
      'shared-test-secret'
    );
  } finally {
    if (previousRealtime === undefined) {
      delete process.env.INTERNAL_REALTIME_SECRET;
    } else {
      process.env.INTERNAL_REALTIME_SECRET =
        previousRealtime;
    }

    if (previousNotification === undefined) {
      delete process.env.INTERNAL_NOTIFICATION_SECRET;
    } else {
      process.env.INTERNAL_NOTIFICATION_SECRET =
        previousNotification;
    }
  }
});

test('admin message flow retains both direct relay and Supabase messages bridge', () => {
  const controller = fs.readFileSync(
    path.join(__dirname, '..', 'controllers', 'messageController.js'),
    'utf8'
  );
  const bridge = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'realtimeBridgeService.js'),
    'utf8'
  );

  assert.match(
    controller,
    /relayToStudentBackend\\('message:new'/
  );
  assert.match(bridge, /table:\\s*'messages'/);
  assert.match(bridge, /scheduleRealtimeBridgeRestart/);
});
`;

/* ========================================================================== */
/* 9. TRANSACTIONAL WRITE                                                     */
/* ========================================================================== */

const outputs = {
  mobileSocket: newMobileSocket,
  mobileBridge,
  mobileAdminRelay: newMobileAdminRelay,
  mobileInternalRoutes,
  adminStudentRelay: newAdminStudentRelay,
  adminInternalRoutes,
  adminEnvExample,
};

const rollbackRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'smartpdm-cross-realtime-')
);

const staged = [];

function stage(file) {
  const relative = path.relative(repo, file);
  const copy = path.join(rollbackRoot, relative);

  fs.mkdirSync(path.dirname(copy), { recursive: true });

  if (fs.existsSync(file)) {
    fs.copyFileSync(file, copy);
    staged.push({
      file,
      copy,
      existed: true,
    });
  } else {
    staged.push({
      file,
      copy,
      existed: false,
    });
  }
}

function restoreAll() {
  for (const item of staged) {
    if (item.existed) {
      fs.mkdirSync(path.dirname(item.file), {
        recursive: true,
      });
      fs.copyFileSync(item.copy, item.file);
    } else if (fs.existsSync(item.file)) {
      fs.unlinkSync(item.file);
    }
  }
}

for (const file of [
  files.mobileSocket,
  files.mobileBridge,
  files.mobileAdminRelay,
  files.mobileInternalRoutes,
  files.adminStudentRelay,
  files.adminInternalRoutes,
  files.adminEnvExample,
  files.mobileTest,
  files.adminTest,
]) {
  stage(file);
}

try {
  for (const [key, content] of Object.entries(outputs)) {
    if (
      key === 'adminEnvExample' &&
      !content &&
      !fs.existsSync(files.adminEnvExample)
    ) {
      continue;
    }

    fs.writeFileSync(
      files[key],
      restoreEol(content, crlf[key] || false),
      'utf8'
    );
  }

  fs.mkdirSync(path.dirname(files.mobileTest), {
    recursive: true,
  });
  fs.mkdirSync(path.dirname(files.adminTest), {
    recursive: true,
  });

  fs.writeFileSync(
    files.mobileTest,
    mobileTestSource,
    'utf8'
  );
  fs.writeFileSync(
    files.adminTest,
    adminTestSource,
    'utf8'
  );

  /* Syntax check every changed backend source. */
  for (const file of [
    files.mobileSocket,
    files.mobileBridge,
    files.mobileAdminRelay,
    files.mobileInternalRoutes,
    files.adminStudentRelay,
    files.adminInternalRoutes,
  ]) {
    run('node', ['--check', file], repo);
  }

  /* Cross-environment backend contracts. */
  run(
    'node',
    [
      '--test',
      'test/cross-environment-messaging-realtime.test.js',
    ],
    mobileBackend
  );

  run(
    'node',
    [
      '--test',
      'test/cross-environment-messaging-realtime.test.js',
    ],
    adminBackend
  );

  /*
   * Verify the existing Flutter messaging provider still handles direct
   * private + group messages after backend realtime hardening.
   */
  run(
    'flutter',
    [
      'test',
      'test/messaging_provider_test.dart',
    ],
    mobileFrontend
  );
} catch (error) {
  console.error(
    '\nCross-environment messaging fix failed a test. Restoring all changed files...'
  );

  restoreAll();

  console.error(
    `Rollback completed from: ${rollbackRoot}`
  );

  throw error;
}

try {
  fs.rmSync(rollbackRoot, {
    recursive: true,
    force: true,
  });
} catch (_) {
  // Non-fatal after tests have passed.
}

console.log(
  '\nPASS: cross-environment messaging realtime contracts + mobile messaging tests passed.'
);

console.log('\nSupported topology after restart/deploy:');
console.log('  - local mobile <-> local admin');
console.log('  - local mobile <-> deployed admin');
console.log('  - deployed/built mobile <-> local admin');
console.log('  - deployed/built mobile <-> deployed admin');

console.log('\nImportant:');
console.log(
  '  - restart both LOCAL backends after applying this patch'
);
console.log(
  '  - deploy these backend changes later so deployed-to-deployed uses the same hardened relay/recovery code'
);
console.log(
  '  - no database migration was added'
);
console.log(
  '  - no repository .bak backup files were created'
);
