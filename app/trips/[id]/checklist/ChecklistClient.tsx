'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListChecks, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { Modal } from '@/components/Modal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/context';
import type { ChecklistItem } from '@/lib/types';

function fmtDoneDate(iso: string, lang: string): string {
  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR';
  return new Date(iso).toLocaleDateString(locale);
}

export function ChecklistClient({ tripId, tripName, canEdit, items, doneByNames }: {
  tripId: string;
  tripName: string;
  canEdit: boolean;
  items: ChecklistItem[];
  doneByNames: Record<string, string>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { lang, t } = useLanguage();

  const [formOpen, setFormOpen] = useState<{ edit?: ChecklistItem } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleToggle(item: ChecklistItem) {
    if (!canEdit) return;
    const nextDone = !item.done;
    if (nextDone) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('trip_checklist_items').update({
        done: true,
        done_at: new Date().toISOString(),
        done_by: user?.id ?? null,
      }).eq('id', item.id);
    } else {
      await supabase.from('trip_checklist_items').update({ done: false, done_at: null, done_by: null }).eq('id', item.id);
    }
    router.refresh();
  }

  async function handleSubmit(description: string) {
    setSaving(true);
    const trimmed = description.trim();
    const { error: err } = formOpen?.edit
      ? await supabase.from('trip_checklist_items').update({ description: trimmed }).eq('id', formOpen.edit.id)
      : await supabase.from('trip_checklist_items').insert({ trip_id: tripId, description: trimmed });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setFormOpen(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: err } = await supabase.from('trip_checklist_items').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (err) { setError(err.message); setDeleteTarget(null); return; }
    setDeleteTarget(null);
    router.refresh();
  }

  const pending = items.filter((i) => !i.done);
  const completed = items.filter((i) => i.done).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));

  function renderItem(item: ChecklistItem) {
    const doneByName = item.done_by ? doneByNames[item.done_by] : null;
    return (
      <div className="expense-row" key={item.id} style={{ alignItems: 'flex-start' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: canEdit ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={item.done} disabled={!canEdit} onChange={() => handleToggle(item)} style={{ marginTop: 3 }} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--ink-soft)' : 'var(--ink)' }}>{item.description}</span>
            {item.done && item.done_at && (
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                {doneByName
                  ? t('checklist.completedBy', { name: doneByName, date: fmtDoneDate(item.done_at, lang) })
                  : t('checklist.completedByUnknown', { date: fmtDoneDate(item.done_at, lang) })}
              </span>
            )}
          </span>
        </label>
        {canEdit && (
          <div className="item-actions">
            <button className="icon-btn" onClick={() => setFormOpen({ edit: item })} aria-label={t('common.edit')}><Pencil size={13} /></button>
            <button className="icon-btn danger" onClick={() => setDeleteTarget(item)} aria-label={t('common.delete')}><Trash2 size={13} /></button>
          </div>
        )}
      </div>
    );
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
        <h1 className="page-title">{t('checklist.title')}</h1>
        <p className="page-sub">{t('checklist.subtitle')}</p>

        {error && <div className="modal-error">{error}</div>}

        <div className="section-head">
          <h2>{t('checklist.sectionTitle')}</h2>
          {canEdit && (
            <button className="add-btn" onClick={() => setFormOpen({})}>+ {t('checklist.addTask')}</button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="gallery-empty">
            <ListChecks size={32} strokeWidth={1.5} />
            <p>{t('checklist.empty')}</p>
          </div>
        ) : (
          <>
            <div className="route-expenses" style={{ marginBottom: pending.length && completed.length ? 18 : 0 }}>
              {pending.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{t('checklist.allDone')}</div>
              ) : (
                pending.map(renderItem)
              )}
            </div>

            {completed.length > 0 && (
              <div className="gallery-section">
                <div className="gallery-section-title">
                  <h3>{t('checklist.completed')}</h3>
                </div>
                <div className="route-expenses">
                  {completed.map(renderItem)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {formOpen && (
        <TaskFormModal
          saving={saving}
          error={error}
          initial={formOpen.edit}
          onClose={() => setFormOpen(null)}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTarget && (
        <Modal title={t('common.confirmDeleteTitle')} onClose={() => setDeleteTarget(null)}>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 20px' }}>
            {t('checklist.confirmDeleteText')}
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

function TaskFormModal({ onClose, onSubmit, error, saving, initial }: {
  onClose: () => void;
  onSubmit: (description: string) => void;
  error: string;
  saving: boolean;
  initial?: ChecklistItem;
}) {
  const { t } = useLanguage();
  const [description, setDescription] = useState(initial?.description ?? '');
  const [fieldError, setFieldError] = useState('');

  function handleSubmit() {
    if (!description.trim()) { setFieldError(t('checklist.descriptionRequired')); return; }
    setFieldError('');
    onSubmit(description);
  }

  return (
    <Modal title={initial ? t('checklist.editTaskTitle') : t('checklist.addTaskTitle')} onClose={onClose} error={error || fieldError}>
      <div className="field">
        <label>{t('checklist.taskDescription')}</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('checklist.taskDescriptionPlaceholder')} />
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={handleSubmit}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}
