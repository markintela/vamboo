import Link from 'next/link';
import { daysBetween, fmtDate, routeStatus } from '@/lib/dates';
import { useLanguage } from '@/lib/i18n/context';
import { Flag } from '@/components/Flag';

const PALETTE = ['#e8524b', '#ef9a3d', '#9a6fe0', '#2f9be0', '#24b8bd', '#23b287', '#79c94a', '#f0bc2e'];

interface TripCardProps {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  peopleCount: number;
  colorIndex: number;
  flags: string[];
}

export function TripCard({ id, name, startDate, endDate, peopleCount, colorIndex, flags }: TripCardProps) {
  const { lang, t } = useLanguage();
  const nights = daysBetween(startDate, endDate);
  const status = routeStatus({ start_date: startDate, end_date: endDate });
  const statusLabel = { past: t('route.statusPast'), current: t('route.statusCurrent'), future: t('route.statusFuture') }[status];
  const sizeClass = status === 'current' ? ' trip-card-featured' : status === 'past' ? ' trip-card-compact' : '';

  return (
    <Link href={`/trips/${id}`} className={'trip-card' + sizeClass}>
      <div className="stripe-top" style={{ background: PALETTE[colorIndex % PALETTE.length] }} />
      <div className="card-head">
        <div className={'trip-status trip-status-' + status}>
          <span className="trip-status-dot" />
          {statusLabel}
        </div>
        <h3>{name}</h3>
        <div className="dates">{fmtDate(startDate, lang)} — {fmtDate(endDate, lang)}</div>
      </div>
      <div className="card-body">
        {flags.length > 0 && (
          <div className="trip-flags">
            {flags.map((code, i) => <Flag key={i} code={code} size={22} />)}
          </div>
        )}
        <div className="trip-stats">
          <div className="trip-stat">{t('tripCard.nights')}<b>{nights}</b></div>
          <div className="trip-stat">{t('tripCard.people')}<b>{peopleCount}</b></div>
        </div>
      </div>
    </Link>
  );
}
