import type { Lang } from './i18n/translations';

const NUMBER_LOCALE: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

export function daysBetween(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(Math.round(d), 0);
}

export function fmtDate(d?: string | null, lang: Lang = 'pt'): string {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length < 3) return d;
  const [y, m, day] = parts;
  return lang === 'en' ? `${m}/${day}/${y}` : `${day}/${m}/${y}`;
}

export function fmtMoney(v: number | null | undefined, lang: Lang = 'pt', currency: string = 'BRL'): string {
  return new Intl.NumberFormat(NUMBER_LOCALE[lang], { style: 'currency', currency }).format(Number(v || 0));
}

/** Soma valores agrupados por moeda — não dá pra somar moedas diferentes num só número. */
export function sumByCurrency(items: { amount: number; currency: string }[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const it of items) {
    totals[it.currency] = (totals[it.currency] ?? 0) + Number(it.amount || 0);
  }
  return totals;
}

export type RouteStatus = 'past' | 'current' | 'future';

export function routeStatus(route: { start_date: string | null; end_date: string | null }): RouteStatus {
  if (!route.start_date || !route.end_date) return 'future';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(route.start_date);
  const end = new Date(route.end_date);
  if (end < today) return 'past';
  if (start > today) return 'future';
  return 'current';
}

