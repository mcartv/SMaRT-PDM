export const LANDING_THEME_PRESET_KEYS = ['default', 'forest', 'ocean', 'royal', 'sunset', 'coral', 'mint', 'custom'];

const DEFAULT_LANDING_THEME = {
  presetKey: 'default',
  label: 'Default',
  dark: '#56321f',
  base: '#7c4a2e',
  heroEnd: '#8a5a38',
  soft: '#f7f1e9',
  border: '#e9dcc8',
  pageBg: '#f8f5f1',
};

const LANDING_PRESET_OVERRIDES = {
  forest: {
    label: 'Forest',
    dark: '#1f4037',
    base: '#2f6b59',
    heroEnd: '#3f8b70',
    soft: '#edf7f3',
    border: '#cfe8dd',
    pageBg: '#f5faf7',
  },
  ocean: {
    label: 'Ocean',
    dark: '#1d4e69',
    base: '#246f94',
    heroEnd: '#3297bf',
    soft: '#eef7fb',
    border: '#d3e6f0',
    pageBg: '#f5fafc',
  },
  royal: {
    label: 'Royal',
    dark: '#452c63',
    base: '#65468f',
    heroEnd: '#8464b4',
    soft: '#f3eef9',
    border: '#ddd2ee',
    pageBg: '#f8f5fb',
  },
  sunset: {
    label: 'Sunset',
    dark: '#6b2d20',
    base: '#a3472b',
    heroEnd: '#d67a35',
    soft: '#fbf0e8',
    border: '#efd5c2',
    pageBg: '#fcf6f1',
  },
  coral: {
    label: 'Coral',
    dark: '#7b3245',
    base: '#c8556a',
    heroEnd: '#f08a6d',
    soft: '#fff1ee',
    border: '#f4d2cb',
    pageBg: '#fff8f6',
  },
  mint: {
    label: 'Mint',
    dark: '#24534a',
    base: '#2f7f73',
    heroEnd: '#54b8a5',
    soft: '#eefaf6',
    border: '#d0ece3',
    pageBg: '#f7fcfa',
  },
};

export const LANDING_COLOR_FIELDS = [
  { key: 'dark', label: 'Hero Start' },
  { key: 'base', label: 'Hero Middle' },
  { key: 'heroEnd', label: 'Hero End' },
  { key: 'soft', label: 'Soft Surface' },
  { key: 'border', label: 'Border' },
  { key: 'pageBg', label: 'Page Background' },
];

export function getDefaultLandingTheme() {
  return { ...DEFAULT_LANDING_THEME };
}

export function resolveLandingTheme(presetKey = 'default', customColors = null) {
  const normalizedPreset = String(presetKey || 'default').trim().toLowerCase();
  const preset =
    normalizedPreset === 'custom'
      ? { label: 'Custom' }
      : LANDING_PRESET_OVERRIDES[normalizedPreset] || {};

  return {
    ...DEFAULT_LANDING_THEME,
    ...preset,
    ...(customColors && typeof customColors === 'object' ? customColors : {}),
    presetKey: normalizedPreset,
  };
}

export function getLandingThemePresetOptions() {
  return LANDING_THEME_PRESET_KEYS.filter((key) => key !== 'custom').map((key) => {
    const theme = resolveLandingTheme(key);
    return {
      key,
      label: theme.label,
      description:
        key === 'default'
          ? 'Restore the current default landing page colors.'
          : `Apply the ${theme.label.toLowerCase()} landing palette.`,
      swatches: [theme.dark, theme.base, theme.heroEnd, theme.soft],
    };
  });
}
