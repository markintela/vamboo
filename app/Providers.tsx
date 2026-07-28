'use client';

import type { ReactNode } from 'react';
import { LanguageProvider } from '@/lib/i18n/context';
import { BottomNav } from '@/components/BottomNav';
import { LogoWatermark } from '@/components/LogoWatermark';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <LogoWatermark />
      <div className="app-content">{children}</div>
      <BottomNav />
    </LanguageProvider>
  );
}
