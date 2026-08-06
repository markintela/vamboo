'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { GoogleIcon } from '@/components/OAuthIcons';
import { useLanguage } from '@/lib/i18n/context';

export default function CadastroPage() {
  const supabase = createClient();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [signInHref, setSignInHref] = useState('/login');

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next) setSignInHref(`/login?next=${encodeURIComponent(next)}`);
  }, []);

  function getNext(): string {
    return new URLSearchParams(window.location.search).get('next') || '/dashboard';
  }

  async function handleOAuth(provider: 'google') {
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getNext())}` },
      });
      if (error) setError(error.message);
    } catch (err) {
      console.error('signInWithOAuth failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setAlreadyRegistered(false);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getNext())}` },
      });
      if (error) { setError(error.message); return; }
      // O Supabase não retorna um erro explícito pra "e-mail já cadastrado"
      // (evita vazar quais e-mails têm conta) — em vez disso, devolve um
      // usuário com identities vazio quando o e-mail já existe e já está
      // confirmado. É assim que detectamos o caso e guiamos pro login.
      if (data.user?.identities?.length === 0) {
        setAlreadyRegistered(true);
        return;
      }
      setInfo(t('login.signUpSuccess'));
    } catch (err) {
      console.error('signUp failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="lang-switcher-corner"><LanguageSwitcher /></div>
      <div className="auth-card">
        <Link href="/" className="back-link">{t('login.backHome')}</Link>
        <Logo markSize={44} />
        <h1>{t('login.signUpTitle')}</h1>
        <p className="sub">{t('login.subtitle')}</p>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="modal-success">{info}</div>}
        {alreadyRegistered && (
          <div className="auth-notice">
            {t('login.alreadyRegisteredText')}{' '}
            <Link href={`/login?next=${encodeURIComponent(getNext())}&email=${encodeURIComponent(email)}`}>
              {t('login.signIn')}
            </Link>
          </div>
        )}

        <button className="oauth-btn" onClick={() => handleOAuth('google')} type="button">
          <GoogleIcon /> {t('login.continueGoogle')}
        </button>

        <div className="divider">{t('login.orEmail')}</div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>{t('login.email')}</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.emailPlaceholder')} />
          </div>
          <div className="field">
            <label>{t('login.password')}</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? t('login.wait') : t('login.signUp')}
          </button>
        </form>

        <div className="auth-switch">
          {t('login.hasAccount')} <Link href={signInHref}>{t('login.signIn')}</Link>
        </div>
      </div>
    </div>
  );
}
