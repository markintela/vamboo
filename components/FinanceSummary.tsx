'use client';

import type { ReactNode } from 'react';
import { Plane, Receipt } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/context';
import type { Lang } from '@/lib/i18n/translations';
import { fmtDate, fmtMoney, sumByCurrency, mergeTotals } from '@/lib/dates';
import type { TripTransport, Expense } from '@/lib/types';

export type FinanceCategoryKey = 'deslocamento' | 'gerais';
interface FinanceCategory { key: FinanceCategoryKey; label: string; totals: Record<string, number>; color: string; icon: ReactNode }

// Resumo financeiro da aba Despesas — total gasto + divisão por
// categoria (deslocamento/gerais). Cada categoria é clicável e leva
// direto pra lista detalhada daquela categoria mais abaixo na mesma
// aba (via onCategoryClick), então não duplica a tabela de itens que
// já existe logo em seguida.
export function FinanceSummary({ transports, gerais, startDate, endDate, onCategoryClick }: {
  transports: TripTransport[];
  gerais: Expense[];
  startDate: string | null;
  endDate: string | null;
  onCategoryClick?: (section: FinanceCategoryKey) => void;
}) {
  const { lang, t } = useLanguage();

  const transportTotals = sumByCurrency(transports);
  const geraisTotals = sumByCurrency(gerais);
  const tripTotals = mergeTotals(transportTotals, geraisTotals);
  const totalEntries = transports.length + gerais.length;

  const breakdown: FinanceCategory[] = [
    { key: 'deslocamento', label: t('expensesTab.deslocamento'), totals: transportTotals, color: 'var(--blue)', icon: <Plane size={15} /> },
    { key: 'gerais', label: t('expensesTab.gerais'), totals: geraisTotals, color: 'var(--teal-green)', icon: <Receipt size={15} /> },
  ];

  const totalCurrencyEntries = Object.entries(tripTotals);
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
            <div
              className={'resumo-cat' + (onCategoryClick ? ' resumo-cat-clickable' : '')}
              key={b.key}
              style={{ ['--item-color' as any]: b.color }}
              onClick={() => onCategoryClick?.(b.key)}
              role={onCategoryClick ? 'button' : undefined}
            >
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

function CurrencyAmounts({ totals, lang }: { totals: Record<string, number>; lang?: Lang }) {
  const { lang: currentLang } = useLanguage();
  const effectiveLang = lang ?? currentLang;
  const entries = Object.entries(totals);
  return entries.length === 0
    ? <span>{fmtMoney(0, effectiveLang)}</span>
    : <>{entries.map(([currency, amount]) => <span key={currency}>{fmtMoney(amount, effectiveLang, currency)}</span>)}</>;
}
