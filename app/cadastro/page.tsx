'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { GoogleIcon, MicrosoftIcon } from '@/components/OAuthIcons';
import { useLanguage } from '@/lib/i18n/context';

export default function CadastroPage() {
  const supabase = createClient();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function handleOAuth(provider: 'google' | 'azure') {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setInfo(t('login.signUpSuccess'));
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

        <button className="oauth-btn" onClick={() => handleOAuth('google')} type="button">
          <GoogleIcon /> {t('login.continueGoogle')}
        </button>
        <button className="oauth-btn" onClick={() => handleOAuth('azure')} type="button">
          <MicrosoftIcon /> {t('login.continueMicrosoft')}
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
          {t('login.hasAccount')} <Link href="/login">{t('login.signIn')}</Link>
        </div>
      </div>
    </div>
  );
}
