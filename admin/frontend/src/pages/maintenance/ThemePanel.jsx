import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Loader2, Palette, RotateCcw } from 'lucide-react';
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

function PortalOverviewCard({ portalKey, presetKey }) {
  const theme = resolvePortalTheme(portalKey, presetKey);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{PORTAL_LABELS[portalKey]}</p>
          <p className="mt-1 text-sm font-semibold text-stone-900">{theme.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">{PORTAL_HELPERS[portalKey]}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {[theme.base, theme.chartSecondary, theme.chartTertiary].map((color) => (
            <span
              key={`${portalKey}-${color}`}
              className="h-6 w-6 rounded-full border border-black/5"
              style={{ background: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ThemePanel({
  tokenStorageKey = 'adminToken',
  allowedPortals = ['admin', 'sdo', 'guidance', 'pd'],
  title = 'Theme Presets',
  subtitle = 'Choose a portal color preset for layouts, logins, and dashboard charts.',
}) {
  const [settings, setSettings] = useState({});
  const [savingPortal, setSavingPortal] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  const presetOptions = useMemo(() => getThemePresetOptions(), []);
  const normalizedPortals = useMemo(
    () => (Array.isArray(allowedPortals) && allowedPortals.length ? allowedPortals : ['admin']).map((portalKey) => String(portalKey || '').trim().toLowerCase()),
    [allowedPortals]
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
      setFeedback(error.message || 'Failed to load theme settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(''), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const handleSave = async (portalKey, presetKey) => {
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

      setSettings((current) => ({
        ...current,
        [portalKey]: payload?.preset_key || presetKey,
      }));

      try {
        localStorage.setItem(`smartpdm-theme-${portalKey}`, payload?.preset_key || presetKey);
      } catch {}

      setFeedback(`${PORTAL_LABELS[portalKey]} theme updated successfully.`);
    } catch (error) {
      setFeedback(error.message || 'Failed to save theme setting.');
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
              Presets now affect portal shell colors, login accents, and chart palettes.
            </p>
            {feedback ? <p className="mt-2 text-xs font-medium text-stone-700">{feedback}</p> : null}
          </div>
        </div>
      </div>

      {normalizedPortals.length > 1 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {normalizedPortals.map((portalKey) => (
            <PortalOverviewCard
              key={`overview-${portalKey}`}
              portalKey={portalKey}
              presetKey={settings[portalKey] || 'default'}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {normalizedPortals.map((portalKey) => {
          const currentPresetKey = settings[portalKey] || 'default';
          const currentTheme = resolvePortalTheme(portalKey, currentPresetKey);

          return (
            <Card key={portalKey} className="overflow-hidden border-stone-200 shadow-none">
              <div className="border-b border-stone-100 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-stone-900">{PORTAL_LABELS[portalKey]} Theme</h4>
                    <p className="mt-1 text-sm text-stone-500">
                      Current preset: <span className="font-medium text-stone-700">{currentTheme.label}</span>
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
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset
                  </Button>
                </div>
              </div>

              <CardContent className="space-y-4 p-5">
                <ThemePreviewCard portalKey={portalKey} presetKey={currentPresetKey} />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {presetOptions.map((preset) => {
                    const isSelected = currentPresetKey === preset.key;
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
                              {preset.description}
                            </p>
                          </div>
                          {isSelected ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
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
    </div>
  );
}
