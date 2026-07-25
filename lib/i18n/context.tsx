'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translations, DEFAULT_LANG, type Lang } from './translations';

const STORAGE_KEY = 'vamboo_lang';

function resolveInitialLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'pt' || stored === 'en' || stored === 'es') return stored;
  const browserLang = window.navigator.language.slice(0, 2);
  if (browserLang === 'en' || browserLang === 'es') return browserLang;
  return DEFAULT_LANG;
}

function lookup(lang: Lang, key: string): string | undefined {
  const parts = key.split('.');
  let node: unknown = translations[lang];
  for (const part of parts) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

type Vars = Record<string, string | number>;

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Vars) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    setLangState(resolveInitialLang());
  }, []);

  function setLang(next: Lang) {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  const t = useMemo(() => {
    return (key: string, vars?: Vars) => {
      const template = lookup(lang, key) ?? lookup(DEFAULT_LANG, key) ?? key;
      if (!vars) return template;
      return template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars[name] ?? ''));
    };
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage precisa estar dentro de <LanguageProvider>.');
  return ctx;
}
