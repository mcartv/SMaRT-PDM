import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Palette, Plus, RotateCcw, Save, X } from 'lucide-react';
import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  LANDING_COLOR_FIELDS,
  getDefaultLandingTheme,
  getLandingThemePresetOptions,
  resolveLandingTheme,
} from '@/config/landingThemes';

function ColorInput({ label, value, onChange }) {
  return (
    <label className="rounded-2xl border border-stone-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-14 cursor-pointer rounded-lg border border-stone-200 bg-white p-1"
        />
        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-mono text-stone-700">
          {value}
        </span>
      </div>
    </label>
  );
}

function LandingThemePreview({ theme }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <div
        className="px-5 py-5 text-white"
        style={{
          background: `linear-gradient(135deg, ${theme.dark} 0%, ${theme.base} 58%, ${theme.heroEnd} 100%)`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
              Landing Preview
            </p>
            <p className="mt-1 text-lg font-semibold">Scholarship platform entry page</p>
          </div>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
            Live Colors
          </span>
        </div>
      </div>

      <div style={{ background: theme.pageBg }} className="space-y-4 p-5">
        <div className="rounded-2xl border p-4" style={{ background: theme.soft, borderColor: theme.border }}>
          <div className="flex flex-wrap gap-2">
            {[theme.dark, theme.base, theme.heroEnd, theme.soft].map((color) => (
              <span key={color} className="h-8 w-8 rounded-full border border-black/5" style={{ background: color }} />
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold text-stone-900">How it works, quick access, and portal directory</p>
          <p className="mt-1 text-sm text-stone-500">This preview reflects the landing page hero, soft surfaces, and border tone.</p>
        </div>
      </div>
    </div>
  );
}

function LandingCustomThemeModal({ open, colors, saving, onChange, onClose, onSave }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Create Landing Page Theme</h3>
            <p className="mt-1 text-xs text-stone-500">Preview first, then publish these colors to the public landing page.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Landing Colors</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {LANDING_COLOR_FIELDS.map((field) => (
                <ColorInput
                  key={field.key}
                  label={field.label}
                  value={colors[field.key]}
                  onChange={(value) => onChange(field.key, value)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Live Preview</p>
            <LandingThemePreview theme={resolveLandingTheme('custom', colors)} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="h-9 rounded-xl border-stone-200 text-xs">
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={saving} className="h-9 rounded-xl bg-stone-900 px-4 text-xs text-white hover:bg-stone-800">
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Publish Custom Theme
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function LandingThemePanel({ tokenStorageKey = 'adminToken' }) {
  const [presetKey, setPresetKey] = useState('default');
  const [customColors, setCustomColors] = useState(() => {
    const defaults = getDefaultLandingTheme();
    return Object.fromEntries(LANDING_COLOR_FIELDS.map((field) => [field.key, defaults[field.key]]));
  });
  const [customDraft, setCustomDraft] = useState(() => ({ ...customColors }));
  const [customOpen, setCustomOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const presetOptions = useMemo(() => getLandingThemePresetOptions(), []);
  const previewTheme = useMemo(
    () => resolveLandingTheme(presetKey, presetKey === 'custom' ? customColors : null),
    [customColors, presetKey]
  );

  const loadLandingTheme = useCallback(async () => {
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

      const items = Array.isArray(payload?.items) ? payload.items : [];
      const landing = items.find((item) => String(item?.portal_key || '').trim().toLowerCase() === 'landing');
      const nextPreset = landing?.preset_key || 'default';
      const resolved = resolveLandingTheme(nextPreset, landing?.custom_colors || null);

      setPresetKey(nextPreset);
      setCustomColors(
        Object.fromEntries(LANDING_COLOR_FIELDS.map((field) => [field.key, resolved[field.key]]))
      );
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Failed to load landing theme.' });
    } finally {
      setLoading(false);
    }
  }, [tokenStorageKey]);

  useEffect(() => {
    loadLandingTheme();
  }, [loadLandingTheme]);

  useEffect(() => {
    if (!feedback.message) return undefined;
    const timer = window.setTimeout(() => setFeedback({ type: '', message: '' }), 2600);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const saveLandingTheme = async (nextPresetKey, nextCustomColors = null) => {
    try {
      setSaving(true);
      const response = await fetch(buildApiUrl('/api/theme-settings/landing'), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem(tokenStorageKey)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preset_key: nextPresetKey,
          custom_colors: nextPresetKey === 'custom' ? nextCustomColors : null,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save landing theme.');
      }

      const resolved = resolveLandingTheme(payload?.preset_key || nextPresetKey, payload?.custom_colors || null);
      setPresetKey(payload?.preset_key || nextPresetKey);
      setCustomColors(
        Object.fromEntries(LANDING_COLOR_FIELDS.map((field) => [field.key, resolved[field.key]]))
      );
      setFeedback({
        type: 'success',
        message:
          (payload?.preset_key || nextPresetKey) === 'custom'
            ? 'Landing custom colors saved.'
            : 'Landing preset applied.',
      });
      return true;
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'Failed to save landing theme.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePresetApply = (nextPresetKey) => {
    const resolved = resolveLandingTheme(nextPresetKey);
    const nextColors = Object.fromEntries(LANDING_COLOR_FIELDS.map((field) => [field.key, resolved[field.key]]));
    setPresetKey(nextPresetKey);
    setCustomColors(nextColors);
    saveLandingTheme(nextPresetKey, null);
  };

  const openCustomTheme = () => {
    const current = resolveLandingTheme(presetKey, presetKey === 'custom' ? customColors : null);
    setCustomDraft(Object.fromEntries(LANDING_COLOR_FIELDS.map((field) => [field.key, current[field.key]])));
    setCustomOpen(true);
  };

  const handleSaveCustom = async () => {
    const saved = await saveLandingTheme('custom', customDraft);
    if (saved) setCustomOpen(false);
  };

  const handleRestoreDefault = () => {
    const resolved = resolveLandingTheme('default');
    setPresetKey('default');
    setCustomColors(
      Object.fromEntries(LANDING_COLOR_FIELDS.map((field) => [field.key, resolved[field.key]]))
    );
    saveLandingTheme('default', null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-3 rounded-2xl border border-stone-200 bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
        <p className="text-sm text-stone-500">Loading landing theme...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <LandingCustomThemeModal
        open={customOpen}
        colors={customDraft}
        saving={saving}
        onChange={(key, value) => setCustomDraft((current) => ({ ...current, [key]: value }))}
        onClose={() => {
          if (!saving) setCustomOpen(false);
        }}
        onSave={handleSaveCustom}
      />
      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-white">
            <Palette className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-stone-900">Landing Page Theme</h3>
            <p className="mt-1 text-sm text-stone-500">
              Adjust the public landing page colors separately from the admin and office portal themes.
            </p>
            <p className="mt-1 text-xs text-stone-500">
              You can apply a preset quickly, or use manual color pickers and save a custom landing palette.
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

      <Card className="overflow-hidden border-stone-200 shadow-none">
        <div className="border-b border-stone-100 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold text-stone-900">Landing Color Controls</h4>
              <p className="mt-1 text-sm text-stone-500">
                Current mode: <span className="font-medium text-stone-700">{previewTheme.label}</span>
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl border-stone-200 text-xs"
                onClick={openCustomTheme}
                disabled={saving}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Custom Theme
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl border-stone-200 text-xs"
                onClick={handleRestoreDefault}
                disabled={saving}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Restore Default
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="space-y-5 p-5">
          <LandingThemePreview theme={previewTheme} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {presetOptions.map((preset) => {
              const isSelected = presetKey === preset.key;
              return (
                <button
                  key={`landing-${preset.key}`}
                  type="button"
                  onClick={() => handlePresetApply(preset.key)}
                  disabled={saving}
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
                        {isSelected ? 'Currently active preset.' : preset.description}
                      </p>
                    </div>
                    {isSelected ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
                  </div>

                  <div className="mt-3 flex gap-2">
                    {preset.swatches.map((color) => (
                      <span
                        key={`landing-${preset.key}-${color}`}
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
    </div>
  );
}
