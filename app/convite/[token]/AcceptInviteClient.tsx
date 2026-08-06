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
  channel: string;
  expires_at: string | null;
}

export function AcceptInviteClient({ token, invite, isLoggedIn, userEmail }: { token: string; invite: Invite | null; isLoggedIn: boolean; userEmail: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isExpired = !!invite?.expires_at && new Date(invite.expires_at) < new Date();
  const isWrongAccount = !!invite && invite.channel === 'email' && isLoggedIn && !!userEmail
    && userEmail.toLowerCase() !== invite.destination.toLowerCase();

  async function handleAccept() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase.rpc('accept_trip_invite', { p_token: token });
    setLoading(false);
    if (error) {
      if (error.message?.includes('invite_expired')) { setError(t('inviteAccept.expiredText')); return; }
      if (error.message?.includes('email_mismatch')) { setError(t('inviteAccept.wrongAccountText')); return; }
      setError(t('inviteAccept.error'));
      return;
    }
    router.push(`/trips/${data}`);
  }

  async function handleSwitchAccount() {
    await supabase.auth.signOut();
    router.push(`/login?next=${encodeURIComponent(nextParam)}`);
    router.refresh();
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
        ) : isExpired ? (
          <>
            <h1>{t('inviteAccept.expiredTitle')}</h1>
            <p className="sub">{t('inviteAccept.expiredText')}</p>
            <Link href="/" className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
              {t('login.backHome')}
            </Link>
          </>
        ) : (
          <>
            <h1>{t('inviteAccept.title')}</h1>
            <p className="sub">{t('inviteAccept.subtitle', { trip: invite.trip_name })}</p>

            {error && <div className="auth-error">{error}</div>}

            {isLoggedIn && isWrongAccount ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: -10, marginBottom: 18 }}>
                  {t('inviteAccept.wrongAccountText')}
                </p>
                <button
                  className="btn btn-primary"
                  onClick={handleSwitchAccount}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {t('inviteAccept.switchAccount')}
                </button>
              </>
            ) : isLoggedIn ? (
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
