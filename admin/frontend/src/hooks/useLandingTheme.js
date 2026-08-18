import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { buildApiUrl } from '@/api';
import { getDefaultLandingTheme, resolveLandingTheme } from '@/config/landingThemes';

const STORAGE_KEY = 'smartpdm-theme-landing';
const PUBLIC_SOCKET_NAMESPACE = '/public';

function getPublicSocketUrl() {
  return `${buildApiUrl('').replace(/\/+$/, '')}${PUBLIC_SOCKET_NAMESPACE}`;
}

export default function useLandingTheme() {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { presetKey: 'default', customColors: null };
    } catch {
      return { presetKey: 'default', customColors: null };
    }
  });

  const loadTheme = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/theme-settings/public/landing'));
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load landing theme.');
      }

      const nextState = {
        presetKey: String(payload?.preset_key || 'default').trim().toLowerCase() || 'default',
        customColors: payload?.custom_colors && typeof payload.custom_colors === 'object' ? payload.custom_colors : null,
      };

      setState(nextState);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      } catch {}
    } catch (error) {
      console.error('LANDING THEME LOAD ERROR:', error);
    }
  }, []);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  useEffect(() => {
    const socket = io(getPublicSocketUrl(), {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
    });

    const handleThemeUpdated = (payload = {}) => {
      if (String(payload?.portal_key || '').trim().toLowerCase() !== 'landing') return;
      loadTheme();
    };

    socket.on('landing-theme:updated', handleThemeUpdated);

    return () => {
      socket.off('landing-theme:updated', handleThemeUpdated);
      socket.disconnect();
    };
  }, [loadTheme]);

  const theme = useMemo(
    () => ({
      ...getDefaultLandingTheme(),
      ...resolveLandingTheme(state.presetKey, state.customColors),
    }),
    [state.customColors, state.presetKey]
  );

  return {
    theme,
    presetKey: state.presetKey,
    customColors: state.customColors,
    reloadTheme: loadTheme,
  };
}
