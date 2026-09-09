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

// Nome do dia da semana a partir de uma data 'YYYY-MM-DD' — monta a
// data com componentes locais (não `new Date(string)`) pra não sofrer
// o desvio de fuso horário que empurra a data pro dia anterior.
export function fmtWeekday(d?: string | null, lang: Lang = 'pt'): string {
  if (!d) return '';
  const parts = d.split('-').map(Number);
  if (parts.length < 3) return '';
  const [y, m, day] = parts;
  const date = new Date(y, m - 1, day);
  const name = date.toLocaleDateString(NUMBER_LOCALE[lang], { weekday: 'long' });
  return name.charAt(0).toUpperCase() + name.slice(1);
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

/** Combina vários totais por moeda (ex: deslocamento + hotéis + gerais) num só. */
export function mergeTotals(...groups: Record<string, number>[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const g of groups) {
    for (const [currency, amount] of Object.entries(g)) {
      merged[currency] = (merged[currency] ?? 0) + amount;
    }
  }
  return merged;
}

export function fmtTime(t?: string | null): string {
  if (!t) return '';
  return t.slice(0, 5);
}

export type DayPeriod = 'morning' | 'afternoon' | 'night';

// Faixas de horário que definem o período do dia de um compromisso
// planejado (lugar para visitar): manhã 05h–12h, tarde 12h–18h, o
// resto (18h–05h) é noite.
export function dayPeriod(time?: string | null): DayPeriod | null {
  if (!time) return null;
  const hour = Number(time.slice(0, 2));
  if (Number.isNaN(hour)) return null;
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
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

