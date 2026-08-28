import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { light, dark, type ColorScheme } from '../tokens/colors';
import { spacing, radius, shadow } from '../tokens/spacing';
import { fontSize, fontWeight, textStyle, fontFamily } from '../tokens/typography';

export type ThemeMode = 'system' | 'light' | 'dark';

export type Theme = {
  colors: ColorScheme;
  spacing: typeof spacing;
  radius: typeof radius;
  shadow: typeof shadow;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  textStyle: typeof textStyle;
  fontFamily: typeof fontFamily;
  isDark: boolean;
};

function buildTheme(isDark: boolean): Theme {
  return { colors: isDark ? dark : light, spacing, radius, shadow, fontSize, fontWeight, textStyle, fontFamily, isDark };
}

type Ctx = { mode: ThemeMode; setMode: (m: ThemeMode) => void; isDark: boolean };
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children, onModeChange }: { children: ReactNode; onModeChange?: (m: ThemeMode) => void }) {
  const scheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    onModeChange?.(m);
  }, [onModeChange]);
  const isDark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
  return <ThemeCtx.Provider value={{ mode, setMode, isDark }}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeCtx);
  const scheme = useColorScheme();
  return buildTheme(ctx ? ctx.isDark : scheme === 'dark');
}

export function useThemeMode() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return { mode: ctx.mode, setMode: ctx.setMode };
}
