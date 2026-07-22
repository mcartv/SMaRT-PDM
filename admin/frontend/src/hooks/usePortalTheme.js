import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { getPortalDefaultTheme, resolvePortalTheme } from '@/config/portalThemes';

const PORTAL_TOKEN_KEYS = {
  admin: 'adminToken',
  sdo: 'sdoToken',
  guidance: 'guidanceToken',
  pd: 'pdToken',
};

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

export default function usePortalTheme(portalKey, fallbackTheme = null, options = {}) {
  const normalizedPortal = String(portalKey || 'admin').trim().toLowerCase();
  const fallback = fallbackTheme || getPortalDefaultTheme(normalizedPortal);
  const publicOnly = options?.publicOnly === true;
  const tokenStorageKey = options?.tokenStorageKey || PORTAL_TOKEN_KEYS[normalizedPortal] || '';
  const token = !publicOnly && tokenStorageKey
    ? sessionStorage.getItem(tokenStorageKey) || ''
    : '';
  const userId = getUserIdFromToken(token);
  const cacheKey = storageKeyForPortal(normalizedPortal, userId || 'public');

  const [themeSetting, setThemeSetting] = useState(() => readCachedTheme(cacheKey));

  const loadTheme = useCallback(async () => {
    try {
      const endpoint = token
        ? `/api/theme-settings/current/${normalizedPortal}`
        : `/api/theme-settings/public/${normalizedPortal}`;
      const response = await fetch(buildApiUrl(endpoint), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load theme settings.');
      }

      const nextPreset = String(payload?.preset_key || 'default').trim().toLowerCase() || 'default';
      const nextSetting = {
        presetKey: nextPreset,
        customColors: payload?.custom_colors || null,
      };
      setThemeSetting(nextSetting);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(nextSetting));
      } catch {
        // The live theme still applies when browser storage is unavailable.
      }
    } catch (error) {
      console.error('THEME LOAD ERROR:', error);
    }
  }, [cacheKey, normalizedPortal, token]);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  useEffect(() => {
    const handleLocalThemeUpdate = (event) => {
      if (event.detail?.portal_key !== normalizedPortal) return;
      if (event.detail?.user_id && userId && event.detail.user_id !== userId) return;
      loadTheme();
    };

    window.addEventListener('smartpdm-theme-updated', handleLocalThemeUpdate);
    return () => window.removeEventListener('smartpdm-theme-updated', handleLocalThemeUpdate);
  }, [loadTheme, normalizedPortal, userId]);

  useSocketEvent(
    'maintenance:updated',
    (payload) => {
      if (payload?.source !== 'theme_settings') return;
      if (payload?.portal_key && payload.portal_key !== normalizedPortal) return;
      if (payload?.is_personal && payload?.user_id && userId && payload.user_id !== userId) return;
      loadTheme();
    },
    [loadTheme, normalizedPortal, userId]
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
