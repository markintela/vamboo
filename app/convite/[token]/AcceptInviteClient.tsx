'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/context';

interface Invite {
  trip_id: string;
  trip_name: string;
  status: string;
  destination: string;
}

export function AcceptInviteClient({ token, invite, isLoggedIn }: { token: string; invite: Invite | null; isLoggedIn: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAccept() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase.rpc('accept_trip_invite', { p_token: token });
    setLoading(false);
    if (error) { setError(t('inviteAccept.error')); return; }
    router.push(`/trips/${data}`);
  }

  const nextParam = `/convite/${token}`;

  return (
    <div className="auth-shell">
      <div className="lang-switcher-corner"><LanguageSwitcher /></div>
      <div className="auth-card">
        <Logo markSize={44} />
        {!invite ? (
          <>
            <h1>{t('inviteAccept.notFoundTitle')}</h1>
            <p className="sub">{t('inviteAccept.notFoundText')}</p>
            <Link href="/" className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
              {t('login.backHome')}
            </Link>
          </>
        ) : (
          <>
            <h1>{t('inviteAccept.title')}</h1>
            <p className="sub">{t('inviteAccept.subtitle', { trip: invite.trip_name })}</p>

            {error && <div className="auth-error">{error}</div>}

            {isLoggedIn ? (
              <button
                className="btn btn-primary"
                onClick={handleAccept}
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {loading ? t('login.wait') : t('inviteAccept.accept')}
              </button>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: -10, marginBottom: 18 }}>
                  {t('inviteAccept.needAccount')}
                </p>
                <Link
                  href={`/login?next=${encodeURIComponent(nextParam)}`}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}
                >
                  {t('login.signIn')}
                </Link>
                <Link
                  href={`/cadastro?next=${encodeURIComponent(nextParam)}`}
                  className="btn btn-outline"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {t('login.signUp')}
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
