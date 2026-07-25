import type { TripRoute } from './types';
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

export function fmtMoney(v: number | null | undefined, lang: Lang = 'pt'): string {
  return new Intl.NumberFormat(NUMBER_LOCALE[lang], { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
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

function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) <= new Date(bEnd) && new Date(bStart) <= new Date(aEnd);
}

/** Retorna a rota conflitante, se a nova cidade se sobrepuser a alguma já cadastrada. */
export function findOverlap(
  existingRoutes: Pick<TripRoute, 'city' | 'start_date' | 'end_date'>[],
  candidate: { start_date: string | null; end_date: string | null }
) {
  if (!candidate.start_date || !candidate.end_date) return undefined;
  return existingRoutes.find(
    (r) =>
      r.start_date &&
      r.end_date &&
      datesOverlap(r.start_date, r.end_date, candidate.start_date as string, candidate.end_date as string)
  );
}
