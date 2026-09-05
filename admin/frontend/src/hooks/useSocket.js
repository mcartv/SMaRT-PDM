import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import { buildApiUrl } from '@/api';
import {
  PORTAL_CONFIG,
  invalidateStoredPortalSession,
} from '@/utils/authStorage';

const SOCKET_URL = buildApiUrl('').replace(/\/+$/, '');

const SESSION_INVALID_CODES = new Set([
  'ACCOUNT_DEACTIVATED',
  'SESSION_REVOKED',
  'SESSION_ROLE_CHANGED',
  'STAFF_ACCOUNT_NOT_FOUND',
  'STAFF_SESSION_INVALID',
  'ADMIN_SESSION_MIGRATION_REQUIRED',
  'ADMIN_SESSION_INVALID',
  'ADMIN_SESSION_TOKEN_MISSING',
  'ADMIN_SESSION_USER_MISSING',
  'ADMIN_SESSION_DEVICE_MISMATCH',
  'ADMIN_SESSION_INACTIVE',
  'ADMIN_SESSION_EXPIRED',
  'ADMIN_SESSION_LOGGED_OUT',
  'ADMIN_SESSION_NOT_FOUND',
  'ADMIN_SESSION_TOKEN_MISMATCH',
  'ADMIN_SESSION_SCOPE_MISMATCH',
  'SOCKET_AUTH_INVALID',
  'SOCKET_AUTH_REQUIRED',
  'NOT_ADMIN_ACCOUNT',
]);

let globalSocket = null;
let joinedUserId = '';

function getPortalFromPathname() {
  if (typeof window === 'undefined') return null;

  const pathname = window.location.pathname;

  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/sdo')) return 'sdo';
  if (pathname.startsWith('/guidance')) return 'guidance';
  if (pathname.startsWith('/pd')) return 'pd';
  if (pathname.startsWith('/ro-coordinator')) return 'ro_coordinator';

  return null;
}

function getStoredSocketToken() {
  const portalName = getPortalFromPathname();
  const portal = portalName ? PORTAL_CONFIG[portalName] : null;

  if (portal?.tokenKey) {
    const portalToken = sessionStorage.getItem(portal.tokenKey);
    if (portalToken) return portalToken;
  }

  return (
    sessionStorage.getItem('adminToken') ||
    sessionStorage.getItem('pdToken') ||
    sessionStorage.getItem('guidanceToken') ||
    sessionStorage.getItem('sdoToken') ||
    sessionStorage.getItem('roCoordinatorToken') ||
    ''
  );
}

function decodeJwtPayload(token) {
  try {
    if (!token) return {};

    const parts = token.split('.');
    if (parts.length < 2) return {};

    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');

    while (base64.length % 4) {
      base64 += '=';
    }

    return JSON.parse(atob(base64)) || {};
  } catch (error) {
    console.warn('[Socket] Failed to decode token:', error);
    return {};
  }
}

function getSocketIdentity(token = getStoredSocketToken()) {
  const decoded = decodeJwtPayload(token);

  return {
    userId:
      decoded?.userId?.toString?.() ||
      decoded?.user_id?.toString?.() ||
      decoded?.sub?.toString?.() ||
      decoded?.id?.toString?.() ||
      '',
    role:
      decoded?.role?.toString?.().trim().toLowerCase() ||
      decoded?.userRole?.toString?.().trim().toLowerCase() ||
      decoded?.user_role?.toString?.().trim().toLowerCase() ||
      '',
  };
}

function resolvePortalNameFromIdentity(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return PORTAL_CONFIG[normalizedRole] ? normalizedRole : getPortalFromPathname();
}

function stopSocket(socket = globalSocket) {
  if (!socket) return;

  try {
    socket.io.reconnection(false);
  } catch {
    // Socket manager may already be torn down.
  }

  socket.disconnect();
}

function invalidatePortalSession(error) {
  const token = globalSocket?.auth?.token || getStoredSocketToken();
  const { role } = getSocketIdentity(token);
  const portalName = resolvePortalNameFromIdentity(role);
  const code = String(error?.data?.code || 'SESSION_REVOKED');
  const message = String(
    error?.message || 'Your session is no longer active. Please sign in again.'
  );

  if (portalName && PORTAL_CONFIG[portalName]) {
    invalidateStoredPortalSession({
      portalName,
      code,
      message,
    });
  }

  stopSocket(globalSocket);
  globalSocket = null;
  joinedUserId = '';

}

