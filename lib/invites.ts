export type InviteChannel = 'email' | 'whatsapp';

export interface InviteResult {
  ok: boolean;
  error?: string;
}

/**
 * Envia um convite de verdade por e-mail (via app/api/invites, que usa Resend)
 * e cria a linha em `trip_invites` com um token de aceite único.
 */
export async function sendEmailInvite(tripId: string, email: string): Promise<InviteResult> {
  const res = await fetch('/api/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId, email }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body.error || `Falha ao enviar (${res.status})` };
  return { ok: true };
}

/**
 * MOCK — simula o envio de um convite por WhatsApp.
 *
 * Integração real (próximo passo):
 *   - Usar a WhatsApp Cloud API (Meta) ou um provedor tipo Twilio.
 *   - Exige um número comercial verificado e um template de mensagem aprovado
 *     pela Meta para o primeiro contato (mensagens fora de janela de 24h).
 *   - Assim como no e-mail, isso deve rodar em uma API Route no servidor.
 */
export async function sendWhatsappInvite(tripId: string, phone: string): Promise<InviteResult> {
  console.log('[MOCK] Enviando convite por WhatsApp', { tripId, phone });
  await new Promise((r) => setTimeout(r, 700));
  return { ok: true };
}
