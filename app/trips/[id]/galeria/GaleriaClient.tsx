'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Images, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { Modal } from '@/components/Modal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/context';
import type { TripPhoto } from '@/lib/types';

const MAX_PHOTO_MB = 12;

type PhotoWithUrl = TripPhoto & { url: string | null };

export function GaleriaClient({ tripId, tripName, canEdit, photos }: { tripId: string; tripName: string; canEdit: boolean; photos: PhotoWithUrl[] }) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PhotoWithUrl | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightbox, setLightbox] = useState<PhotoWithUrl | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setError('');
    const invalid = files.find((f) => !f.type.startsWith('image/'));
    if (invalid) { setError(t('gallery.invalidType')); return; }
    const tooLarge = files.find((f) => f.size > MAX_PHOTO_MB * 1024 * 1024);
    if (tooLarge) { setError(t('gallery.tooLarge', { max: String(MAX_PHOTO_MB) })); return; }

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    for (const file of files) {
      const path = `${tripId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('trip-photos').upload(path, file);
      if (uploadError) { setError(uploadError.message); continue; }
      await supabase.from('trip_photos').insert({ trip_id: tripId, storage_path: path, added_by: user?.id ?? null });
    }
    setUploading(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.storage.from('trip-photos').remove([deleteTarget.storage_path]);
    const { error: err } = await supabase.from('trip_photos').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (err) { setError(err.message); setDeleteTarget(null); return; }
    setDeleteTarget(null);
    if (lightbox?.id === deleteTarget.id) setLightbox(null);
    router.refresh();
  }

  return (
    <div>
      <div className="topbar topbar-centered">
        <Logo markSize={34} />
        <div className="topbar-actions">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="page">
        <a className="back-link" href={`/trips/${tripId}`}>← {tripName}</a>
        <h1 className="page-title">{t('gallery.title')}</h1>
        <p className="page-sub">{t('gallery.subtitle')}</p>

        {error && <div className="modal-error">{error}</div>}

        <div className="section-head">
          <h2>{t('gallery.sectionTitle')}</h2>
          {canEdit && (
            <button className="add-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? t('common.sending') : `+ ${t('gallery.addPhotos')}`}
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFilesSelected} />
        </div>

        {photos.length === 0 ? (
          <div className="gallery-empty">
            <Images size={32} strokeWidth={1.5} />
            <p>{t('gallery.empty')}</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {photos.map((p) => (
              <div className="gallery-tile" key={p.id}>
                {p.url && <img src={p.url} alt="" onClick={() => setLightbox(p)} />}
                {canEdit && (
                  <button className="gallery-tile-delete" onClick={() => setDeleteTarget(p)} aria-label={t('common.delete')}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div className="lightbox-backdrop" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label={t('common.cancel')}><X size={22} /></button>
          {lightbox.url && <img src={lightbox.url} alt="" onClick={(e) => e.stopPropagation()} />}
        </div>
      )}

      {deleteTarget && (
        <Modal title={t('common.confirmDeleteTitle')} onClose={() => setDeleteTarget(null)}>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 20px' }}>
            {t('gallery.confirmDeleteText')}
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</button>
            <button className="btn" style={{ background: '#e8524b', color: '#fff' }} disabled={deleting} onClick={handleDelete}>
              {deleting ? t('common.deleting') : t('common.delete')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
