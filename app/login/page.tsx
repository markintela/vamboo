'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { GoogleIcon } from '@/components/OAuthIcons';
import { useLanguage } from '@/lib/i18n/context';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleOAuth(provider: 'google') {
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
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
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(t('login.invalidCredentials')); return; }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      console.error('signInWithPassword failed:', err);
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
        <h1>{t('login.signInTitle')}</h1>
        <p className="sub">{t('login.subtitle')}</p>

        {error && <div className="auth-error">{error}</div>}

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
            {loading ? t('login.wait') : t('login.signIn')}
          </button>
        </form>

        <div className="auth-switch">
          {t('login.noAccount')} <Link href="/cadastro">{t('login.signUp')}</Link>
        </div>
      </div>
    </div>
  );
}
