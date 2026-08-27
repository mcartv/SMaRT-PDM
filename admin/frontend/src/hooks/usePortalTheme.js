import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { getPortalDefaultTheme, resolvePortalTheme } from '@/config/portalThemes';

const PORTAL_TOKEN_KEYS = {
  admin: 'adminToken',
  sdo: 'sdoToken',
  guidance: 'guidanceToken',
  pd: 'pdToken',
  ro_coordinator: 'roCoordinatorToken',
};

const inFlightThemeRequests = new Map();

function decodeTokenPayload(token) {
  try {
    const encoded = String(token || '').split('.')[1];
    if (!encoded) return {};
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) || {};
  } catch {
    return {};
  }
}

function getUserIdFromToken(token) {
  const payload = decodeTokenPayload(token);
  return payload.user_id || payload.userId || payload.sub || payload.id || '';
}

function storageKeyForPortal(portalKey, userId = 'public') {
  return `smartpdm-theme-${portalKey}-${userId || 'public'}`;
}

function readCachedTheme(cacheKey) {
  try {
    const saved = localStorage.getItem(cacheKey);
    if (!saved) return { presetKey: 'default', customColors: null, forceDarkMode: false };
    if (!saved.startsWith('{')) return { presetKey: saved, customColors: null, forceDarkMode: false };
    const parsed = JSON.parse(saved);
    return {
      presetKey: parsed?.presetKey || 'default',
      customColors: parsed?.customColors || null,
      forceDarkMode: parsed?.forceDarkMode === true,
    };
  } catch {
    return { presetKey: 'default', customColors: null, forceDarkMode: false };
  }
}

function writeCachedTheme(cacheKey, setting) {
  try {
    if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(setting));
  } catch {
    // The live theme still applies when browser storage is unavailable.
  }
}

async function requestCurrentTheme(normalizedPortal, token, requestKey) {
  if (inFlightThemeRequests.has(requestKey)) {
    return inFlightThemeRequests.get(requestKey);
  }

  const request = (async () => {
    const response = await fetch(buildApiUrl(`/api/theme-settings/current/${normalizedPortal}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to load theme settings.');
    }

    return payload;
  })();

  inFlightThemeRequests.set(requestKey, request);
  try {
    return await request;
  } finally {
    if (inFlightThemeRequests.get(requestKey) === request) {
      inFlightThemeRequests.delete(requestKey);
    }
  }
}

export default function usePortalTheme(portalKey, fallbackTheme = null, options = {}) {
  const normalizedPortal = String(portalKey || 'admin').trim().toLowerCase();
  const fallback = fallbackTheme || getPortalDefaultTheme(normalizedPortal);
  const tokenStorageKey = options?.tokenStorageKey || PORTAL_TOKEN_KEYS[normalizedPortal] || '';
  const token = tokenStorageKey ? sessionStorage.getItem(tokenStorageKey) || '' : '';
  const userId = getUserIdFromToken(token);
  const cacheKey = userId ? storageKeyForPortal(normalizedPortal, userId) : '';

  const [themeSetting, setThemeSetting] = useState(() =>
    cacheKey ? readCachedTheme(cacheKey) : { presetKey: 'default', customColors: null, forceDarkMode: false }
  );

  const applyThemeSetting = useCallback((partial = {}) => {
    setThemeSetting((current) => {
      const nextSetting = {
        presetKey: partial.presetKey !== undefined
          ? String(partial.presetKey || 'default').trim().toLowerCase() || 'default'
          : current.presetKey,
        customColors: partial.customColors !== undefined
          ? partial.customColors || null
          : current.customColors,
        forceDarkMode: partial.forceDarkMode !== undefined
          ? partial.forceDarkMode === true
          : current.forceDarkMode === true,
      };
      writeCachedTheme(cacheKey, nextSetting);
      return nextSetting;
    });
  }, [cacheKey]);

  const loadTheme = useCallback(async () => {
    if (!token || !userId) {
      setThemeSetting({ presetKey: 'default', customColors: null, forceDarkMode: false });
      return;
    }

    try {
      const payload = await requestCurrentTheme(
        normalizedPortal,
        token,
        `${normalizedPortal}:${userId}`
      );
      applyThemeSetting({
        presetKey: payload?.preset_key,
        customColors: payload?.custom_colors || null,
        forceDarkMode: payload?.force_dark_mode === true,
      });
    } catch (error) {
      console.error('THEME LOAD ERROR:', error);
    }
  }, [applyThemeSetting, normalizedPortal, token, userId]);

  useEffect(() => {
    setThemeSetting(
      cacheKey ? readCachedTheme(cacheKey) : { presetKey: 'default', customColors: null, forceDarkMode: false }
    );
    loadTheme();
  }, [cacheKey, loadTheme]);

  useEffect(() => {
    const handleLocalThemeUpdate = (event) => {
      if (event.detail?.portal_key !== normalizedPortal) return;
      if (event.detail?.user_id && userId && event.detail.user_id !== userId) return;
      if (
        event.detail?.preset_key !== undefined ||
        event.detail?.custom_colors !== undefined ||
        event.detail?.force_dark_mode !== undefined
      ) {
        applyThemeSetting({
          presetKey: event.detail?.preset_key,
          customColors: event.detail?.custom_colors,
          forceDarkMode: event.detail?.force_dark_mode,
        });
        return;
      }
      loadTheme();
    };

    window.addEventListener('smartpdm-theme-updated', handleLocalThemeUpdate);
    return () => window.removeEventListener('smartpdm-theme-updated', handleLocalThemeUpdate);
  }, [applyThemeSetting, loadTheme, normalizedPortal, userId]);

  useSocketEvent(
    'maintenance:updated',
    (payload) => {
      if (payload?.source !== 'theme_settings') return;
      if (payload?.portal_key && payload.portal_key !== normalizedPortal) return;
      if (payload?.is_personal && payload?.user_id && userId && payload.user_id !== userId) return;

      if (
        payload?.preset_key !== undefined ||
        payload?.custom_colors !== undefined ||
        payload?.force_dark_mode !== undefined
      ) {
        applyThemeSetting({
          presetKey: payload?.preset_key,
          customColors: payload?.custom_colors,
          forceDarkMode: payload?.force_dark_mode,
        });
        return;
      }
      loadTheme();
    },
    [applyThemeSetting, loadTheme, normalizedPortal, userId]
  );

  const theme = useMemo(() => {
    const resolved = resolvePortalTheme(normalizedPortal, themeSetting.presetKey, themeSetting.customColors);
    return {
      ...fallback,
      ...resolved,
    };
  }, [fallback, normalizedPortal, themeSetting]);

  return {
    theme,
    presetKey: themeSetting.presetKey,
    customColors: themeSetting.customColors,
    forceDarkMode: themeSetting.forceDarkMode === true,
    reloadTheme: loadTheme,
  };
}
