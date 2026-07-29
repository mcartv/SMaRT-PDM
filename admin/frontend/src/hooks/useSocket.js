import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { buildApiUrl } from '@/api';

const SOCKET_URL = buildApiUrl('').replace(/\/+$/, '');

let globalSocket = null;
let joinedUserId = '';

function getStoredSocketToken() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const portalTokenKey = [
    ['/admin', 'adminToken'],
    ['/sdo', 'sdoToken'],
    ['/guidance', 'guidanceToken'],
    ['/pd', 'pdToken'],
    ['/ro-coordinator', 'roCoordinatorToken'],
  ].find(([portalPath]) => pathname.startsWith(portalPath))?.[1];

  if (portalTokenKey) {
    const portalToken = sessionStorage.getItem(portalTokenKey);
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

function getSocketUserId() {
  const token = getStoredSocketToken();
  const decoded = decodeJwtPayload(token);

  return (
    decoded?.userId?.toString?.() ||
    decoded?.user_id?.toString?.() ||
    decoded?.sub?.toString?.() ||
    decoded?.id?.toString?.() ||
    ''
  );
}

function getSocketRole() {
  const token = getStoredSocketToken();
  const decoded = decodeJwtPayload(token);

  return (
    decoded?.role?.toString?.() ||
    decoded?.userRole?.toString?.() ||
    decoded?.user_role?.toString?.() ||
    ''
  );
}

function emitUserJoin(socket) {
  if (!socket || !socket.connected) return;

  const userId = getSocketUserId();
  const role = getSocketRole();

  if (!userId) {
    console.warn('[Socket] Cannot join user room: missing userId');
    return;
  }

  if (joinedUserId === userId) {
    return;
  }

  joinedUserId = userId;

  const payload = {
    userId,
    user_id: userId,
    role,
  };

  console.log('[Socket] Joining user room:', payload);

  /*
    Keep all aliases. Unknown socket events are ignored by the backend.
    This makes the admin compatible with whichever join event your backend uses.
  */
  socket.emit('user-join', payload);
  socket.emit('join:user', payload);
  socket.emit('joinUser', payload);
  socket.emit('join-user', payload);
  socket.emit('joinUserRoom', payload);
}

export const initializeSocket = () => {
  const token = getStoredSocketToken();
  const userId = getSocketUserId();
  const role = getSocketRole();

  if (globalSocket) {
    const connectedToken = globalSocket.auth?.token || '';

    if (connectedToken !== token) {
      joinedUserId = '';
      globalSocket.auth = { token, userId, role };
      globalSocket.io.opts.query = { userId, role };
      globalSocket.disconnect();
      globalSocket.connect();
      return globalSocket;
    }

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

  globalSocket.on('connect', () => {
    console.log('[Socket] Connected:', globalSocket.id);
    emitUserJoin(globalSocket);
  });

  globalSocket.on('reconnect', () => {
    console.log('[Socket] Reconnected:', globalSocket.id);
    joinedUserId = '';
    emitUserJoin(globalSocket);
  });

  globalSocket.io.on('reconnect', () => {
    console.log('[Socket] Manager reconnected');
    joinedUserId = '';
    emitUserJoin(globalSocket);
  });

  globalSocket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    joinedUserId = '';
  });

  globalSocket.on('connect_error', (error) => {
    console.error('[Socket] Connect error:', error?.message || error);
  });

  return globalSocket;
};

export const reconnectSocketWithLatestToken = () => {
  if (!globalSocket) {
    return initializeSocket();
  }

  const token = getStoredSocketToken();
  const userId = getSocketUserId();
  const role = getSocketRole();
  const tokenChanged = (globalSocket.auth?.token || '') !== token;

  joinedUserId = '';

  globalSocket.auth = {
    token,
    userId,
    role,
  };

  globalSocket.io.opts.query = {
    userId,
    role,
  };

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
    globalSocket.disconnect();
  }

  globalSocket = null;
  joinedUserId = '';
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
    socketRef.current = initializeSocket();

    /*
      Important:
      If the socket connected before adminToken was saved,
      this forces it to join again using the latest token.
    */
    emitUserJoin(socketRef.current);

    const handler = (...args) => {
      callbackRef.current?.(...args);
    };

    socketRef.current.on(event, handler);

    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, handler);
      }
    };
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

    emitUserJoin(socketRef.current);

    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
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
    socketRef.current = initializeSocket();
    emitUserJoin(socketRef.current);

    const handlers = Object.entries(eventsRef.current).map(([event, callback]) => {
      const handler = (...args) => {
        callback?.(...args);
      };

      socketRef.current.on(event, handler);

      return {
        event,
        handler,
      };
    });

    return () => {
      handlers.forEach(({ event, handler }) => {
        if (socketRef.current) {
          socketRef.current.off(event, handler);
        }
      });
    };
  }, [events]);

  return socketRef.current;
};
