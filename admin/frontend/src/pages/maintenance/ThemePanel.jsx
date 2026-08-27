import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import { AlertCircle, BarChart3, CheckCircle2, Loader2, Moon, Palette, Plus, RotateCcw, Save, X } from 'lucide-react';
import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { getThemePresetOptions, resolvePortalTheme } from '@/config/portalThemes';
import { showAppToast } from '@/utils/appToast';
import {
  MAINTENANCE_CARD_SUBTITLE_CLASS,
  MAINTENANCE_CARD_TITLE_CLASS,
} from './components/maintenanceTypography';

const PORTAL_LABELS = {
  admin: 'Admin',
  sdo: 'SDO',
  guidance: 'Guidance',
  pd: 'Program Director',
  ro_coordinator: 'RO Coordinator',
};

const PORTAL_HELPERS = {
  admin: 'Your signed-in Admin layout, cards, and charts',
  sdo: 'Your signed-in SDO queue, dashboard, and reports',
  guidance: 'Your signed-in Guidance queue, dashboard, and reports',
  pd: 'Your signed-in PD queue, dashboard, and reports',
  ro_coordinator: 'Your signed-in RO request queue and dashboard',
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

function personalThemeCacheKey(portalKey, userId) {
  return `smartpdm-theme-${portalKey}-${userId}`;
}

function readPersonalThemeCache(portalKeys, tokenStorageKey) {
  const token = sessionStorage.getItem(tokenStorageKey) || '';
  const userId = getUserIdFromToken(token);
  const settings = {};
  const customColors = {};
  const forceDarkModes = {};
  let hasAny = false;

  if (!userId) return { settings, customColors, forceDarkModes, hasAny, userId };

  portalKeys.forEach((portalKey) => {
    try {
      const raw = localStorage.getItem(personalThemeCacheKey(portalKey, userId));
      if (!raw) return;
      const parsed = raw.startsWith('{') ? JSON.parse(raw) : { presetKey: raw, customColors: null };
      settings[portalKey] = parsed?.presetKey || 'default';
      customColors[portalKey] = parsed?.customColors || null;
      forceDarkModes[portalKey] = parsed?.forceDarkMode === true;
      hasAny = true;
    } catch {
      // Ignore an unreadable cache and refresh silently from the API.
    }
  });

  return { settings, customColors, forceDarkModes, hasAny, userId };
}

function writePersonalThemeCache(portalKey, userId, presetKey, colors, forceDarkMode = false) {
  if (!portalKey || !userId) return;
  try {
    localStorage.setItem(
      personalThemeCacheKey(portalKey, userId),
      JSON.stringify({
        presetKey: presetKey || 'default',
        customColors: colors || null,
        forceDarkMode: forceDarkMode === true,
      })
    );
  } catch {
    // Theme persistence still works server-side when browser storage is unavailable.
  }
}

const CUSTOM_COLOR_FIELDS = [
  { key: 'base', label: 'Sidebar' },
  { key: 'active', label: 'Active navigation' },
  { key: 'mainBg', label: 'Page background' },
  { key: 'accent', label: 'Accent' },
  { key: 'accentSoft', label: 'Accent surface' },
  { key: 'chartTertiary', label: 'Chart color 3' },
  { key: 'chartQuaternary', label: 'Chart color 4' },
];

function ThemePreviewCard({ portalKey, presetKey, customColors = null }) {
  const theme = resolvePortalTheme(portalKey, presetKey, customColors);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="px-4 py-3" style={{ background: theme.base, color: theme.text }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">{PORTAL_LABELS[portalKey]}</p>
            <p className="mt-1 text-sm font-semibold">Portal Preview</p>
          </div>
          <div className="rounded-xl bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
            Charts Included
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4" style={{ background: theme.mainBg }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold text-white" style={{ background: theme.active }}>
            Active
          </span>
          <span className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: 'var(--portal-accent-soft)', color: 'var(--portal-fg-accent)' }}>
            Accent
          </span>
          <span className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold text-white" style={{ background: theme.chartSecondary }}>
            Chart
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[theme.chartPrimary, theme.chartSecondary, theme.chartTertiary, theme.chartQuaternary].map((color) => (
            <div key={color} className="h-10 rounded-xl" style={{ background: color }} />
          ))}
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-white/80 p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
            <BarChart3 className="h-3.5 w-3.5" />
            Sample Chart Palette
          </div>
          <div className="flex h-20 items-end gap-2">
            <div className="w-1/4 rounded-t-xl" style={{ height: '52%', background: theme.chartPrimary }} />
            <div className="w-1/4 rounded-t-xl" style={{ height: '82%', background: theme.chartSecondary }} />
            <div className="w-1/4 rounded-t-xl" style={{ height: '67%', background: theme.chartTertiary }} />
            <div className="w-1/4 rounded-t-xl" style={{ height: '40%', background: theme.chartQuaternary }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomThemeModal({ portalKey, colors, saving, onChange, onClose, onSave }) {
  if (!portalKey) return null;

  const previewColors = {
    ...colors,
    chartPrimary: colors.base,
    chartSecondary: colors.accent,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Create Custom Theme</h3>
            <p className="mt-1 text-xs text-stone-500">Saved only for your {PORTAL_LABELS[portalKey]} account.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Theme Colors</p>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
              {CUSTOM_COLOR_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 px-3 py-2.5">
                  <span className="text-xs font-medium text-stone-700">{field.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] font-medium uppercase text-stone-400">{colors[field.key]}</span>
                    <input
                      type="color"
                      value={colors[field.key]}
                      onChange={(event) => onChange(field.key, event.target.value)}
                      className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Live Preview</p>
            <ThemePreviewCard portalKey={portalKey} presetKey="custom" customColors={previewColors} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="h-9 rounded-xl border-stone-200 text-xs">
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={saving} className="h-9 rounded-xl bg-stone-900 px-4 text-xs text-white hover:bg-stone-800">
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save Custom Theme
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ThemePanel({
  tokenStorageKey = 'adminToken',
  allowedPortals = ['admin', 'sdo', 'guidance', 'pd'],
  title = 'Theme Presets',
  subtitle = 'Choose a personal color preset for your signed-in layout and dashboard charts.',
}) {
  const normalizedPortals = useMemo(
    () => (Array.isArray(allowedPortals) && allowedPortals.length ? allowedPortals : ['admin']).map((portalKey) => String(portalKey || '').trim().toLowerCase()),
    [allowedPortals]
  );
  const cachedSnapshot = useMemo(
    () => readPersonalThemeCache(normalizedPortals, tokenStorageKey),
    [normalizedPortals, tokenStorageKey]
  );

  const [settings, setSettings] = useState(() => ({ ...cachedSnapshot.settings }));
  const [customColors, setCustomColors] = useState(() => ({ ...cachedSnapshot.customColors }));
  const [forceDarkModes, setForceDarkModes] = useState(() => ({ ...cachedSnapshot.forceDarkModes }));
  const [customPortal, setCustomPortal] = useState('');
  const [customDraft, setCustomDraft] = useState({});
  const [savingPortal, setSavingPortal] = useState('');
  const [loading, setLoading] = useState(() => !cachedSnapshot.hasAny);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const presetOptions = useMemo(() => {
    const seen = new Set();
    return getThemePresetOptions().filter((preset) => {
      const key = String(preset?.key || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);
  const loadSettings = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);

    try {
      const token = sessionStorage.getItem(tokenStorageKey) || '';
      const userId = getUserIdFromToken(token);
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      let items = [];
      if (normalizedPortals.length === 1) {
        const portalKey = normalizedPortals[0];
        const response = await fetch(buildApiUrl(`/api/theme-settings/current/${portalKey}`), { headers });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load theme settings.');
        }
        items = [payload];
      } else {
        const response = await fetch(buildApiUrl('/api/theme-settings'), { headers });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load theme settings.');
        }
        items = Array.isArray(payload?.items) ? payload.items : [];
      }

      const nextSettings = {};
      const nextCustomColors = {};
      const nextForceDarkModes = {};
      normalizedPortals.forEach((portalKey) => {
        const match = items.find((item) => String(item?.portal_key || '').trim().toLowerCase() === portalKey);
        nextSettings[portalKey] = match?.preset_key || 'default';
        nextCustomColors[portalKey] = match?.custom_colors || null;
        nextForceDarkModes[portalKey] = match?.force_dark_mode === true;
        writePersonalThemeCache(
          portalKey,
          userId,
          nextSettings[portalKey],
          nextCustomColors[portalKey],
          nextForceDarkModes[portalKey]
        );
      });
      setSettings(nextSettings);
      setCustomColors(nextCustomColors);
      setForceDarkModes(nextForceDarkModes);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Failed to load theme settings.' });
    } finally {
      setLoading(false);
    }
  }, [normalizedPortals, tokenStorageKey]);

  useEffect(() => {
    loadSettings({ showLoading: !cachedSnapshot.hasAny });
  }, [cachedSnapshot.hasAny, loadSettings]);

  useSocketEvent('maintenance:updated', (event) => {
    if (event?.source !== 'theme_settings') return;

    const portalKey = String(event?.portal_key || '').trim().toLowerCase();
    if (!normalizedPortals.includes(portalKey)) return;

    const token = sessionStorage.getItem(tokenStorageKey) || '';
    const userId = getUserIdFromToken(token);
    if (event?.is_personal && event?.user_id && userId && event.user_id !== userId) return;

    if (
      event?.preset_key !== undefined ||
      event?.custom_colors !== undefined ||
      event?.force_dark_mode !== undefined
    ) {
      const nextPresetKey = event?.preset_key !== undefined
        ? String(event.preset_key || 'default').trim().toLowerCase() || 'default'
        : settings[portalKey] || 'default';
      const nextColors = event?.custom_colors !== undefined
        ? event.custom_colors || null
        : customColors[portalKey] || null;
      const nextForceDark = event?.force_dark_mode !== undefined
        ? event.force_dark_mode === true
        : forceDarkModes[portalKey] === true;
      setSettings((current) => ({ ...current, [portalKey]: nextPresetKey }));
      setCustomColors((current) => ({ ...current, [portalKey]: nextColors }));
      setForceDarkModes((current) => ({ ...current, [portalKey]: nextForceDark }));
      writePersonalThemeCache(portalKey, userId, nextPresetKey, nextColors, nextForceDark);
      return;
    }

    loadSettings({ showLoading: false });
  }, [loadSettings, normalizedPortals, tokenStorageKey]);

  useEffect(() => {
    if (!feedback.message) return undefined;
    const timer = window.setTimeout(() => setFeedback({ type: '', message: '' }), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const handleSave = async (portalKey, presetKey = 'default', nextCustomColors = null) => {
    const previousPresetKey = settings[portalKey] || 'default';
    const previousCustomColors = customColors[portalKey] || null;
    const optimisticCustomColors = presetKey === 'custom' ? nextCustomColors : null;

    setSettings((current) => ({ ...current, [portalKey]: presetKey }));
    setCustomColors((current) => ({ ...current, [portalKey]: optimisticCustomColors }));
    window.dispatchEvent(new CustomEvent('smartpdm-theme-updated', {
      detail: {
        portal_key: portalKey,
        preset_key: presetKey,
        custom_colors: optimisticCustomColors,
      },
    }));

    try {
      setSavingPortal(portalKey);
      const response = await fetch(buildApiUrl(`/api/theme-settings/${portalKey}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem(tokenStorageKey)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preset_key: presetKey, custom_colors: nextCustomColors }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save theme setting.');
      }

      const nextPresetKey = payload?.preset_key || presetKey;
      setSettings((current) => ({
        ...current,
        [portalKey]: nextPresetKey,
      }));
      const savedCustomColors = payload?.custom_colors || null;
      setCustomColors((current) => ({
        ...current,
        [portalKey]: savedCustomColors,
      }));
      writePersonalThemeCache(
        portalKey,
        getUserIdFromToken(sessionStorage.getItem(tokenStorageKey) || ''),
        nextPresetKey,
        savedCustomColors,
        forceDarkModes[portalKey] === true
      );

      window.dispatchEvent(new CustomEvent('smartpdm-theme-updated', {
        detail: {
          portal_key: portalKey,
          preset_key: nextPresetKey,
          custom_colors: payload?.custom_colors || null,
          user_id: payload?.user_id || null,
        },
      }));
      showAppToast(
        'success',
        'Theme updated',
        `${PORTAL_LABELS[portalKey]} theme is now ${resolvePortalTheme(portalKey, nextPresetKey, savedCustomColors).label}.`,
        { id: `theme-update-${portalKey}` }
      );

      return true;
    } catch (error) {
      setSettings((current) => ({ ...current, [portalKey]: previousPresetKey }));
      setCustomColors((current) => ({ ...current, [portalKey]: previousCustomColors }));
      writePersonalThemeCache(
        portalKey,
        getUserIdFromToken(sessionStorage.getItem(tokenStorageKey) || ''),
        previousPresetKey,
        previousCustomColors,
        forceDarkModes[portalKey] === true
      );
      window.dispatchEvent(new CustomEvent('smartpdm-theme-updated', {
        detail: {
          portal_key: portalKey,
          preset_key: previousPresetKey,
          custom_colors: previousCustomColors,
        },
      }));
      setFeedback({ type: 'error', message: error.message || 'Failed to save theme setting.' });
      return false;
    } finally {
      setSavingPortal('');
    }
  };

  const handleForceDarkToggle = async (portalKey, enabled) => {
    const previous = forceDarkModes[portalKey] === true;
    const userId = getUserIdFromToken(sessionStorage.getItem(tokenStorageKey) || '');
    const presetKey = settings[portalKey] || 'default';
    const colors = customColors[portalKey] || null;

    setForceDarkModes((current) => ({ ...current, [portalKey]: enabled }));
    writePersonalThemeCache(portalKey, userId, presetKey, colors, enabled);
    window.dispatchEvent(new CustomEvent('smartpdm-theme-updated', {
      detail: {
        portal_key: portalKey,
        force_dark_mode: enabled,
      },
    }));

    try {
      setSavingPortal(`${portalKey}:force-dark`);
      const response = await fetch(buildApiUrl(`/api/theme-settings/${portalKey}/force-dark`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem(tokenStorageKey)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force_dark_mode: enabled }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save Dark Mode.');
      }

      const savedValue = payload?.force_dark_mode === true;
      setForceDarkModes((current) => ({ ...current, [portalKey]: savedValue }));
      writePersonalThemeCache(portalKey, userId, presetKey, colors, savedValue);
      window.dispatchEvent(new CustomEvent('smartpdm-theme-updated', {
        detail: {
          portal_key: portalKey,
          preset_key: payload?.preset_key,
          custom_colors: payload?.custom_colors,
          force_dark_mode: savedValue,
          user_id: payload?.user_id || userId,
        },
      }));
      showAppToast(
        'success',
        savedValue ? 'Dark Mode enabled' : 'Dark Mode disabled',
        `${PORTAL_LABELS[portalKey]} display mode updated successfully.`,
        { id: `theme-update-${portalKey}` }
      );
    } catch (error) {
      setForceDarkModes((current) => ({ ...current, [portalKey]: previous }));
      writePersonalThemeCache(portalKey, userId, presetKey, colors, previous);
      window.dispatchEvent(new CustomEvent('smartpdm-theme-updated', {
        detail: {
          portal_key: portalKey,
          force_dark_mode: previous,
        },
      }));
      setFeedback({ type: 'error', message: error.message || 'Failed to save Dark Mode.' });
    } finally {
      setSavingPortal('');
    }
  };

  const openCustomTheme = (portalKey) => {
    const currentTheme = resolvePortalTheme(
      portalKey,
      settings[portalKey] || 'default',
      customColors[portalKey] || null
    );
    setCustomDraft({
      base: currentTheme.base,
      active: currentTheme.active,
      mainBg: currentTheme.mainBg,
      accent: currentTheme.accent,
      accentSoft: currentTheme.accentSoft,
      chartPrimary: currentTheme.base,
      chartSecondary: currentTheme.accent,
      chartTertiary: currentTheme.chartTertiary,
      chartQuaternary: currentTheme.chartQuaternary,
    });
    setCustomPortal(portalKey);
  };

  const saveCustomTheme = async () => {
    const palette = {
      ...customDraft,
      chartPrimary: customDraft.base,
      chartSecondary: customDraft.accent,
    };
    const saved = await handleSave(customPortal, 'custom', palette);
    if (saved) setCustomPortal('');
  };

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center gap-3 rounded-2xl border border-stone-200 bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        <p className="text-sm text-stone-500">Loading theme presets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CustomThemeModal
        portalKey={customPortal}
        colors={customDraft}
        saving={savingPortal === customPortal}
        onChange={(key, value) => setCustomDraft((current) => ({ ...current, [key]: value }))}
        onClose={() => {
          if (!savingPortal) setCustomPortal('');
        }}
        onSave={saveCustomTheme}
      />
      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-white">
            <Palette className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className={MAINTENANCE_CARD_TITLE_CLASS}>{title}</h3>
            <p className={MAINTENANCE_CARD_SUBTITLE_CLASS}>{subtitle}</p>
            <p className="mt-1 text-xs text-stone-500">
              Click a preset to save it immediately. Use Restore Default anytime.
            </p>
            {feedback.message ? (
              <div
                className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                  feedback.type === 'error'
                    ? 'border border-red-200 bg-red-50 text-red-700'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {feedback.type === 'error' ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {feedback.message}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {normalizedPortals.map((portalKey) => {
          const savedPresetKey = settings[portalKey] || 'default';
          const savedCustomColors = customColors[portalKey] || null;
          const forceDarkEnabled = forceDarkModes[portalKey] === true;
          const forceDarkSaving = savingPortal === `${portalKey}:force-dark`;

          return (
            <Card key={portalKey} className="overflow-hidden border-stone-200 shadow-none">
              <div className="border-b border-stone-100 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className={MAINTENANCE_CARD_TITLE_CLASS}>{PORTAL_LABELS[portalKey]} Theme</h4>
                    <p className={MAINTENANCE_CARD_SUBTITLE_CLASS}>
                      Saved preset: <span className="font-medium text-stone-700">{resolvePortalTheme(portalKey, savedPresetKey, savedCustomColors).label}</span>
                    </p>
                    <p className="mt-1 text-xs text-stone-500">{PORTAL_HELPERS[portalKey]}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl border-stone-200 text-xs"
                      onClick={() => openCustomTheme(portalKey)}
                      disabled={savingPortal === portalKey}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Custom Theme
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl border-stone-200 text-xs"
                      onClick={() => handleSave(portalKey, 'default')}
                      disabled={savingPortal === portalKey}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      Restore Default
                    </Button>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-white">
                      <Moon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900">Dark Mode</p>
                      <p className="mt-0.5 text-xs leading-5 text-stone-500">
                        Uses a native dark palette for this portal on your account. Images, icons, and brand colors stay unchanged.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={forceDarkEnabled}
                    onCheckedChange={(checked) => handleForceDarkToggle(portalKey, checked === true)}
                    disabled={forceDarkSaving}
                    aria-label={`Dark Mode for ${PORTAL_LABELS[portalKey]}`}
                    className="data-checked:bg-stone-900"
                  />
                </div>

                <ThemePreviewCard portalKey={portalKey} presetKey={savedPresetKey} customColors={savedCustomColors} />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {presetOptions.map((preset) => {
                    const isSelected = savedPresetKey === preset.key;
                    return (
                      <button
                        key={`${portalKey}-${preset.key}`}
                        type="button"
                        onClick={() => handleSave(portalKey, preset.key)}
                        disabled={savingPortal === portalKey}
                        className={`rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{preset.label}</p>
                            <p className={`mt-1 text-xs ${isSelected ? 'text-white/75' : 'text-stone-500'}`}>
                              {isSelected ? 'Currently active theme.' : preset.description}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {isSelected ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
                            {isSelected ? (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isSelected ? 'bg-white/15 text-white' : 'bg-stone-100 text-stone-600'}`}>
                                Saved
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                          {preset.swatches.map((color, swatchIndex) => (
                            <span
                              key={`${portalKey}-${preset.key}-${swatchIndex}`}
                              className="h-6 w-6 rounded-full border border-black/5"
                              style={{ background: color }}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
