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
    if (!saved) return { presetKey: 'default', customColors: null };
    if (!saved.startsWith('{')) return { presetKey: saved, customColors: null };
    const parsed = JSON.parse(saved);
    return {
      presetKey: parsed?.presetKey || 'default',
      customColors: parsed?.customColors || null,
    };
  } catch {
    return { presetKey: 'default', customColors: null };
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
    cacheKey ? readCachedTheme(cacheKey) : { presetKey: 'default', customColors: null }
  );

  const applyThemeSetting = useCallback((presetKey, colors) => {
    const nextSetting = {
      presetKey: String(presetKey || 'default').trim().toLowerCase() || 'default',
      customColors: colors || null,
    };
    setThemeSetting(nextSetting);
    writeCachedTheme(cacheKey, nextSetting);
  }, [cacheKey]);

  const loadTheme = useCallback(async () => {
    if (!token || !userId) {
      setThemeSetting({ presetKey: 'default', customColors: null });
      return;
    }

    try {
      const payload = await requestCurrentTheme(
        normalizedPortal,
        token,
        `${normalizedPortal}:${userId}`
      );
      applyThemeSetting(payload?.preset_key, payload?.custom_colors || null);
    } catch (error) {
      console.error('THEME LOAD ERROR:', error);
    }
  }, [applyThemeSetting, normalizedPortal, token, userId]);

  useEffect(() => {
    setThemeSetting(
      cacheKey ? readCachedTheme(cacheKey) : { presetKey: 'default', customColors: null }
    );
    loadTheme();
  }, [cacheKey, loadTheme]);

  useEffect(() => {
    const handleLocalThemeUpdate = (event) => {
      if (event.detail?.portal_key !== normalizedPortal) return;
      if (event.detail?.user_id && userId && event.detail.user_id !== userId) return;
      if (event.detail?.preset_key) {
        applyThemeSetting(event.detail.preset_key, event.detail.custom_colors || null);
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

      if (payload?.preset_key) {
        applyThemeSetting(payload.preset_key, payload?.custom_colors || null);
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
    reloadTheme: loadTheme,
  };
}
