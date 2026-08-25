import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { buildApiUrl } from '@/api';
import { getDefaultLandingTheme, resolveLandingTheme } from '@/config/landingThemes';

const STORAGE_KEY = 'smartpdm-theme-landing';
const PUBLIC_SOCKET_NAMESPACE = '/public';
let inFlightLandingThemeRequest = null;

function getPublicSocketUrl() {
  return `${buildApiUrl('').replace(/\/+$/, '')}${PUBLIC_SOCKET_NAMESPACE}`;
}

function writeCachedLandingTheme(nextState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // The live theme still applies when browser storage is unavailable.
  }
}

async function requestLandingTheme() {
  if (inFlightLandingThemeRequest) return inFlightLandingThemeRequest;

  inFlightLandingThemeRequest = (async () => {
    const response = await fetch(buildApiUrl('/api/theme-settings/public/landing'));
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to load landing theme.');
    }
    return payload;
  })();

  try {
    return await inFlightLandingThemeRequest;
  } finally {
    inFlightLandingThemeRequest = null;
  }
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

  const applyTheme = useCallback((presetKey, customColors) => {
    const nextState = {
      presetKey: String(presetKey || 'default').trim().toLowerCase() || 'default',
      customColors: customColors && typeof customColors === 'object' ? customColors : null,
    };
    setState(nextState);
    writeCachedLandingTheme(nextState);
  }, []);

  const loadTheme = useCallback(async () => {
    try {
      const payload = await requestLandingTheme();
      applyTheme(payload?.preset_key, payload?.custom_colors || null);
    } catch (error) {
      console.error('LANDING THEME LOAD ERROR:', error);
    }
  }, [applyTheme]);

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
      if (payload?.preset_key) {
        applyTheme(payload.preset_key, payload?.custom_colors || null);
        return;
      }
      loadTheme();
    };

    socket.on('landing-theme:updated', handleThemeUpdated);

    return () => {
      socket.off('landing-theme:updated', handleThemeUpdated);
      socket.disconnect();
    };
  }, [applyTheme, loadTheme]);

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
