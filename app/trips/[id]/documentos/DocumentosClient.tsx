'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { Modal } from '@/components/Modal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Flag } from '@/components/Flag';
import { countryNameToCode } from '@/lib/countries';
import { useLanguage } from '@/lib/i18n/context';
import type { TripDocument } from '@/lib/types';

type RouteOption = { id: string; country: string; city: string; start_date: string | null };
type DocViewer = { url: string; mimeType: string; label: string; filename: string };

export function DocumentosClient({ tripId, tripName, canEdit, documents, routes }: {
  tripId: string;
  tripName: string;
  canEdit: boolean;
  documents: TripDocument[];
  routes: RouteOption[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TripDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [docViewer, setDocViewer] = useState<DocViewer | null>(null);

  async function handleAddDocument(data: { label: string; routeId: string; file: File }) {
    setSaving(true);
    const form = new FormData();
    form.append('file', data.file);
    form.append('tripId', tripId);
    const res = await fetch('/api/trip-documents', { method: 'POST', body: form });
    const body = await res.json();
    if (!res.ok) { setSaving(false); setError(body.error); return; }
    const { error: err } = await supabase.from('trip_documents').insert({
      trip_id: tripId,
      route_id: data.routeId || null,
      label: data.label.trim(),
      file_path: body.path,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setFormOpen(false);
    router.refresh();
  }

  async function viewDocument(doc: TripDocument) {
    const res = await fetch(`/api/trip-documents/download?path=${encodeURIComponent(doc.file_path)}`);
    if (!res.ok) { setError(t('documents.cannotOpen')); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const filename = doc.file_path.split('/').pop()?.replace(/\.enc$/, '') || doc.label;
    setDocViewer({ url, mimeType: blob.type, label: doc.label, filename });
  }

  function closeDocViewer() {
    if (docViewer) URL.revokeObjectURL(docViewer.url);
    setDocViewer(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: err } = await supabase.from('trip_documents').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (err) { setError(err.message); setDeleteTarget(null); return; }
    setDeleteTarget(null);
    router.refresh();
  }

  const docsByRoute = new Map<string, TripDocument[]>();
  const unassigned: TripDocument[] = [];
  for (const d of documents) {
    if (d.route_id) {
      const list = docsByRoute.get(d.route_id);
      if (list) list.push(d); else docsByRoute.set(d.route_id, [d]);
    } else {
      unassigned.push(d);
    }
  }
  const sections = routes
    .map((r) => ({ route: r, items: docsByRoute.get(r.id) ?? [] }))
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
        <h1 className="page-title">{t('documents.title')}</h1>
        <p className="page-sub">{t('documents.subtitle')}</p>

        {error && <div className="modal-error">{error}</div>}

        <div className="section-head">
          <h2>{t('documents.sectionTitle')}</h2>
          {canEdit && (
            <button className="add-btn" onClick={() => setFormOpen(true)}>+ {t('documents.addDocument')}</button>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="gallery-empty">
            <FileText size={32} strokeWidth={1.5} />
            <p>{t('documents.empty')}</p>
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
                  <div className="route-expenses">
                    {items.map((d) => (
                      <div className="expense-row" key={d.id}>
                        <button className="pill-btn" onClick={() => viewDocument(d)}>📎 {d.label}</button>
                        {canEdit && (
                          <div className="item-actions">
                            <button className="icon-btn danger" onClick={() => setDeleteTarget(d)} aria-label={t('common.delete')}><Trash2 size={13} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {unassigned.length > 0 && (
              <div className="gallery-section">
                <div className="gallery-section-title">
                  <h3>{t('documents.noLocationSection')}</h3>
                </div>
                <div className="route-expenses">
                  {unassigned.map((d) => (
                    <div className="expense-row" key={d.id}>
                      <button className="pill-btn" onClick={() => viewDocument(d)}>📎 {d.label}</button>
                      {canEdit && (
                        <div className="item-actions">
                          <button className="icon-btn danger" onClick={() => setDeleteTarget(d)} aria-label={t('common.delete')}><Trash2 size={13} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {formOpen && (
        <DocumentFormModal
          saving={saving}
          error={error}
          routes={routes}
          onClose={() => setFormOpen(false)}
          onSubmit={handleAddDocument}
        />
      )}

      {docViewer && (
        <DocumentViewerModal
          label={docViewer.label}
          filename={docViewer.filename}
          url={docViewer.url}
          mimeType={docViewer.mimeType}
          onClose={closeDocViewer}
        />
      )}

      {deleteTarget && (
        <Modal title={t('common.confirmDeleteTitle')} onClose={() => setDeleteTarget(null)}>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 20px' }}>
            {t('documents.confirmDeleteText')}
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

function DocumentFormModal({ onClose, onSubmit, error, saving, routes }: {
  onClose: () => void;
  onSubmit: (d: { label: string; routeId: string; file: File }) => void;
  error: string;
  saving: boolean;
  routes: RouteOption[];
}) {
  const { t } = useLanguage();
  const [label, setLabel] = useState('');
  const [routeId, setRouteId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fieldError, setFieldError] = useState('');

  function handleSubmit() {
    if (!label.trim()) { setFieldError(t('documents.nameRequired')); return; }
    if (!file) { setFieldError(t('documents.fileRequired')); return; }
    setFieldError('');
    onSubmit({ label, routeId, file });
  }

  return (
    <Modal title={t('documents.addDocumentTitle')} onClose={onClose} error={error || fieldError}>
      <div className="field">
        <label>{t('documents.documentName')}</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('documents.documentNamePlaceholder')} />
      </div>
      <div className="field">
        <label>{t('documents.route')} <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>{t('common.optional')}</span></label>
        <select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
          <option value="">{t('documents.routeNone')}</option>
          {routes.map((r) => <option key={r.id} value={r.id}>{r.city}{r.country ? ` — ${r.country}` : ''}</option>)}
        </select>
      </div>
      <div className="field">
        <label>{t('documents.file')}</label>
        <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '6px 0 0' }}>{t('documents.encryptedNote')}</p>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={handleSubmit}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}

function DocumentViewerModal({ label, filename, url, mimeType, onClose }: {
  label: string;
  filename: string;
  url: string;
  mimeType: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Modal title={label} onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        {mimeType.startsWith('image/') ? (
          <img src={url} alt="" style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
        ) : mimeType === 'application/pdf' ? (
          <iframe src={url} title={label} style={{ width: '100%', height: '60vh', border: '1px solid var(--border)', borderRadius: 8 }} />
        ) : (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{t('documents.previewUnavailable')}</p>
        )}
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <a className="btn btn-primary" href={url} download={filename}>{t('documents.download')}</a>
      </div>
    </Modal>
  );
}
