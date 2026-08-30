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

export function FinanceiroClient({ tripId, tripName, routes, transports, hotels, expenses }: {
  tripId: string;
  tripName: string;
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

  const breakdown = [
    { label: t('expensesTab.deslocamento'), totals: transportTotals, color: 'var(--blue)', rows: transportRows, icon: <Plane size={16} /> },
    { label: t('expensesTab.hoteis'), totals: hotelTotals, color: 'var(--purple)', rows: hotelRows, icon: <BedDouble size={16} /> },
    { label: t('expensesTab.gerais'), totals: geraisTotals, color: 'var(--teal-green)', rows: geraisRows, icon: <Receipt size={16} /> },
  ];

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

        <FinanceSummaryCard totalsByCurrency={tripTotals} breakdown={breakdown} />
      </div>
    </div>
  );
}

function CurrencyAmounts({ totals, lang }: { totals: Record<string, number>; lang: Lang }) {
  const entries = Object.entries(totals);
  return entries.length === 0
    ? <span>{fmtMoney(0, lang)}</span>
    : <>{entries.map(([currency, amount]) => <span key={currency}>{fmtMoney(amount, lang, currency)}</span>)}</>;
}

function FinanceSummaryCard({ totalsByCurrency, breakdown }: {
  totalsByCurrency: Record<string, number>;
  breakdown: { label: string; totals: Record<string, number>; color: string; rows: FinanceRow[]; icon: ReactNode }[];
}) {
  const { lang, t } = useLanguage();

  return (
    <div className="finance-card">
      <div className="finance-card-head">
        <div className="finance-card-categories-summary">
          {breakdown.map((b) => (
            <div className="finance-mini-chip" key={b.label} style={{ ['--item-color' as any]: b.color }}>
              <div className="finance-mini-icon">{b.icon}</div>
              <div>
                <div className="finance-mini-label">{b.label}</div>
                <div className="finance-mini-total"><CurrencyAmounts totals={b.totals} lang={lang} /></div>
              </div>
            </div>
          ))}
        </div>
        <div className="finance-mini-chip finance-total-chip" style={{ ['--item-color' as any]: 'var(--red)' }}>
          <div className="finance-mini-icon"><Wallet size={16} /></div>
          <div>
            <div className="finance-mini-label">{t('summary.totalSpent')}</div>
            <div className="finance-card-total"><CurrencyAmounts totals={totalsByCurrency} lang={lang} /></div>
          </div>
        </div>
      </div>
      <div className="finance-card-breakdown">
        {breakdown.map((b) => (
          <div className="finance-category" key={b.label} style={{ ['--item-color' as any]: b.color }}>
            <div className="finance-category-head">
              <h3><span className="finance-category-icon">{b.icon}</span>{b.label}</h3>
              <div className="finance-category-total"><CurrencyAmounts totals={b.totals} lang={lang} /></div>
            </div>
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
                  {b.rows.length === 0 ? (
                    <tr><td colSpan={4} className="finance-table-empty">{t('finance.noItems')}</td></tr>
                  ) : (
                    b.rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.description}</td>
                        <td>{r.city ?? '—'}</td>
                        <td>{fmtDate(r.date, lang)}</td>
                        <td>{fmtMoney(r.amount, lang, r.currency)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {b.rows.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={3}>{t('finance.total')}</td>
                      <td><CurrencyAmounts totals={b.totals} lang={lang} /></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
