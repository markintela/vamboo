'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Images, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { Modal } from '@/components/Modal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Flag } from '@/components/Flag';
import { countryNameToCode } from '@/lib/countries';
import { useLanguage } from '@/lib/i18n/context';
import type { TripPhoto } from '@/lib/types';

const MAX_PHOTO_MB = 12;

type PhotoWithUrl = TripPhoto & { url: string | null };
type RouteOption = { id: string; country: string; city: string; start_date: string | null };

export function GaleriaClient({ tripId, tripName, canEdit, photos, routes }: {
  tripId: string;
  tripName: string;
  canEdit: boolean;
  photos: PhotoWithUrl[];
  routes: RouteOption[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PhotoWithUrl | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightbox, setLightbox] = useState<PhotoWithUrl | null>(null);
  const [editRouteId, setEditRouteId] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function openLightbox(p: PhotoWithUrl) {
    setLightbox(p);
    setEditRouteId(p.route_id ?? '');
    setEditCaption(p.caption ?? '');
  }

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

  async function handleSaveMeta() {
    if (!lightbox) return;
    setSavingMeta(true);
    const { error: err } = await supabase
      .from('trip_photos')
      .update({ route_id: editRouteId || null, caption: editCaption.trim() || null })
      .eq('id', lightbox.id);
    setSavingMeta(false);
    if (err) { setError(err.message); return; }
    setLightbox(null);
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

  const photosByRoute = new Map<string, PhotoWithUrl[]>();
  const unassigned: PhotoWithUrl[] = [];
  for (const p of photos) {
    if (p.route_id) {
      const list = photosByRoute.get(p.route_id);
      if (list) list.push(p); else photosByRoute.set(p.route_id, [p]);
    } else {
      unassigned.push(p);
    }
  }
  const sections = routes
    .map((r) => ({ route: r, items: photosByRoute.get(r.id) ?? [] }))
    .filter((s) => s.items.length > 0);

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
          <>
            {sections.map(({ route, items }) => {
              const code = countryNameToCode(route.country);
              return (
                <div className="gallery-section" key={route.id}>
                  <div className="gallery-section-title">
                    {code && <Flag code={code} size={16} />}
                    <h3>{route.city}</h3>
                    <span className="gallery-section-country">{route.country}</span>
                  </div>
                  <div className="gallery-grid">
                    {items.map((p) => (
                      <div className="gallery-tile" key={p.id}>
                        {p.url && <img src={p.url} alt="" onClick={() => openLightbox(p)} />}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {unassigned.length > 0 && (
              <div className="gallery-section">
                <div className="gallery-section-title">
                  <h3>{t('gallery.noLocationSection')}</h3>
                </div>
                <div className="gallery-grid">
                  {unassigned.map((p) => (
                    <div className="gallery-tile" key={p.id}>
                      {p.url && <img src={p.url} alt="" onClick={() => openLightbox(p)} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <div className="lightbox-backdrop" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label={t('common.cancel')}><X size={22} /></button>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {lightbox.url && <img src={lightbox.url} alt="" />}
            {canEdit ? (
              <div className="lightbox-panel">
                <div className="field">
                  <label>{t('gallery.photoCity')}</label>
                  <select value={editRouteId} onChange={(e) => setEditRouteId(e.target.value)}>
                    <option value="">{t('gallery.noLocation')}</option>
                    {routes.map((r) => <option key={r.id} value={r.id}>{r.city}{r.country ? ` — ${r.country}` : ''}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>{t('gallery.caption')}</label>
                  <textarea rows={2} value={editCaption} onChange={(e) => setEditCaption(e.target.value)} placeholder={t('gallery.captionPlaceholder')} />
                </div>
                <div className="lightbox-actions">
                  <button className="pill-btn" style={{ color: '#e8524b' }} onClick={() => setDeleteTarget(lightbox)}>{t('common.delete')}</button>
                  <button className="btn btn-primary" disabled={savingMeta} onClick={handleSaveMeta}>{savingMeta ? t('common.saving') : t('common.save')}</button>
                </div>
              </div>
            ) : (
              lightbox.caption && <p className="lightbox-caption-readonly">{lightbox.caption}</p>
            )}
          </div>
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
