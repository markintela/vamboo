'use client';

import { Mail } from 'lucide-react';
import { siGmail } from 'simple-icons';

// Detecta o provedor pelo domínio do e-mail — usado quando um
// colaborador ainda não tem nome de perfil e a UI cai pro e-mail como
// nome de exibição. Só o Gmail tem logo real disponível (simple-icons
// não inclui Outlook/Yahoo por licenciamento); os outros usam um
// ícone genérico na cor característica do serviço, o que já é
// suficiente pra reconhecer de relance qual é.
function detectProvider(email: string): { label: string; color: string; brand: 'gmail' | null } | null {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return null;
  if (domain === 'gmail.com' || domain === 'googlemail.com') return { label: 'Gmail', color: `#${siGmail.hex}`, brand: 'gmail' };
  if (domain === 'hotmail.com' || domain.startsWith('hotmail.')) return { label: 'Hotmail', color: '#0078D4', brand: null };
  if (domain === 'outlook.com' || domain.startsWith('outlook.') || domain === 'live.com' || domain === 'msn.com') return { label: 'Outlook', color: '#0078D4', brand: null };
  if (domain === 'yahoo.com' || domain.startsWith('yahoo.') || domain === 'ymail.com') return { label: 'Yahoo', color: '#6001D2', brand: null };
  return null;
}

export function EmailProviderIcon({ email, size = 14 }: { email: string; size?: number }) {
  const provider = detectProvider(email);

  if (!provider) {
    return <Mail size={size} style={{ flexShrink: 0, color: 'var(--ink-soft)' }} aria-hidden="true" />;
  }

  if (provider.brand === 'gmail') {
    return (
      <svg role="img" viewBox="0 0 24 24" width={size} height={size} fill={provider.color} style={{ flexShrink: 0 }} aria-label={provider.label}>
        <title>{provider.label}</title>
        <path d={siGmail.path} />
      </svg>
    );
  }

  return <Mail size={size} style={{ flexShrink: 0, color: provider.color }} aria-label={provider.label} />;
}
