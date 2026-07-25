'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
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

    if (mode === 'signin') {
      // AUTH TEMPORÁRIA: aceita qualquer e-mail/senha, loga como usuário anônimo.
      const { error } = await supabase.auth.signInAnonymously();
      setLoading(false);
      if (error) { setError(error.message); return; }
      router.push('/dashboard');
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (error) { setError(error.message); return; }
      setInfo('Conta criada! Confira seu e-mail para confirmar o cadastro.');
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Logo markSize={44} />
        <h1>{mode === 'signin' ? 'Entrar na sua conta' : 'Criar sua conta'}</h1>
        <p className="sub">Organize o roteiro, as despesas e a hospedagem das suas viagens.</p>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="modal-success">{info}</div>}

        <button className="oauth-btn" onClick={() => handleOAuth('google')} type="button">
          <GoogleIcon /> Continuar com Google
        </button>
        <button className="oauth-btn" onClick={() => handleOAuth('azure')} type="button">
          <MicrosoftIcon /> Continuar com Microsoft
        </button>

        <div className="divider">ou com e-mail</div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>E-mail</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
          </div>
          <div className="field">
            <label>Senha</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'signin' ? (
            <>Ainda não tem conta? <button onClick={() => setMode('signup')}>Criar conta</button></>
          ) : (
            <>Já tem conta? <button onClick={() => setMode('signin')}>Entrar</button></>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.8 14-5.1l-6.5-5.4C29.4 35.4 26.8 36 24 36c-5.2 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.5 5.4C40.9 36.6 44 30.9 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23">
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}
