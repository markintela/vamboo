export type InviteChannel = 'email' | 'whatsapp';

export interface InviteResult {
  ok: boolean;
  message: string;
}

/**
 * MOCK — simula o envio de um convite por e-mail.
 *
 * Integração real (próximo passo):
 *   - Usar um provedor tipo Resend, SendGrid ou Postmark.
 *   - Criar uma API Route (app/api/invites/email/route.ts) que roda no servidor
 *     (nunca exponha a API key do provedor no client).
 *   - Gerar um link de convite único (ex: token na tabela `trip_invites`)
 *     e incluir no corpo do e-mail.
 */
export async function sendEmailInvite(tripId: string, email: string): Promise<InviteResult> {
  console.log('[MOCK] Enviando convite por e-mail', { tripId, email });
  await new Promise((r) => setTimeout(r, 700));
  return { ok: true, message: `Convite simulado enviado para ${email}. (integração real ainda não conectada)` };
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
  return { ok: true, message: `Convite simulado enviado por WhatsApp para ${phone}. (integração real ainda não conectada)` };
}
