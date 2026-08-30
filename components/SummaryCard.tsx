import { daysBetween, fmtDate } from '@/lib/dates';
import { useLanguage } from '@/lib/i18n/context';
import { Flag } from '@/components/Flag';

interface SummaryCardProps {
  startDate: string | null;
  endDate: string | null;
  flags: string[];
}

export function SummaryCard({ startDate, endDate, flags }: SummaryCardProps) {
  const { lang, t } = useLanguage();
  const nights = daysBetween(startDate, endDate);
  return (
    <div className="summary-card summary-card-compact">
      {flags.length > 0 && (
        <div className="card-head">
          <div className="summary-flags">
            {flags.map((code, i) => <Flag key={i} code={code} size={22} />)}
          </div>
        </div>
      )}
      <div className="card-body">
        <div className="summary-grid">
          <div className="summary-item" style={{ ['--item-color' as any]: 'var(--blue)' }}>
            <div className="label">{t('summary.period')}</div>
            <div className="value" style={{ fontSize: 15 }}>{fmtDate(startDate, lang)} <small>{t('summary.until')}</small> {fmtDate(endDate, lang)}</div>
          </div>
          <div className="summary-item" style={{ ['--item-color' as any]: 'var(--purple)' }}>
            <div className="label">{t('summary.nights')}</div>
            <div className="value">{nights}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
