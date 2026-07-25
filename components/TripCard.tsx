import Link from 'next/link';
import { daysBetween, fmtDate, fmtMoney } from '@/lib/dates';
import { useLanguage } from '@/lib/i18n/context';

const PALETTE = ['#e8524b', '#ef9a3d', '#9a6fe0', '#2f9be0', '#24b8bd', '#23b287', '#79c94a', '#f0bc2e'];

interface TripCardProps {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  peopleCount: number;
  total: number;
  colorIndex: number;
}

export function TripCard({ id, name, startDate, endDate, peopleCount, total, colorIndex }: TripCardProps) {
  const { lang, t } = useLanguage();
  const nights = daysBetween(startDate, endDate);
  return (
    <Link href={`/trips/${id}`} className="trip-card">
      <div className="stripe-top" style={{ background: PALETTE[colorIndex % PALETTE.length] }} />
      <div className="trip-card-body">
        <h3>{name}</h3>
        <div className="dates">{fmtDate(startDate, lang)} — {fmtDate(endDate, lang)}</div>
        <div className="trip-stats">
          <div className="trip-stat">{t('tripCard.nights')}<b>{nights}</b></div>
          <div className="trip-stat">{t('tripCard.people')}<b>{peopleCount}</b></div>
          <div className="trip-stat">{t('tripCard.spent')}<b>{fmtMoney(total, lang)}</b></div>
        </div>
      </div>
    </Link>
  );
}
