import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { buildApiUrl } from '@/api';

const SOCKET_URL = buildApiUrl('');

let globalSocket = null;

export const initializeSocket = () => {
  if (globalSocket && globalSocket.connected) {
    return globalSocket;
  }

  globalSocket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling']
  });

  globalSocket.on('connect', () => {
    console.log('[Socket] Connected:', globalSocket.id);
    const token = localStorage.getItem('adminToken');
    if (token) {
      globalSocket.emit('user-join', { token });
    }
  });

  globalSocket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
  });

  return globalSocket;
};

/**
 * Hook to use socket events in components
 * @param {string} event - Event name to listen to
 * @param {function} callback - Function to call when event fires
 * @param {array} deps - Dependency array
 */
export const useSocketEvent = (event, callback, deps = []) => {
  const socket = useRef(null);

  useEffect(() => {
    if (!socket.current) {
      socket.current = initializeSocket();
    }

    socket.current.on(event, callback);

    return () => {
      if (socket.current) {
        socket.current.off(event, callback);
      }
    };
  }, [event, callback, ...deps]);

  return socket.current;
};

/**
 * Hook to emit socket events
 */
export const useSocketEmit = () => {
  const socket = useRef(null);

  useEffect(() => {
    if (!socket.current) {
      socket.current = initializeSocket();
    }
  }, []);

  return useCallback((event, data) => {
    if (socket.current) {
      socket.current.emit(event, data);
    }
  }, []);
};

/**
 * Hook to subscribe and unsubscribe from multiple socket events at once
 */
export const useSocketListener = (events = {}) => {
  const socket = useRef(null);

  useEffect(() => {
    if (!socket.current) {
      socket.current = initializeSocket();
    }

    Object.entries(events).forEach(([event, callback]) => {
      socket.current.on(event, callback);
    });

    return () => {
      Object.entries(events).forEach(([event, callback]) => {
        if (socket.current) {
          socket.current.off(event, callback);
        }
      });
    };
  }, [events]);

  return socket.current;
};
