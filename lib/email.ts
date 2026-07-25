interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/** Envia um e-mail via Resend (https://resend.com). Server-only — nunca chame do client. */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY não configurada no .env.local.' };
  }

  const from = process.env.RESEND_FROM_EMAIL || 'Vamboo <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.message || `Resend respondeu ${res.status}` };
  }

  return { ok: true };
}

export function inviteEmailHtml({ tripName, acceptUrl }: { tripName: string; acceptUrl: string }): string {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="margin: 0 0 12px;">Você foi convidado para uma viagem no Vamboo</h2>
      <p style="color: #444; font-size: 15px; line-height: 1.6;">
        Convidaram você para ver os detalhes da viagem <strong>${tripName}</strong> — roteiro, despesas, hotéis e documentos.
      </p>
      <p style="margin: 28px 0;">
        <a href="${acceptUrl}" style="background: #2f9be0; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 700; display: inline-block;">
          Ver convite
        </a>
      </p>
      <p style="color: #888; font-size: 12.5px;">Se você não esperava esse convite, pode ignorar este e-mail.</p>
    </div>
  `;
}
