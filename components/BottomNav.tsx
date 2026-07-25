'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/context';

const HIDDEN_ON = ['/login', '/cadastro', '/', '/termos', '/privacidade'];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  if (HIDDEN_ON.includes(pathname)) return null;

  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/trips');
  const isPerfil = pathname.startsWith('/perfil');

  return (
    <nav className="bottom-nav">
      <Link href="/dashboard" className={'bottom-nav-item' + (isDashboard ? ' active' : '')}>
        <span className="icon">🏠</span>
        {t('nav.dashboard')}
      </Link>
      <Link href="/perfil" className={'bottom-nav-item' + (isPerfil ? ' active' : '')}>
        <span className="icon">👤</span>
        {t('nav.profile')}
      </Link>
    </nav>
  );
}
