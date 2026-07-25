'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { sendEmailInvite, sendWhatsappInvite, type InviteChannel } from '@/lib/invites';

export function InviteModal({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const [channel, setChannel] = useState<InviteChannel>('email');
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSend() {
    if (!value.trim()) return;
    setSending(true);
    setMessage(null);
    const result = channel === 'email'
      ? await sendEmailInvite(tripId, value.trim())
      : await sendWhatsappInvite(tripId, value.trim());
    setSending(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) setValue('');
  }

  return (
    <Modal title="Convidar para a trip" onClose={onClose}>
      <div className="channel-toggle">
        <button className={'channel-btn ' + (channel === 'email' ? 'active' : '')} onClick={() => setChannel('email')}>
          ✉️ E-mail
        </button>
        <button className={'channel-btn ' + (channel === 'whatsapp' ? 'active' : '')} onClick={() => setChannel('whatsapp')}>
          💬 WhatsApp
        </button>
      </div>

      <div className="field">
        <label>{channel === 'email' ? 'E-mail da pessoa' : 'Número do WhatsApp'}</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={channel === 'email' ? 'nome@exemplo.com' : '+55 11 91234-5678'}
        />
      </div>

      {message && (
        <div className={message.ok ? 'modal-success' : 'modal-error'}>{message.text}</div>
      )}

      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: -4 }}>
        Este convite é simulado neste protótipo — o envio real será conectado depois
        (e-mail via provedor tipo Resend, WhatsApp via Cloud API).
      </p>

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
        <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
          {sending ? 'Enviando…' : 'Enviar convite'}
        </button>
      </div>
    </Modal>
  );
}
