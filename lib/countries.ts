import type { Lang } from './i18n/translations';

// ISO 3166-1 alpha-2 — países soberanos mais usados em seletores desse tipo.
export const COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AR', 'AT', 'AU', 'AW', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BN', 'BO', 'BR', 'BS', 'BT', 'BW', 'BY', 'BZ',
  'CA', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CY', 'CZ',
  'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ',
  'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET',
  'FI', 'FJ', 'FM', 'FR',
  'GA', 'GB', 'GD', 'GE', 'GH', 'GM', 'GN', 'GQ', 'GR', 'GT', 'GW', 'GY',
  'HK', 'HN', 'HR', 'HT', 'HU',
  'ID', 'IE', 'IL', 'IN', 'IQ', 'IR', 'IS', 'IT',
  'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KZ',
  'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
  'MA', 'MC', 'MD', 'ME', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MR', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
  'NA', 'NE', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NZ',
  'OM',
  'PA', 'PE', 'PG', 'PH', 'PK', 'PL', 'PS', 'PT', 'PW', 'PY',
  'QA',
  'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SI', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SY', 'SZ',
  'TD', 'TG', 'TH', 'TJ', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
  'UA', 'UG', 'US', 'UY', 'UZ',
  'VA', 'VC', 'VE', 'VN', 'VU',
  'WS',
  'YE',
  'ZA', 'ZM', 'ZW',
] as const;

const DISPLAY_LOCALES: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

/** Converte um código ISO (ex: "IT") na bandeira emoji correspondente (🇮🇹). */
export function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

const displayNamesCache = new Map<string, Intl.DisplayNames>();
function getDisplayNames(locale: string): Intl.DisplayNames | null {
  if (typeof Intl === 'undefined' || !('DisplayNames' in Intl)) return null;
  let dn = displayNamesCache.get(locale);
  if (!dn) {
    dn = new Intl.DisplayNames([locale], { type: 'region' });
    displayNamesCache.set(locale, dn);
  }
  return dn;
}

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

const optionsCache = new Map<Lang, CountryOption[]>();

/** Lista de países com nome localizado + bandeira, ordenada alfabeticamente. */
export function getCountryOptions(lang: Lang): CountryOption[] {
  const cached = optionsCache.get(lang);
  if (cached) return cached;

  const dn = getDisplayNames(DISPLAY_LOCALES[lang]);
  const list = COUNTRY_CODES.map((code) => ({
    code,
    name: dn?.of(code) ?? code,
    flag: countryFlag(code),
  })).sort((a, b) => a.name.localeCompare(b.name, DISPLAY_LOCALES[lang]));

  optionsCache.set(lang, list);
  return list;
}

let nameToFlagMap: Map<string, string> | null = null;

/** Acha a bandeira a partir do nome do país, testando os 3 idiomas suportados. */
export function countryNameToFlag(name: string | null | undefined): string | null {
  if (!name) return null;
  if (!nameToFlagMap) {
    nameToFlagMap = new Map();
    for (const locale of Object.values(DISPLAY_LOCALES)) {
      const dn = getDisplayNames(locale);
      if (!dn) continue;
      for (const code of COUNTRY_CODES) {
        const localizedName = dn.of(code);
        if (localizedName) nameToFlagMap.set(localizedName.toLowerCase(), countryFlag(code));
      }
    }
  }
  return nameToFlagMap.get(name.trim().toLowerCase()) ?? null;
}

/**
 * Bandeiras dos países de um roteiro, na ordem em que aparecem na viagem
 * (por data de início), sem repetir o mesmo país duas vezes.
 */
export function orderedCountryFlags(routes: { country: string; start_date?: string | null }[]): string[] {
  const sorted = [...routes].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  const seen = new Set<string>();
  const flags: string[] = [];
  for (const r of sorted) {
    const key = r.country.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const flag = countryNameToFlag(r.country);
    if (flag) flags.push(flag);
  }
  return flags;
}
