import { daysBetween, fmtDate, fmtMoney } from '@/lib/dates';
import { useLanguage } from '@/lib/i18n/context';

interface SummaryCardProps {
  startDate: string | null;
  endDate: string | null;
  peopleCount: number;
  total: number;
  flags: string[];
}

export function SummaryCard({ startDate, endDate, peopleCount, total, flags }: SummaryCardProps) {
  const { lang, t } = useLanguage();
  const nights = daysBetween(startDate, endDate);
  return (
    <div className="summary-card">
      {flags.length > 0 && (
        <div className="summary-flags">
          {flags.map((f, i) => <span key={i}>{f}</span>)}
        </div>
      )}
      <div className="summary-item" style={{ ['--item-color' as any]: 'var(--blue)' }}>
        <div className="label">{t('summary.period')}</div>
        <div className="value" style={{ fontSize: 15 }}>{fmtDate(startDate, lang)} <small>{t('summary.until')}</small> {fmtDate(endDate, lang)}</div>
      </div>
      <div className="summary-item" style={{ ['--item-color' as any]: 'var(--purple)' }}>
        <div className="label">{t('summary.nights')}</div>
        <div className="value">{nights}</div>
      </div>
      <div className="summary-item" style={{ ['--item-color' as any]: 'var(--green)' }}>
        <div className="label">{t('summary.people')}</div>
        <div className="value">{peopleCount}</div>
      </div>
      <div className="summary-item" style={{ ['--item-color' as any]: 'var(--orange)' }}>
        <div className="label">{t('summary.totalSpent')}</div>
        <div className="value">{fmtMoney(total, lang)}</div>
      </div>
    </div>
  );
}