function emitUserJoin(socket) {
  if (!socket || !socket.connected) return;

  const token = socket.auth?.token || getStoredSocketToken();
  const { userId, role } = getSocketIdentity(token);

  if (!userId) return;
  if (joinedUserId === userId) return;

  joinedUserId = userId;

  // Kept for transition compatibility with older deployed backends. The
  // hardened backend ignores these claimed IDs and uses only the authenticated
  // handshake identity when joining user rooms.
  const payload = {
    userId,
    user_id: userId,
    role,
  };

  socket.emit('user-join', payload);
  socket.emit('join:user', payload);
  socket.emit('joinUser', payload);
  socket.emit('join-user', payload);
  socket.emit('joinUserRoom', payload);
}

function refreshSocketAuthFromStorage(socket) {
  if (!socket) return false;

  const token = getStoredSocketToken();
  if (!token) return false;

  const { userId, role } = getSocketIdentity(token);

  socket.auth = {
    token,
    userId,
    role,
  };

  if (socket.io?.opts) {
    socket.io.opts.query = {
      userId,
      role,
    };
  }

  return true;
}

let socketRecoveryHooksInstalled = false;
let _socketRecoveryTimer = null;

function recoverSocketConnection() {
  if (!globalSocket) {
    initializeSocket();
    return;
  }

  if (globalSocket.connected) {
    return;
  }

  if (!refreshSocketAuthFromStorage(globalSocket)) {
    return;
  }

  try {
    globalSocket.io.reconnection(true);
    globalSocket.connect();
  } catch (error) {
    console.warn(
      '[Socket] Recovery connect failed:',
      error?.message || error
    );
  }
}

function installSocketRecoveryHooks() {
  if (
    socketRecoveryHooksInstalled ||
    typeof window === 'undefined'
  ) {
    return;
  }

  socketRecoveryHooksInstalled = true;

  window.addEventListener('online', recoverSocketConnection);
  window.addEventListener('focus', recoverSocketConnection);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      recoverSocketConnection();
    }
  });

  // Local connection watchdog only. When the socket is healthy this sends
  // no HTTP request and no application API traffic.
  _socketRecoveryTimer = window.setInterval(() => {
    if (!globalSocket?.connected && getStoredSocketToken()) {
      recoverSocketConnection();
    }
  }, 15000);
}

function attachSocketLifecycle(socket) {
  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    joinedUserId = '';
    emitUserJoin(socket);
  });

  socket.on('socket:joined', (payload = {}) => {
    console.log('[Socket] Server room joined:', payload.room || '');
  });

  socket.io.on('reconnect_attempt', () => {
    refreshSocketAuthFromStorage(socket);
  });

  socket.io.on('reconnect', () => {
    console.log('[Socket] Manager reconnected');
    refreshSocketAuthFromStorage(socket);
    joinedUserId = '';
    emitUserJoin(socket);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    joinedUserId = '';

    if (
      reason !== 'io client disconnect' &&
      getStoredSocketToken()
    ) {
      window.setTimeout(recoverSocketConnection, 500);
    }
  });

  socket.on('session:invalidated', (payload = {}, acknowledge) => {
    if (typeof acknowledge === 'function') {
      acknowledge({
        received: true,
        user_id:
          getSocketIdentity(socket.auth?.token || '').userId ||
          null,
        received_at: new Date().toISOString(),
      });
    }

    invalidatePortalSession({
      message:
        payload?.message ||
        'Your session is no longer active. Please sign in again.',
      data: {
        code: payload?.code || 'SESSION_REVOKED',
      },
    });
  });

  socket.on('connect_error', (error) => {
    const code = String(error?.data?.code || '');

    if (SESSION_INVALID_CODES.has(code)) {
      console.warn('[Socket] Session rejected:', code);
      invalidatePortalSession(error);
      return;
    }

    console.error(
      '[Socket] Connect error:',
      error?.message || error
    );

    // A transient network/backend restart should not permanently strand the
    // global socket. Refresh auth before Socket.IO retries.
    refreshSocketAuthFromStorage(socket);
  });
}
export const initializeSocket = () => {
  installSocketRecoveryHooks();
  const token = getStoredSocketToken();

  // Public pages intentionally do not open the authenticated staff socket.
  // Their content continues to load through the existing public HTTP APIs.
  if (!token) {
    if (globalSocket) {
      stopSocket(globalSocket);
      globalSocket = null;
      joinedUserId = '';
    }
    return null;
  }

  const { userId, role } = getSocketIdentity(token);

  if (globalSocket) {
    const connectedToken = globalSocket.auth?.token || '';

    if (connectedToken !== token) {
      joinedUserId = '';
      globalSocket.auth = { token, userId, role };
      globalSocket.io.opts.query = { userId, role };
      globalSocket.io.reconnection(true);
      globalSocket.disconnect();
      globalSocket.connect();
      return globalSocket;
    }

    globalSocket.io.reconnection(true);

    if (globalSocket.connected) {
      emitUserJoin(globalSocket);
    } else {
      globalSocket.connect();
    }

    return globalSocket;
  }

  globalSocket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    transports: ['websocket', 'polling'],
    auth: {
      token,
      userId,
      role,
    },
    query: {
      userId,
      role,
    },
  });

  attachSocketLifecycle(globalSocket);
  return globalSocket;
};

