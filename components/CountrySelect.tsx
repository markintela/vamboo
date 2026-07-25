'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getCountryOptions } from '@/lib/countries';
import { useLanguage } from '@/lib/i18n/context';

export function CountrySelect({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const options = useMemo(() => getCountryOptions(lang), [lang]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="country-select" ref={wrapRef}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="country-select-menu" role="listbox">
          {filtered.map((o) => (
            <button
              key={o.code}
              type="button"
              className="country-select-item"
              onClick={() => { onChange(o.name); setOpen(false); }}
            >
              <span className="flag">{o.flag}</span> {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
