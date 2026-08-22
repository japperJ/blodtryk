"use client";
// i18n (#24): React-context omkring src/lib/i18n.ts.
// SSR og første klient-render bruger ALTID dansk (ingen hydration-mismatch);
// efter mount læses gemt sprog / browser-sprog og teksten skiftes — samme
// mønster som tema-init-scriptet i layout.tsx.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  autoVars,
  detectLocale,
  translate,
  translateError,
  type Locale,
} from "./i18n";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Oversæt nøgle; ukendte nøgler vises som sig selv (fallback fra API-fejlkoder). */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Oversæt en fejlkode fra API'en ("invalidSystolic" → "Ugyldigt systolisk..."). */
  tError: (code: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("da");

  // Efter mount: genfind valgt sprog (localStorage → browser-sprog → dansk)
  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);

  // Hold <html lang> synkroniseret (a11y + korrekt font/hyphenation)
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem("lang", next);
    } catch {
      /* localStorage kan være blokeret */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(locale, key, { ...autoVars(), ...vars }),
    [locale]
  );

  const tError = useCallback(
    (code: string, vars?: Record<string, string | number>) =>
      translateError(locale, code, { ...autoVars(), ...vars }),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, tError }),
    [locale, setLocale, t, tError]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Adgang til aktivt sprog + oversætter-funktion. Kræver I18nProvider i træet. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n skal bruges inden for I18nProvider");
  return ctx;
}
