import { daysBetween, fmtDate, fmtMoney } from '@/lib/dates';

interface SummaryCardProps {
  startDate: string | null;
  endDate: string | null;
  peopleCount: number;
  total: number;
}

export function SummaryCard({ startDate, endDate, peopleCount, total }: SummaryCardProps) {
  const nights = daysBetween(startDate, endDate);
  return (
    <div className="summary-card">
      <div className="summary-item" style={{ ['--item-color' as any]: 'var(--blue)' }}>
        <div className="label">Período</div>
        <div className="value" style={{ fontSize: 15 }}>{fmtDate(startDate)} <small>até</small> {fmtDate(endDate)}</div>
      </div>
      <div className="summary-item" style={{ ['--item-color' as any]: 'var(--purple)' }}>
        <div className="label">Noites</div>
        <div className="value">{nights}</div>
      </div>
      <div className="summary-item" style={{ ['--item-color' as any]: 'var(--green)' }}>
        <div className="label">Pessoas</div>
        <div className="value">{peopleCount}</div>
      </div>
      <div className="summary-item" style={{ ['--item-color' as any]: 'var(--orange)' }}>
        <div className="label">Total gasto</div>
        <div className="value">{fmtMoney(total)}</div>
      </div>
    </div>
  );
}
