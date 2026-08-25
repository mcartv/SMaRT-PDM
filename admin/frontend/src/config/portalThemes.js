export const THEME_PRESET_KEYS = [
  'default',
  'midnight',
  'coral',
  'mint',
  'emerald',
  'arctic',
  'sunset',
  'lavender',
  'golden',
  'rose',
  'slate',
  'ocean',
  'forest',
  'crimson',
  'royal',
];

const DEFAULT_THEMES = {
  admin: {
    presetKey: 'default',
    label: 'Default',
    base: '#6f4b33',
    text: '#f8efe8',
    sub: '#dbc1af',
    active: '#8b6247',
    mainBg: '#f8f4ee',
    accent: '#d9a441',
    accentSoft: '#f9ebc8',
    chartPrimary: '#6f4b33',
    chartSecondary: '#d9a441',
    chartTertiary: '#c57b57',
    chartQuaternary: '#8d5a44',
    chartPositive: '#16a34a',
    chartNegative: '#dc2626',
  },
  sdo: {
    presetKey: 'default',
    label: 'Default',
    base: '#28463e',
    text: '#ecfdf5',
    sub: '#b7e4d0',
    active: '#376157',
    mainBg: '#f4f8f6',
    accent: '#3da46f',
    accentSoft: '#def5e8',
    chartPrimary: '#28463e',
    chartSecondary: '#3da46f',
    chartTertiary: '#7dbb55',
    chartQuaternary: '#23867a',
    chartPositive: '#15803d',
    chartNegative: '#dc2626',
  },
  guidance: {
    presetKey: 'default',
    label: 'Default',
    base: '#234d74',
    text: '#ebf6ff',
    sub: '#a8caec',
    active: '#2f698f',
    mainBg: '#f3f8fc',
    accent: '#43a7df',
    accentSoft: '#dff1fd',
    chartPrimary: '#234d74',
    chartSecondary: '#43a7df',
    chartTertiary: '#5878d8',
    chartQuaternary: '#4ba39a',
    chartPositive: '#16a34a',
    chartNegative: '#dc2626',
  },
  pd: {
    presetKey: 'default',
    label: 'Default',
    base: '#5b4179',
    text: '#f6efff',
    sub: '#d9c5f2',
    active: '#725696',
    mainBg: '#f7f3fb',
    accent: '#a77ee6',
    accentSoft: '#efe5fb',
    chartPrimary: '#5b4179',
    chartSecondary: '#a77ee6',
    chartTertiary: '#7c5ac9',
    chartQuaternary: '#d27eb6',
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
    base: '#6b2d5c',
    text: '#fff4fb',
    sub: '#f9a8d4',
    active: '#874174',
    mainBg: '#fff7fb',
    accent: '#ff7b54',
    accentSoft: '#ffe4dc',
    chartPrimary: '#6b2d5c',
    chartSecondary: '#ff7b54',
    chartTertiary: '#ffb703',
    chartQuaternary: '#fb8500',
  },
  slate: {
    label: 'Slate',
    base: '#22333b',
    text: '#f4f7f5',
    sub: '#c6d8d3',
    active: '#2f4858',
    mainBg: '#f7faf9',
    accent: '#5e6472',
    accentSoft: '#e8ecef',
    chartPrimary: '#22333b',
    chartSecondary: '#5e6472',
    chartTertiary: '#a7bcb9',
    chartQuaternary: '#7d98a1',
  },
  rose: {
    label: 'Rose',
    base: '#7f1d4e',
    text: '#fff6fb',
    sub: '#f5b0cb',
    active: '#9d3568',
    mainBg: '#fff8fc',
    accent: '#e85d75',
    accentSoft: '#ffe3eb',
    chartPrimary: '#7f1d4e',
    chartSecondary: '#e85d75',
    chartTertiary: '#ff8fab',
    chartQuaternary: '#ffc2d1',
  },
  midnight: {
    label: 'Midnight',
    base: '#111827',
    text: '#eef2ff',
    sub: '#a5b4fc',
    active: '#1f2937',
    mainBg: '#f4f6fb',
    accent: '#8b5cf6',
    accentSoft: '#ede9fe',
    chartPrimary: '#111827',
    chartSecondary: '#8b5cf6',
    chartTertiary: '#38bdf8',
    chartQuaternary: '#22c55e',
  },
  emerald: {
    label: 'Emerald',
    base: '#14532d',
    text: '#f0fdf4',
    sub: '#86efac',
    active: '#1b6b3a',
    mainBg: '#f6fcf7',
    accent: '#2ec4b6',
    accentSoft: '#dcf7f4',
    chartPrimary: '#14532d',
    chartSecondary: '#2ec4b6',
    chartTertiary: '#84cc16',
    chartQuaternary: '#22c55e',
  },
  crimson: {
    label: 'Crimson',
    base: '#641220',
    text: '#fff5f5',
    sub: '#f7cad0',
    active: '#7f1d2d',
    mainBg: '#fff8f8',
    accent: '#c1121f',
    accentSoft: '#fde2e4',
    chartPrimary: '#641220',
    chartSecondary: '#c1121f',
    chartTertiary: '#e5383b',
    chartQuaternary: '#f28482',
  },
  golden: {
    label: 'Golden',
    base: '#6f4e37',
    text: '#fffaf0',
    sub: '#f4d58d',
    active: '#8a6246',
    mainBg: '#fffaf5',
    accent: '#e09f3e',
    accentSoft: '#fff0d1',
    chartPrimary: '#6f4e37',
    chartSecondary: '#e09f3e',
    chartTertiary: '#f2cc8f',
    chartQuaternary: '#9c6644',
  },
  lavender: {
    label: 'Lavender',
    base: '#5a189a',
    text: '#faf5ff',
    sub: '#d8b4fe',
    active: '#7b2cbf',
    mainBg: '#fcf8ff',
    accent: '#4cc9f0',
    accentSoft: '#e0f7ff',
    chartPrimary: '#5a189a',
    chartSecondary: '#4cc9f0',
    chartTertiary: '#c77dff',
    chartQuaternary: '#9d4edd',
  },
  arctic: {
    label: 'Arctic',
    base: '#264653',
    text: '#f1fbff',
    sub: '#b8f2e6',
    active: '#2f6070',
    mainBg: '#f5fcfd',
    accent: '#2a9d8f',
    accentSoft: '#daf4f0',
    chartPrimary: '#264653',
    chartSecondary: '#2a9d8f',
    chartTertiary: '#8ecae6',
    chartQuaternary: '#219ebc',
  },
  coral: {
    label: 'Coral',
    base: '#355070',
    text: '#fff8f2',
    sub: '#eaac8b',
    active: '#4f6d8c',
    mainBg: '#fffaf7',
    accent: '#e56b6f',
    accentSoft: '#ffe5e5',
    chartPrimary: '#355070',
    chartSecondary: '#e56b6f',
    chartTertiary: '#eaac8b',
    chartQuaternary: '#b56576',
  },
  mint: {
    label: 'Mint',
    base: '#2b2d42',
    text: '#f4fff9',
    sub: '#95d5b2',
    active: '#3d405b',
    mainBg: '#f7fffb',
    accent: '#40916c',
    accentSoft: '#d8f3dc',
    chartPrimary: '#2b2d42',
    chartSecondary: '#40916c',
    chartTertiary: '#74c69d',
    chartQuaternary: '#52b788',
  },
};

export function getPortalDefaultTheme(portalKey) {
  return DEFAULT_THEMES[portalKey] || DEFAULT_THEMES.admin;
}

function readableTextColor(hexColor) {
  const value = String(hexColor || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return '#ffffff';
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.58 ? '#1c1917' : '#ffffff';
}

export function resolvePortalTheme(portalKey, presetKey = 'default', customColors = null) {
  const normalizedPortal = String(portalKey || 'admin').trim().toLowerCase();
  const normalizedPreset = String(presetKey || 'default').trim().toLowerCase();
  const fallback = getPortalDefaultTheme(normalizedPortal);

  if (normalizedPreset === 'custom' && customColors && typeof customColors === 'object') {
    return {
      ...fallback,
      ...customColors,
      text: readableTextColor(customColors.base || fallback.base),
      sub: readableTextColor(customColors.base || fallback.base),
      chartPositive: fallback.chartPositive,
      chartNegative: fallback.chartNegative,
      presetKey: 'custom',
      label: 'Custom',
    };
  }

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
          : `Apply the ${sample.label.toLowerCase()} preset across layouts, cards, and charts.`,
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
