import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { getPortalDefaultTheme, resolvePortalTheme } from '@/config/portalThemes';

function storageKeyForPortal(portalKey) {
  return `smartpdm-theme-${portalKey}`;
}

export default function usePortalTheme(portalKey, fallbackTheme = null) {
  const normalizedPortal = String(portalKey || 'admin').trim().toLowerCase();
  const fallback = fallbackTheme || getPortalDefaultTheme(normalizedPortal);
  const [presetKey, setPresetKey] = useState(() => {
    try {
      return localStorage.getItem(storageKeyForPortal(normalizedPortal)) || 'default';
    } catch {
      return 'default';
    }
  });

  const loadTheme = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl(`/api/theme-settings/public/${normalizedPortal}`));
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load theme settings.');
      }

      const nextPreset = String(payload?.preset_key || 'default').trim().toLowerCase() || 'default';
      setPresetKey(nextPreset);
      try {
        localStorage.setItem(storageKeyForPortal(normalizedPortal), nextPreset);
      } catch {}
    } catch (error) {
      console.error('THEME LOAD ERROR:', error);
    }
  }, [normalizedPortal]);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  useSocketEvent(
    'maintenance:updated',
    (payload) => {
      if (payload?.source !== 'theme_settings') return;
      if (payload?.portal_key && payload.portal_key !== normalizedPortal) return;
      loadTheme();
    },
    [loadTheme, normalizedPortal]
  );

  const theme = useMemo(() => {
    const resolved = resolvePortalTheme(normalizedPortal, presetKey);
    return {
      ...fallback,
      ...resolved,
    };
  }, [fallback, normalizedPortal, presetKey]);

  return {
    theme,
    presetKey,
    reloadTheme: loadTheme,
  };
}
