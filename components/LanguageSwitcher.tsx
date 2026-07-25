'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n/context';
import { LANGUAGES, type Lang } from '@/lib/i18n/translations';

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.4 2.6 3.8 6 3.8 9s-1.4 6.4-3.8 9c-2.4-2.6-3.8-6-3.8-9s1.4-6.4 3.8-9Z" />
    </svg>
  );
}

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  function choose(code: Lang) {
    setLang(code);
    setOpen(false);
  }

  return (
    <div className="lang-switcher" ref={wrapRef}>
      <button
        type="button"
        className="lang-switcher-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Language / Idioma"
      >
        <GlobeIcon />
        <span>{current.code.toUpperCase()}</span>
      </button>
      {open && (
        <div className="lang-switcher-menu" role="menu">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitem"
              className={'lang-switcher-item' + (l.code === lang ? ' active' : '')}
              onClick={() => choose(l.code)}
            >
              <span className="flag">{l.flag}</span> {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
