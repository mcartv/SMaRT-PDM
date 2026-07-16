import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { buildApiUrl } from '@/api';

const SOCKET_URL = buildApiUrl('').replace(/\/+$/, '');

let globalSocket = null;
let joinedUserId = '';

function getStoredSocketToken() {
  return (
    sessionStorage.getItem('adminToken') ||
    sessionStorage.getItem('pdToken') ||
    sessionStorage.getItem('guidanceToken') ||
    sessionStorage.getItem('sdoToken') ||
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
  if (globalSocket) {
    if (globalSocket.connected) {
      emitUserJoin(globalSocket);
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
      token: getStoredSocketToken(),
      userId: getSocketUserId(),
      role: getSocketRole(),
    },
    query: {
      userId: getSocketUserId(),
      role: getSocketRole(),
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

  joinedUserId = '';

  globalSocket.auth = {
    token: getStoredSocketToken(),
    userId: getSocketUserId(),
    role: getSocketRole(),
  };

  globalSocket.io.opts.query = {
    userId: getSocketUserId(),
    role: getSocketRole(),
  };

  if (globalSocket.connected) {
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