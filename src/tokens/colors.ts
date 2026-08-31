export const palette = {
  // Warm parchment light
  parchment: '#F5EDD6',
  parchmentDark: '#EDE0C4',
  inkBrown: '#2C1810',
  inkMid: '#5C3D2E',
  inkLight: '#8B6E5A',

  // Deep dark mode
  charcoal: '#1A1612',
  charcoalMid: '#2A2420',
  charcoalLight: '#3A3430',

  // Accents
  crimson: '#8B1A1A',
  crimsonDark: '#C0392B',
  crimsonDarkFg: '#D3746B',
  gold: '#C9A84C',
  goldText: '#75612C',
  goldLight: '#E8C96A',

  // System
  white: '#FFFFFF',
  black: '#000000',
  danger: '#C0392B',
  success: '#2D6A4F',
  warning: '#E8C96A',

  // Overlays / borders
  borderLight: 'rgba(44,24,16,0.15)',
  borderDark: 'rgba(232,213,176,0.15)',
} as const;

export const light = {
  background: palette.parchment,
  backgroundSecondary: palette.parchmentDark,
  text: palette.inkBrown,
  textSecondary: palette.inkMid,
  textMuted: '#74543C',
  accent: palette.crimson,
  accentText: palette.white,
  // Text-safe variant of `accent`/`gold` — use for text and inline labels.
  // `accent`/`gold` themselves are for backgrounds, borders, and icons, where
  // WCAG's looser 3:1 non-text threshold applies instead of 4.5:1.
  accentFg: palette.crimson,
  gold: palette.gold,
  goldText: palette.goldText,
  border: palette.borderLight,
  card: palette.white,
  tabBar: palette.parchmentDark,
  tabBarActive: palette.crimson,
  tabBarInactive: '#6F5848',
  danger: palette.danger,
  success: palette.success,
} as const;

export const dark = {
  background: palette.charcoal,
  backgroundSecondary: palette.charcoalMid,
  text: '#E8D5B0',
  textSecondary: '#C4A882',
  textMuted: '#A38A6A',
  accent: palette.crimsonDark,
  accentText: palette.white,
  // Lighter than `accent` — `accent` at 3.31:1 on this theme's dark
  // backgrounds only clears WCAG's non-text 3:1 threshold (fine for
  // backgrounds/borders/icons), not the 4.5:1 text needs.
  accentFg: palette.crimsonDarkFg,
  gold: palette.goldLight,
  goldText: palette.goldLight,
  border: palette.borderDark,
  card: palette.charcoalMid,
  tabBar: palette.charcoalMid,
  tabBarActive: palette.crimsonDark,
  tabBarInactive: '#A28F77',
  danger: palette.crimsonDark,
  success: '#52B788',
} as const;

export type ColorScheme = {
  background: string;
  backgroundSecondary: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  accentFg: string;
  gold: string;
  goldText: string;
  border: string;
  card: string;
  tabBar: string;
  tabBarActive: string;
  tabBarInactive: string;
  danger: string;
  success: string;
};
