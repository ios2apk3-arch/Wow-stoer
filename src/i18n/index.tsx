import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionary } from "./dictionary";
import type { I18nText, Locale } from "../platform/types";

const STORAGE_KEY = "waw.locale";

interface I18nValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  d: typeof dictionary;
  /** Resolve an I18nText from data. */
  t: (text: I18nText | { readonly ar: string; readonly en: string }) => string;
  /** Format a number in the active locale. */
  n: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Format money with the SAR-first convention used across the platform. */
  money: (value: number, currency?: string) => string;
  date: (iso: string, options?: Intl.DateTimeFormatOptions) => string;
  relative: (iso: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof localStorage === "undefined") return "ar";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "en" ? "en" : "ar";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);
  const dir = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Storage unavailable — the choice simply won't persist.
    }
  }, [locale, dir]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);
  const toggleLocale = useCallback(() => setLocaleState((l) => (l === "ar" ? "en" : "ar")), []);

  const value = useMemo<I18nValue>(() => {
    const numberLocale = locale === "ar" ? "ar-SA-u-nu-latn" : "en-US";
    return {
      locale,
      dir,
      setLocale,
      toggleLocale,
      d: dictionary,
      t: (text) => (text ? text[locale] : ""),
      n: (value, options) => new Intl.NumberFormat(numberLocale, options).format(value),
      money: (value, currency = "SAR") => {
        const formatted = new Intl.NumberFormat(numberLocale, {
          minimumFractionDigits: value % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(value);
        const symbol = locale === "ar" ? (currency === "SAR" ? "ر.س" : currency) : currency;
        return locale === "ar" ? `${formatted} ${symbol}` : `${symbol} ${formatted}`;
      },
      date: (iso, options) =>
        new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          ...options,
        }).format(new Date(iso)),
      relative: (iso) => {
        const diffDays = Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
        if (diffDays <= 0) return dictionary.common.today[locale];
        if (diffDays === 1) return dictionary.common.yesterday[locale];
        return dictionary.common.daysAgo[locale].replace("{n}", String(diffDays));
      },
    };
  }, [locale, dir, setLocale, toggleLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
