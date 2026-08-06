import { daysBetween, fmtDate, fmtMoney } from '@/lib/dates';
import { useLanguage } from '@/lib/i18n/context';
import { Flag } from '@/components/Flag';

interface SummaryCardProps {
  startDate: string | null;
  endDate: string | null;
  peopleCount: number;
  totalsByCurrency: Record<string, number>;
  flags: string[];
}

export function SummaryCard({ startDate, endDate, peopleCount, totalsByCurrency, flags }: SummaryCardProps) {
  const { lang, t } = useLanguage();
  const nights = daysBetween(startDate, endDate);
  const totalEntries = Object.entries(totalsByCurrency);
  return (
    <div className="summary-card">
      {flags.length > 0 && (
        <div className="card-head">
          <div className="summary-flags">
            {flags.map((code, i) => <Flag key={i} code={code} size={28} />)}
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
          <div className="summary-item" style={{ ['--item-color' as any]: 'var(--green)' }}>
            <div className="label">{t('summary.people')}</div>
            <div className="value">{peopleCount}</div>
          </div>
          <div className="summary-item" style={{ ['--item-color' as any]: 'var(--orange)' }}>
            <div className="label">{t('summary.totalSpent')}</div>
            <div className={'value' + (totalEntries.length > 1 ? ' multi' : '')}>
              {totalEntries.length === 0
                ? fmtMoney(0, lang)
                : totalEntries.map(([currency, amount]) => <div key={currency}>{fmtMoney(amount, lang, currency)}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
