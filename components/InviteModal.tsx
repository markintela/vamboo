'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { sendEmailInvite, sendWhatsappInvite, type InviteChannel } from '@/lib/invites';
import { useLanguage } from '@/lib/i18n/context';

export function InviteModal({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const { t } = useLanguage();
  const [channel, setChannel] = useState<InviteChannel>('email');
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSend() {
    if (!value.trim()) return;
    setSending(true);
    setMessage(null);
    const trimmed = value.trim();
    const result = channel === 'email'
      ? await sendEmailInvite(tripId, trimmed)
      : await sendWhatsappInvite(tripId, trimmed);
    setSending(false);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error || t('invite.sendError') });
      return;
    }
    const text = t(channel === 'email' ? 'invite.sentEmail' : 'invite.sentWhatsapp', { value: trimmed });
    setMessage({ ok: true, text });
    setValue('');
  }

  return (
    <Modal title={t('invite.modalTitle')} onClose={onClose}>
      <div className="channel-toggle">
        <button className={'channel-btn ' + (channel === 'email' ? 'active' : '')} onClick={() => setChannel('email')}>
          ✉️ {t('invite.email')}
        </button>
        <button className={'channel-btn ' + (channel === 'whatsapp' ? 'active' : '')} onClick={() => setChannel('whatsapp')}>
          💬 {t('invite.whatsapp')}
        </button>
      </div>

      <div className="field">
        <label>{channel === 'email' ? t('invite.emailLabel') : t('invite.whatsappLabel')}</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={channel === 'email' ? t('invite.emailPlaceholder') : t('invite.whatsappPlaceholder')}
        />
      </div>

      {message && (
        <div className={message.ok ? 'modal-success' : 'modal-error'}>{message.text}</div>
      )}

      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: -4 }}>
        {channel === 'email' ? t('invite.noteEmail') : t('invite.noteWhatsapp')}
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
