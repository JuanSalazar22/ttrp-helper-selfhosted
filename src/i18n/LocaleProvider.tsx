import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { en } from './en';
import { es } from './es';
import { translate } from './translate';
import type { Locale, TKey, TParams } from './types';

const DICTS: Record<Locale, unknown> = { en, es };

export type TFunc = (key: TKey, params?: TParams) => string;

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: TFunc };
const LocaleCtx = createContext<Ctx | null>(null);

export function LocaleProvider({
  children,
  onLocaleChange,
}: {
  children: ReactNode;
  onLocaleChange?: (l: Locale) => void;
}) {
  const [locale, setLocaleState] = useState<Locale>('en');

  const setLocale = useCallback(
    (l: Locale) => {
      if (l !== 'en' && l !== 'es') return; // ignore unknown values
      setLocaleState(l);
      onLocaleChange?.(l);
    },
    [onLocaleChange],
  );

  const t = useMemo<TFunc>(
    () => (key, params) => translate(DICTS[locale], en, key, params),
    [locale],
  );

  return <LocaleCtx.Provider value={{ locale, setLocale, t }}>{children}</LocaleCtx.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleCtx);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}

export function useTranslation(): TFunc {
  const ctx = useContext(LocaleCtx);
  if (!ctx) throw new Error('useTranslation must be used within LocaleProvider');
  return ctx.t;
}
