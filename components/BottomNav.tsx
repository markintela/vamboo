'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User } from 'lucide-react';
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
        <Home className="icon" size={21} strokeWidth={2} />
        {t('nav.dashboard')}
      </Link>
      <Link href="/perfil" className={'bottom-nav-item' + (isPerfil ? ' active' : '')}>
        <User className="icon" size={21} strokeWidth={2} />
        {t('nav.profile')}
      </Link>
    </nav>
  );
}
