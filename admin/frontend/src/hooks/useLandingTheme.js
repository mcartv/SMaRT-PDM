import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { getDefaultLandingTheme, resolveLandingTheme } from '@/config/landingThemes';

const STORAGE_KEY = 'smartpdm-theme-landing';

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

  useSocketEvent(
    'maintenance:updated',
    (payload) => {
      if (payload?.source !== 'theme_settings') return;
      if (payload?.portal_key !== 'landing') return;
      loadTheme();
    },
    [loadTheme]
  );

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
