'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { sendEmailInvite } from '@/lib/invites';
import { useLanguage } from '@/lib/i18n/context';

// Convite por WhatsApp continua só simulado (lib/invites.ts) — escondido
// por enquanto pra não passar a impressão de que já manda de verdade.
export function InviteModal({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const { t } = useLanguage();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSend() {
    if (!value.trim()) return;
    setSending(true);
    setMessage(null);
    const trimmed = value.trim();
    const result = await sendEmailInvite(tripId, trimmed);
    setSending(false);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error || t('invite.sendError') });
      return;
    }
    setMessage({ ok: true, text: t('invite.sentEmail', { value: trimmed }) });
    setValue('');
  }

  return (
    <Modal title={t('invite.modalTitle')} onClose={onClose}>
      <div className="field">
        <label>{t('invite.emailLabel')}</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('invite.emailPlaceholder')}
        />
      </div>

      {message && (
        <div className={message.ok ? 'modal-success' : 'modal-error'}>{message.text}</div>
      )}

      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: -4 }}>
        {t('invite.noteEmail')}
      </p>

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
        <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
          {sending ? t('common.sending') : t('invite.send')}
        </button>
      </div>
    </Modal>
  );
}
