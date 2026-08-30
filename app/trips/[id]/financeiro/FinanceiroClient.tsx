'use client';

import type { ReactNode } from 'react';
import { Plane, BedDouble, Receipt, Wallet } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/context';
import type { Lang } from '@/lib/i18n/translations';
import { fmtDate, fmtMoney, sumByCurrency, mergeTotals } from '@/lib/dates';
import { CATEGORY_META, TRANSPORT_META } from '@/lib/expenseMeta';
import type { TripRoute } from '@/lib/types';
import type { FinanceTransportRow, FinanceHotelRow, FinanceExpenseRow } from './page';

interface FinanceRow { id: string; description: string; city: string | null; date: string | null; amount: number; currency: string }
interface FinanceCategory { label: string; totals: Record<string, number>; color: string; rows: FinanceRow[]; icon: ReactNode }

export function FinanceiroClient({ tripId, tripName, startDate, endDate, routes, transports, hotels, expenses }: {
  tripId: string;
  tripName: string;
  startDate: string | null;
  endDate: string | null;
  routes: TripRoute[];
  transports: FinanceTransportRow[];
  hotels: FinanceHotelRow[];
  expenses: FinanceExpenseRow[];
}) {
  const { t } = useLanguage();

  const gerais = expenses.filter((e) => e.category === 'comida' || e.category === 'outro');
  const transportTotals = sumByCurrency(transports);
  const hotelTotals = sumByCurrency(hotels);
  const geraisTotals = sumByCurrency(gerais);
  const tripTotals = mergeTotals(transportTotals, hotelTotals, geraisTotals);

  const cityForRoute = (routeId: string | null) => (routeId ? routes.find((r) => r.id === routeId)?.city ?? null : null);
  const transportRows: FinanceRow[] = transports.map((tr) => ({
    id: tr.id, description: tr.description || t(TRANSPORT_META[tr.transport_type].labelKey),
    city: cityForRoute(tr.route_id), date: tr.transport_date, amount: tr.amount, currency: tr.currency,
  }));
  const hotelRows: FinanceRow[] = hotels.map((h) => ({
    id: h.id, description: h.name, city: cityForRoute(h.route_id), date: h.checkin, amount: h.amount, currency: h.currency,
  }));
  const geraisRows: FinanceRow[] = gerais.map((e) => ({
    id: e.id, description: e.description || t(CATEGORY_META[e.category].labelKey),
    city: cityForRoute(e.route_id), date: e.expense_date, amount: e.amount, currency: e.currency,
  }));

  const breakdown: FinanceCategory[] = [
    { label: t('expensesTab.deslocamento'), totals: transportTotals, color: 'var(--blue)', rows: transportRows, icon: <Plane size={15} /> },
    { label: t('expensesTab.hoteis'), totals: hotelTotals, color: 'var(--purple)', rows: hotelRows, icon: <BedDouble size={15} /> },
    { label: t('expensesTab.gerais'), totals: geraisTotals, color: 'var(--teal-green)', rows: geraisRows, icon: <Receipt size={15} /> },
  ];
  const totalEntries = transportRows.length + hotelRows.length + geraisRows.length;

  return (
    <div>
      <div className="topbar topbar-centered">
        <Logo markSize={34} />
        <div className="topbar-actions">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="page">
        <a className="back-link" href={`/trips/${tripId}`}>← {tripName}</a>
        <h1 className="page-title">{t('finance.dashboardTitle')}</h1>
        <p className="page-sub">{t('finance.dashboardSubtitle')}</p>

        <ResumoHeader totalsByCurrency={tripTotals} totalEntries={totalEntries} startDate={startDate} endDate={endDate} breakdown={breakdown} />

        <div className="finance-card-breakdown finance-card-breakdown-standalone">
          {breakdown.map((b) => (
            <div className="finance-category" key={b.label} style={{ ['--item-color' as any]: b.color }}>
              <div className="finance-category-head">
                <h3><span className="finance-category-icon">{b.icon}</span>{b.label}</h3>
                <div className="finance-category-total"><CurrencyAmounts totals={b.totals} /></div>
              </div>
              <FinanceTable rows={b.rows} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CurrencyAmounts({ totals, lang }: { totals: Record<string, number>; lang?: Lang }) {
  const { lang: currentLang } = useLanguage();
  const effectiveLang = lang ?? currentLang;
  const entries = Object.entries(totals);
  return entries.length === 0
    ? <span>{fmtMoney(0, effectiveLang)}</span>
    : <>{entries.map(([currency, amount]) => <span key={currency}>{fmtMoney(amount, effectiveLang, currency)}</span>)}</>;
}

function FinanceTable({ rows }: { rows: FinanceRow[] }) {
  const { lang, t } = useLanguage();
  return (
    <div className="finance-table-wrap">
      <table className="finance-table">
        <thead>
          <tr>
            <th>{t('finance.colDescription')}</th>
            <th>{t('finance.colCity')}</th>
            <th>{t('finance.colDate')}</th>
            <th>{t('finance.colAmount')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} className="finance-table-empty">{t('finance.noItems')}</td></tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td>{r.description}</td>
                <td>{r.city ?? '—'}</td>
                <td>{fmtDate(r.date, lang)}</td>
                <td>{fmtMoney(r.amount, lang, r.currency)}</td>
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={3}>{t('finance.total')}</td>
              <td><CurrencyAmounts totals={sumByCurrency(rows)} lang={lang} /></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function ResumoHeader({ totalsByCurrency, totalEntries, startDate, endDate, breakdown }: {
  totalsByCurrency: Record<string, number>;
  totalEntries: number;
  startDate: string | null;
  endDate: string | null;
  breakdown: FinanceCategory[];
}) {
  const { lang, t } = useLanguage();
  const totalCurrencyEntries = Object.entries(totalsByCurrency);
  const catRaw = breakdown.map((b) => Object.values(b.totals).reduce((sum, v) => sum + v, 0));
  const totalRaw = catRaw.reduce((sum, v) => sum + v, 0);

  return (
    <div className="resumo-header">
      <div className="resumo-total-pane">
        <div className="resumo-eyebrow">{t('summary.totalSpent')}</div>
        <div className="resumo-total-values">
          {totalCurrencyEntries.length === 0 ? (
            <div className="resumo-total-value">{fmtMoney(0, lang)}</div>
          ) : (
            totalCurrencyEntries.map(([currency, amount]) => (
              <div key={currency}>
                <div className="resumo-total-value">{fmtMoney(amount, lang, currency)}</div>
                <div className="resumo-total-currency">{currency}</div>
              </div>
            ))
          )}
        </div>
        <div className="resumo-total-meta">
          {t('finance.entriesCount', { count: String(totalEntries) })}
          <br />
          {fmtDate(startDate, lang)} {t('summary.until')} {fmtDate(endDate, lang)}
        </div>
      </div>

      <div className="resumo-categories">
        <div className="resumo-eyebrow resumo-cats-title">{t('finance.byCategory')}</div>
        {breakdown.map((b, i) => {
          const isEmpty = catRaw[i] === 0;
          const pct = totalRaw > 0 ? Math.round((catRaw[i] / totalRaw) * 100) : 0;
          return (
            <div className="resumo-cat" key={b.label} style={{ ['--item-color' as any]: b.color }}>
              <span className="resumo-cat-icon">{b.icon}</span>
              <div className="resumo-cat-body">
                <div className="resumo-cat-row">
                  <span className="resumo-cat-name">{b.label}</span>
                  {isEmpty ? (
                    <span className="resumo-cat-amount-empty">{t('finance.noEntries')}</span>
                  ) : (
                    <span className="resumo-cat-amount"><CurrencyAmounts totals={b.totals} lang={lang} /></span>
                  )}
                </div>
                <div className="resumo-cat-bar">
                  {pct > 0 && <div className="resumo-cat-bar-fill" style={{ width: `${pct}%` }} />}
                </div>
              </div>
              <span className="resumo-cat-pct">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
