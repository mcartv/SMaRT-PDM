export const THEME_PRESET_KEYS = ['default', 'forest', 'ocean', 'royal', 'sunset', 'slate'];

const DEFAULT_THEMES = {
  admin: {
    presetKey: 'default',
    label: 'Default',
    base: '#7c4a2e',
    text: '#f0d9c8',
    sub: '#d4a98a',
    active: '#936244',
    mainBg: '#faf7f2',
    accent: '#fbbf24',
    accentSoft: '#fff4cc',
    chartPrimary: '#7c4a2e',
    chartSecondary: '#fbbf24',
    chartTertiary: '#d97706',
    chartQuaternary: '#92500f',
    chartPositive: '#16a34a',
    chartNegative: '#dc2626',
  },
  sdo: {
    presetKey: 'default',
    label: 'Default',
    base: '#2e4b43',
    text: '#ecfdf5',
    sub: '#a7f3d0',
    active: '#3f655b',
    mainBg: '#f6f8f7',
    accent: '#16a34a',
    accentSoft: '#dcfce7',
    chartPrimary: '#2e4b43',
    chartSecondary: '#16a34a',
    chartTertiary: '#65a30d',
    chartQuaternary: '#0f766e',
    chartPositive: '#15803d',
    chartNegative: '#dc2626',
  },
  guidance: {
    presetKey: 'default',
    label: 'Default',
    base: '#1f4e79',
    text: '#e0f2fe',
    sub: '#93c5fd',
    active: '#2f6fa3',
    mainBg: '#f4f8fb',
    accent: '#38bdf8',
    accentSoft: '#e0f2fe',
    chartPrimary: '#1f4e79',
    chartSecondary: '#38bdf8',
    chartTertiary: '#2563eb',
    chartQuaternary: '#0f766e',
    chartPositive: '#16a34a',
    chartNegative: '#dc2626',
  },
  pd: {
    presetKey: 'default',
    label: 'Default',
    base: '#5f3d8a',
    text: '#f3e8ff',
    sub: '#d8b4fe',
    active: '#7652a3',
    mainBg: '#f8f5fb',
    accent: '#c084fc',
    accentSoft: '#f3e8ff',
    chartPrimary: '#5f3d8a',
    chartSecondary: '#c084fc',
    chartTertiary: '#7c3aed',
    chartQuaternary: '#ec4899',
    chartPositive: '#16a34a',
    chartNegative: '#dc2626',
  },
};

const PRESET_OVERRIDES = {
  forest: {
    label: 'Forest',
    base: '#2f5d50',
    text: '#e9fff7',
    sub: '#b8e6d2',
    active: '#3f7767',
    mainBg: '#f4faf7',
    accent: '#2fb36f',
    accentSoft: '#dff8eb',
    chartPrimary: '#2f5d50',
    chartSecondary: '#2fb36f',
    chartTertiary: '#84cc16',
    chartQuaternary: '#0f766e',
  },
  ocean: {
    label: 'Ocean',
    base: '#215a86',
    text: '#ecf8ff',
    sub: '#b7dbf4',
    active: '#2f74a8',
    mainBg: '#f3f9fd',
    accent: '#38bdf8',
    accentSoft: '#e0f2fe',
    chartPrimary: '#215a86',
    chartSecondary: '#38bdf8',
    chartTertiary: '#0ea5e9',
    chartQuaternary: '#14b8a6',
  },
  royal: {
    label: 'Royal',
    base: '#5d3b8c',
    text: '#f6edff',
    sub: '#dcc2ff',
    active: '#7755a8',
    mainBg: '#f9f5ff',
    accent: '#c084fc',
    accentSoft: '#f3e8ff',
    chartPrimary: '#5d3b8c',
    chartSecondary: '#c084fc',
    chartTertiary: '#8b5cf6',
    chartQuaternary: '#ec4899',
  },
  sunset: {
    label: 'Sunset',
    base: '#8a4a2f',
    text: '#fff2e8',
    sub: '#f4c6a3',
    active: '#a86142',
    mainBg: '#fff8f4',
    accent: '#f97316',
    accentSoft: '#ffedd5',
    chartPrimary: '#8a4a2f',
    chartSecondary: '#f97316',
    chartTertiary: '#fb7185',
    chartQuaternary: '#f59e0b',
  },
  slate: {
    label: 'Slate',
    base: '#334155',
    text: '#f8fafc',
    sub: '#cbd5e1',
    active: '#475569',
    mainBg: '#f8fafc',
    accent: '#64748b',
    accentSoft: '#e2e8f0',
    chartPrimary: '#334155',
    chartSecondary: '#64748b',
    chartTertiary: '#94a3b8',
    chartQuaternary: '#0f766e',
  },
};

export function getPortalDefaultTheme(portalKey) {
  return DEFAULT_THEMES[portalKey] || DEFAULT_THEMES.admin;
}

export function resolvePortalTheme(portalKey, presetKey = 'default') {
  const normalizedPortal = String(portalKey || 'admin').trim().toLowerCase();
  const normalizedPreset = String(presetKey || 'default').trim().toLowerCase();
  const fallback = getPortalDefaultTheme(normalizedPortal);

  if (normalizedPreset === 'default' || !PRESET_OVERRIDES[normalizedPreset]) {
    return {
      ...fallback,
      presetKey: 'default',
      label: 'Default',
    };
  }

  const preset = PRESET_OVERRIDES[normalizedPreset];
  return {
    ...fallback,
    ...preset,
    presetKey: normalizedPreset,
  };
}

export function getThemePresetOptions() {
  return THEME_PRESET_KEYS.map((presetKey) => {
    const sample = resolvePortalTheme('admin', presetKey);
    return {
      key: presetKey,
      label: sample.label,
      description:
        presetKey === 'default'
          ? 'Use the original portal colors.'
          : `Apply the ${sample.label.toLowerCase()} color preset.`,
      swatches: [sample.base, sample.accent, sample.chartSecondary, sample.chartQuaternary],
    };
  });
}

export function buildMaintenancePalette(theme) {
  return {
    base: theme.base,
    accent: theme.active,
    bg: theme.mainBg,
    toggleClass: 'text-stone-700',
    infoBox: 'border-stone-200 bg-white text-stone-800',
  };
}
