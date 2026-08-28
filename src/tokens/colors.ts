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
  gold: '#C9A84C',
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
  gold: palette.gold,
  border: palette.borderLight,
  card: palette.white,
  tabBar: palette.parchmentDark,
  tabBarActive: palette.crimson,
  tabBarInactive: palette.inkLight,
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
  gold: palette.goldLight,
  border: palette.borderDark,
  card: palette.charcoalMid,
  tabBar: palette.charcoalMid,
  tabBarActive: palette.crimsonDark,
  tabBarInactive: '#8B7355',
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
  gold: string;
  border: string;
  card: string;
  tabBar: string;
  tabBarActive: string;
  tabBarInactive: string;
  danger: string;
  success: string;
};
