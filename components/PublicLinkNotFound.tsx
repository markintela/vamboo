'use client';

import { Link2Off } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/context';

export function PublicLinkNotFound() {
  const { t } = useLanguage();
  return (
    <div>
      <div className="topbar topbar-centered">
        <Logo markSize={34} />
        <div className="topbar-actions">
          <LanguageSwitcher />
        </div>
      </div>
      <div className="page" style={{ textAlign: 'center', paddingTop: 60 }}>
        <Link2Off size={40} strokeWidth={1.5} style={{ color: 'var(--ink-soft)', margin: '0 auto 16px' }} />
        <h1 className="page-title">{t('share.notFoundTitle')}</h1>
        <p className="page-sub">{t('share.notFoundText')}</p>
      </div>
    </div>
  );
}
