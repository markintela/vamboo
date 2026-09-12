'use client';

import { Download, FileText } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/context';

export function DocShareClient({ label, tripName, token }: { label: string; tripName: string | null; token: string }) {
  const { t } = useLanguage();
  return (
    <div>
      <div className="topbar topbar-centered">
        <Logo markSize={34} />
        <div className="topbar-actions">
          <LanguageSwitcher />
        </div>
      </div>
      <div className="page" style={{ textAlign: 'center', paddingTop: 40 }}>
        <span className="status-badge badge-neutral">{t('share.viewOnlyBadge')}</span>
        <div style={{ margin: '28px auto 20px', width: 72, height: 72, borderRadius: 18, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={32} strokeWidth={1.5} style={{ color: 'var(--ink-soft)' }} />
        </div>
        <h1 className="page-title">{label}</h1>
        {tripName && <p className="page-sub">{t('share.docFromTrip', { trip: tripName })}</p>}
        <a className="btn btn-primary" href={`/api/share/doc/${token}`} style={{ marginTop: 20, display: 'inline-flex' }}>
          <Download size={16} /> {t('documents.download')}
        </a>
      </div>
    </div>
  );
}
