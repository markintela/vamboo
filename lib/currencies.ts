import type { Lang } from './i18n/translations';

// ISO 4217 — moedas mais comuns em contexto de viagem (não a lista
// completa de ~170 códigos, pra não virar um select gigante).
export const CURRENCY_CODES = [
  'BRL', 'USD', 'EUR', 'GBP',
  'ARS', 'CLP', 'UYU', 'PYG', 'BOB', 'PEN', 'COP', 'MXN',
  'CAD', 'JPY', 'CNY', 'CHF', 'AUD', 'NZD',
  'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY',
  'ZAR', 'INR', 'THB', 'SGD', 'HKD', 'KRW', 'AED', 'ILS', 'EGP', 'MAD',
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

const DISPLAY_LOCALES: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

const displayNamesCache = new Map<string, Intl.DisplayNames>();
function getDisplayNames(locale: string): Intl.DisplayNames | null {
  if (typeof Intl === 'undefined' || !('DisplayNames' in Intl)) return null;
  let dn = displayNamesCache.get(locale);
  if (!dn) {
    dn = new Intl.DisplayNames([locale], { type: 'currency' });
    displayNamesCache.set(locale, dn);
  }
  return dn;
}

export interface CurrencyOption {
  code: string;
  label: string;
}

const optionsCache = new Map<Lang, CurrencyOption[]>();

/** Lista de moedas com nome localizado, ordenada com BRL/USD/EUR/GBP primeiro. */
export function getCurrencyOptions(lang: Lang): CurrencyOption[] {
  const cached = optionsCache.get(lang);
  if (cached) return cached;

  const dn = getDisplayNames(DISPLAY_LOCALES[lang]);
  const priority = ['BRL', 'USD', 'EUR', 'GBP'];
  const rest = CURRENCY_CODES.filter((c) => !priority.includes(c)).slice().sort((a, b) => {
    const nameA = dn?.of(a) ?? a;
    const nameB = dn?.of(b) ?? b;
    return nameA.localeCompare(nameB, DISPLAY_LOCALES[lang]);
  });

  const list = [...priority, ...rest].map((code) => ({
    code,
    label: `${code} — ${dn?.of(code) ?? code}`,
  }));

  optionsCache.set(lang, list);
  return list;
}
