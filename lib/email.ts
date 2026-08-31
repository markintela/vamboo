import nodemailer, { type Transporter } from 'nodemailer';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

// Guardado entre chamadas (reaproveita a conexão SMTP) — recriado só se as
// variáveis de ambiente mudarem (ex: hot reload em dev com .env.local editado).
let cachedTransporter: Transporter | null = null;
let cachedUser: string | null = null;

function getTransporter(): { transporter: Transporter; from: string } | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  if (!cachedTransporter || cachedUser !== user) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
    cachedUser = user;
  }

  return { transporter: cachedTransporter, from: `Vamboh <${user}>` };
}

/** Envia um e-mail via SMTP do Gmail (conta pessoal + senha de app). Server-only — nunca chame do client. */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const setup = getTransporter();
  if (!setup) {
    return { ok: false, error: 'GMAIL_USER / GMAIL_APP_PASSWORD não configurados no .env.local.' };
  }

  try {
    await setup.transporter.sendMail({ from: setup.from, to, subject, html });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function inviteEmailHtml({ tripName, acceptUrl }: { tripName: string; acceptUrl: string }): string {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h2 style="margin: 0 0 12px;">Você foi convidado para uma viagem no Vamboh</h2>
      <p style="color: #444; font-size: 15px; line-height: 1.6;">
        Convidaram você para ver os detalhes da viagem <strong>${tripName}</strong> — itinerário, despesas, hotéis e documentos.
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