export const reconnectSocketWithLatestToken = () => {
  const token = getStoredSocketToken();

  if (!token) {
    disconnectSocket();
    return null;
  }

  if (!globalSocket) {
    return initializeSocket();
  }

  const { userId, role } = getSocketIdentity(token);
  const tokenChanged = (globalSocket.auth?.token || '') !== token;

  joinedUserId = '';
  globalSocket.auth = { token, userId, role };
  globalSocket.io.opts.query = { userId, role };
  globalSocket.io.reconnection(true);

  if (tokenChanged && globalSocket.connected) {
    globalSocket.disconnect();
    globalSocket.connect();
  } else if (globalSocket.connected) {
    emitUserJoin(globalSocket);
  } else {
    globalSocket.connect();
  }

  return globalSocket;
};

export const disconnectSocket = () => {
  if (globalSocket) {
    stopSocket(globalSocket);
  }

  globalSocket = null;
  joinedUserId = '';
};

/**
 * Small connection-state hook for UI that needs to explain a transient socket
 * reconnect without showing repeated error toasts.
 */
export const useSocketConnectionState = () => {
  const [status, setStatus] = useState(() => {
    const socket = initializeSocket();
    return socket?.connected ? 'connected' : 'connecting';
  });

  useEffect(() => {
    const socket = initializeSocket();
    if (!socket) {
      setStatus('offline');
      return undefined;
    }

    const handleConnect = () => setStatus('connected');
    const handleDisconnect = () => setStatus('reconnecting');
    const handleReconnectAttempt = () => setStatus('reconnecting');
    const handleConnectError = () => setStatus('reconnecting');

    setStatus(socket.connected ? 'connected' : 'connecting');
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.io.on('reconnect', handleConnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.io.off('reconnect', handleConnect);
    };
  }, []);

  return status;
};

/**
 * Hook to use socket events in components.
 *
 * @param {string} event - Socket event name.
 * @param {function} callback - Function called when event fires.
 * @param {array} deps - Dependency array.
 */
export const useSocketEvent = (event, callback, deps = []) => {
  const socketRef = useRef(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const socket = initializeSocket();
    socketRef.current = socket;

    if (!socket) return undefined;

    emitUserJoin(socket);

    const handler = (...args) => {
      callbackRef.current?.(...args);
    };

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  // Callers deliberately extend this subscription dependency list.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);

  return socketRef.current;
};

/**
 * Hook to emit socket events.
 */
export const useSocketEmit = () => {
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = initializeSocket();
    emitUserJoin(socketRef.current);
  }, []);

  return useCallback((event, data) => {
    if (!socketRef.current) {
      socketRef.current = initializeSocket();
    }

    if (!socketRef.current) return false;

    emitUserJoin(socketRef.current);
    socketRef.current.emit(event, data);
    return true;
  }, []);
};

/**
 * Hook to subscribe and unsubscribe from multiple socket events at once.
 */
export const useSocketListener = (events = {}) => {
  const socketRef = useRef(null);
  const eventsRef = useRef(events);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    const socket = initializeSocket();
    socketRef.current = socket;

    if (!socket) return undefined;

    emitUserJoin(socket);

    const handlers = Object.entries(eventsRef.current).map(([event, callback]) => {
      const handler = (...args) => {
        callback?.(...args);
      };

      socket.on(event, handler);

      return { event, handler };
    });

    return () => {
      handlers.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
    };
  }, [events]);

  return socketRef.current;
};
