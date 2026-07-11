import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, CheckCircle2, Loader2, Palette, RotateCcw } from 'lucide-react';
import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getThemePresetOptions, resolvePortalTheme } from '@/config/portalThemes';

const PORTAL_LABELS = {
  admin: 'Admin',
  sdo: 'SDO',
  guidance: 'Guidance',
  pd: 'Program Director',
};

const PORTAL_HELPERS = {
  admin: 'Admin portal layout, cards, login, and charts',
  sdo: 'SDO login, queue, dashboard, and reports',
  guidance: 'Guidance login, queue, dashboard, and reports',
  pd: 'PD login, queue, dashboard, and reports',
};

function ThemePreviewCard({ portalKey, presetKey }) {
  const theme = resolvePortalTheme(portalKey, presetKey);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="px-4 py-3 text-white" style={{ background: theme.base }}>
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
          <span className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: theme.accentSoft, color: theme.base }}>
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
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
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

function CompactPortalDisplayCard({ portalKey, presetKey }) {
  const theme = resolvePortalTheme(portalKey, presetKey);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            {PORTAL_LABELS[portalKey]}
          </p>
          <p className="mt-1 text-sm font-semibold text-stone-900">{theme.label}</p>
        </div>
        <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-medium text-stone-500">
          View only
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {[theme.base, theme.chartSecondary, theme.chartTertiary, theme.chartQuaternary].map((color) => (
          <span
            key={`${portalKey}-${color}`}
            className="h-5 w-5 rounded-full border border-black/5"
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ThemePanel({
  tokenStorageKey = 'adminToken',
  allowedPortals = ['admin', 'sdo', 'guidance', 'pd'],
  editablePortals = null,
  title = 'Theme Presets',
  subtitle = 'Choose a portal color preset for layouts, logins, and dashboard charts.',
}) {
  const [settings, setSettings] = useState({});
  const [savingPortal, setSavingPortal] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const presetOptions = useMemo(() => getThemePresetOptions(), []);
  const normalizedPortals = useMemo(
    () => (Array.isArray(allowedPortals) && allowedPortals.length ? allowedPortals : ['admin']).map((portalKey) => String(portalKey || '').trim().toLowerCase()),
    [allowedPortals]
  );
  const normalizedEditablePortals = useMemo(
    () =>
      (Array.isArray(editablePortals) && editablePortals.length ? editablePortals : normalizedPortals).map((portalKey) =>
        String(portalKey || '').trim().toLowerCase()
      ),
    [editablePortals, normalizedPortals]
  );
  const editablePortalSet = useMemo(() => new Set(normalizedEditablePortals), [normalizedEditablePortals]);
  const readOnlyPortals = useMemo(
    () => normalizedPortals.filter((portalKey) => !editablePortalSet.has(portalKey)),
    [editablePortalSet, normalizedPortals]
  );

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl('/api/theme-settings'), {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem(tokenStorageKey)}`,
          'Content-Type': 'application/json',
        },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load theme settings.');
      }

      const nextSettings = {};
      const items = Array.isArray(payload?.items) ? payload.items : [];
      normalizedPortals.forEach((portalKey) => {
        const match = items.find((item) => String(item?.portal_key || '').trim().toLowerCase() === portalKey);
        nextSettings[portalKey] = match?.preset_key || 'default';
      });
      setSettings(nextSettings);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Failed to load theme settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!feedback.message) return undefined;
    const timer = window.setTimeout(() => setFeedback({ type: '', message: '' }), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const handleSave = async (portalKey, presetKey = 'default') => {
    try {
      setSavingPortal(portalKey);
      const response = await fetch(buildApiUrl(`/api/theme-settings/${portalKey}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem(tokenStorageKey)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preset_key: presetKey }),
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

      try {
        localStorage.setItem(`smartpdm-theme-${portalKey}`, nextPresetKey);
      } catch {}

      setFeedback({ type: 'success', message: `${PORTAL_LABELS[portalKey]} theme applied.` });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Failed to save theme setting.' });
    } finally {
      setSavingPortal('');
    }
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
      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-white">
            <Palette className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
            <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
            <p className="mt-1 text-xs text-stone-500">
              Click a preset to save it immediately. Use Restore Default anytime.
            </p>
            {normalizedEditablePortals.length < normalizedPortals.length ? (
              <p className="mt-1 text-xs text-stone-500">
                This page can edit only the assigned portal theme. Other office themes are shown for quick reference.
              </p>
            ) : null}
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
        {normalizedEditablePortals.map((portalKey) => {
          const savedPresetKey = settings[portalKey] || 'default';

          return (
            <Card key={portalKey} className="overflow-hidden border-stone-200 shadow-none">
              <div className="border-b border-stone-100 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-stone-900">{PORTAL_LABELS[portalKey]} Theme</h4>
                    <p className="mt-1 text-sm text-stone-500">
                      Saved preset: <span className="font-medium text-stone-700">{resolvePortalTheme(portalKey, savedPresetKey).label}</span>
                    </p>
                    <p className="mt-1 text-xs text-stone-500">{PORTAL_HELPERS[portalKey]}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl border-stone-200 text-xs"
                    onClick={() => handleSave(portalKey, 'default')}
                    disabled={savingPortal === portalKey}
                  >
                    {savingPortal === portalKey ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
                    {savingPortal === portalKey ? 'Applying...' : 'Restore Default'}
                  </Button>
                </div>
              </div>

              <CardContent className="space-y-4 p-5">
                <ThemePreviewCard portalKey={portalKey} presetKey={savedPresetKey} />

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
                              {isSelected ? (savingPortal === portalKey ? 'Applying theme...' : 'Currently active theme.') : preset.description}
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
                          {preset.swatches.map((color) => (
                            <span
                              key={`${portalKey}-${preset.key}-${color}`}
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

      {readOnlyPortals.length > 0 ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
            <h4 className="text-sm font-semibold text-stone-900">Other Office Themes</h4>
            <p className="mt-1 text-xs text-stone-500">
              Display only. These office themes are managed in their own maintenance pages.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {readOnlyPortals.map((portalKey) => (
                <CompactPortalDisplayCard
                  key={`overview-${portalKey}`}
                  portalKey={portalKey}
                  presetKey={settings[portalKey] || 'default'}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
