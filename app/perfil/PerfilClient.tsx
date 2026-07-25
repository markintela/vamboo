'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Camera, Lock } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Modal } from '@/components/Modal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/context';
import type { Profile, PersonalDocument, PersonalDocumentType } from '@/lib/types';

export function PerfilClient({ profile, documents }: { profile: Profile | null; documents: PersonalDocument[] }) {
  const router = useRouter();
  const { t } = useLanguage();
  const DOC_LABELS: Record<PersonalDocumentType, string> = {
    id: t('perfil.docTypeId'),
    passaporte: t('perfil.docTypePassport'),
    outro: t('perfil.docTypeOther'),
  };
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [error, setError] = useState('');
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!profile?.photo_path) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    fetch(`/api/personal-docs/download?path=${encodeURIComponent(profile.photo_path)}`)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile?.photo_path]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/profile-photo', { method: 'POST', body: form });
    const body = await res.json();
    setUploadingPhoto(false);
    if (!res.ok) { setError(body.error); return; }
    router.refresh();
  }

  async function viewDocument(path: string) {
    const res = await fetch(`/api/personal-docs/download?path=${encodeURIComponent(path)}`);
    if (!res.ok) { setError(t('perfil.cannotOpenDocument')); return; }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  }

  async function deleteDocument(id: string) {
    const res = await fetch(`/api/personal-docs?id=${id}`, { method: 'DELETE' });
    if (!res.ok) { const body = await res.json(); setError(body.error); return; }
    router.refresh();
  }

  return (
    <div>
      <div className="topbar">
        <Logo markSize={34} />
        <div className="topbar-actions">
          <LanguageSwitcher />
          <a className="btn btn-outline" href="/dashboard">
            <LayoutDashboard size={16} strokeWidth={2.25} /> <span className="btn-label">{t('nav.dashboard')}</span>
          </a>
        </div>
      </div>

      <div className="page">
        <h1 className="page-title">{t('perfil.title')}</h1>
        <p className="page-sub">{t('perfil.subtitle')}</p>

        {error && <div className="modal-error">{error}</div>}

        <div className="section-head">
          <h2>{t('perfil.photoTitle')}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 36 }}>
          <div className="person-avatar" style={{ width: 84, height: 84, background: 'var(--surface-2)', color: 'var(--ink-soft)', overflow: 'hidden' }}>
            {photoUrl ? <img src={photoUrl} alt={t('perfil.photoTitle')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={30} strokeWidth={1.6} />}
          </div>
          <div>
            <button className="pill-btn" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
              {uploadingPhoto ? t('common.sending') : photoUrl ? t('perfil.changePhoto') : t('perfil.addPhoto')}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Lock size={12} strokeWidth={2} /> {t('perfil.encryptedPhotoNote')}
            </p>
          </div>
        </div>

        <div className="section-head">
          <h2>{t('perfil.documentsTitle')}</h2>
          <button className="add-btn" onClick={() => setShowDocModal(true)}>{t('perfil.addDocument')}</button>
        </div>
        <div className="flat-list">
          {documents.length === 0 && <p style={{ color: 'var(--ink-soft)', fontSize: 13.5 }}>{t('perfil.noDocuments')}</p>}
          {documents.map((d) => (
            <div className="list-card" key={d.id}>
              <div className="main">
                <div className="title">{DOC_LABELS[d.doc_type]}{d.label ? ` · ${d.label}` : ''}</div>
                {d.document_number_decrypted && <div className="sub" style={{ fontFamily: 'var(--font-mono)' }}>{t('perfil.number', { value: d.document_number_decrypted })}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {d.file_path && <button className="pill-btn" onClick={() => viewDocument(d.file_path as string)}>{t('perfil.viewFile')}</button>}
                <button className="pill-btn" onClick={() => deleteDocument(d.id)}>🗑️ {t('common.remove')}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showDocModal && (
        <DocumentFormModal
          onClose={() => setShowDocModal(false)}
          onSaved={() => { setShowDocModal(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function DocumentFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [docType, setDocType] = useState<PersonalDocumentType>('id');
  const [label, setLabel] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!file) { setError(t('perfil.fileRequired')); return; }
    setSaving(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    form.append('docType', docType);
    if (label) form.append('label', label);
    if (documentNumber) form.append('documentNumber', documentNumber);
    const res = await fetch('/api/personal-docs', { method: 'POST', body: form });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) { setError(body.error); return; }
    onSaved();
  }

  return (
    <Modal title={t('perfil.formTitle')} onClose={onClose} error={error}>
      <div className="field">
        <label>{t('perfil.type')}</label>
        <select value={docType} onChange={(e) => setDocType(e.target.value as PersonalDocumentType)}>
          <option value="id">{t('perfil.docTypeId')}</option>
          <option value="passaporte">{t('perfil.docTypePassport')}</option>
          <option value="outro">{t('perfil.docTypeOther')}</option>
        </select>
      </div>
      <div className="field"><label>{t('perfil.label')}</label><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('perfil.labelPlaceholder')} /></div>
      <div className="field"><label>{t('perfil.documentNumber')}</label><input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder={t('perfil.documentNumberPlaceholder')} /></div>
      <div className="field">
        <label>{t('perfil.file')}</label>
        <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Lock size={12} strokeWidth={2} /> {t('perfil.encryptedFileNote')}
        </p>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={handleSubmit}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}
