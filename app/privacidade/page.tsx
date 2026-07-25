'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/context';

export default function PrivacidadePage() {
  const { t } = useLanguage();
  const sections = [1, 2, 3, 4, 5].map((n) => ({
    title: t(`legal.privacy${n}Title`),
    body: t(`legal.privacy${n}Body`),
  }));

  return (
    <div>
      <nav className="public-nav">
        <Link href="/"><Logo markSize={34} /></Link>
        <div className="public-nav-actions">
          <LanguageSwitcher />
        </div>
      </nav>

      <div className="legal-page">
        <h1>{t('legal.privacyTitle')}</h1>
        <p className="updated">{t('legal.privacyUpdated', { date: '2026-07-25' })}</p>
        <div className="draft-note">{t('legal.privacyDraftNote')}</div>

        {sections.map((s, i) => (
          <div key={i}>
            <h2>{s.title}</h2>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
