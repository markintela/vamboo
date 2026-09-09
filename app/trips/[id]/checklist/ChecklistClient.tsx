'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListChecks, Pencil, Trash2, Clock, CheckCircle2, User, CalendarDays } from 'lucide-react';
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

export function ChecklistClient({ tripId, tripName, canEdit, items, doneByNames, ownerName, peopleNames, collaboratorNames }: {
  tripId: string;
  tripName: string;
  canEdit: boolean;
  items: ChecklistItem[];
  doneByNames: Record<string, string>;
  ownerName: string | null;
  peopleNames: string[];
  collaboratorNames: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const { lang, t } = useLanguage();

  const [formOpen, setFormOpen] = useState<{ edit?: ChecklistItem } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const crewNames = Array.from(new Set([ownerName || t('collab.ownerFallback'), ...peopleNames, ...collaboratorNames]));

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

  async function handleSubmit(data: { description: string; assignedTo: string }) {
    setSaving(true);
    const payload = { description: data.description.trim(), assigned_to: data.assignedTo || null };
    const { error: err } = formOpen?.edit
      ? await supabase.from('trip_checklist_items').update(payload).eq('id', formOpen.edit.id)
      : await supabase.from('trip_checklist_items').insert({ trip_id: tripId, ...payload });
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
      <div className={'task-card ' + (item.done ? 'task-done' : 'task-pending')} key={item.id}>
        <label className="task-check" style={{ cursor: canEdit ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={item.done} disabled={!canEdit} onChange={() => handleToggle(item)} />
        </label>
        <div className="task-body">
          <div className="task-desc">{item.description}</div>
          <div className="task-meta">
            <span className={'task-chip task-chip-status ' + (item.done ? 'task-chip-done' : 'task-chip-pending')}>
              {item.done ? <CheckCircle2 size={12} /> : <Clock size={12} />}
              {item.done ? t('checklist.statusDone') : t('checklist.statusPending')}
            </span>
            {item.assigned_to && (
              <span className="task-chip task-chip-assignee"><User size={12} /> {item.assigned_to}</span>
            )}
            <span className="task-chip">
              <CalendarDays size={12} /> {t('checklist.createdOn', { date: fmtDoneDate(item.created_at, lang) })}
            </span>
            {item.done && item.done_at && (
              <span className="task-chip task-chip-done">
                {doneByName
                  ? t('checklist.completedBy', { name: doneByName, date: fmtDoneDate(item.done_at, lang) })
                  : t('checklist.completedByUnknown', { date: fmtDoneDate(item.done_at, lang) })}
              </span>
            )}
          </div>
        </div>
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
            {pending.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: completed.length ? 18 : 0 }}>{t('checklist.allDone')}</div>
            ) : (
              <div style={{ marginBottom: completed.length ? 24 : 0 }}>{pending.map(renderItem)}</div>
            )}

            {completed.length > 0 && (
              <div className="gallery-section">
                <div className="gallery-section-title">
                  <h3>{t('checklist.completed')}</h3>
                </div>
                {completed.map(renderItem)}
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
          crewNames={crewNames}
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

function TaskFormModal({ onClose, onSubmit, error, saving, initial, crewNames }: {
  onClose: () => void;
  onSubmit: (data: { description: string; assignedTo: string }) => void;
  error: string;
  saving: boolean;
  initial?: ChecklistItem;
  crewNames: string[];
}) {
  const { t } = useLanguage();
  const [description, setDescription] = useState(initial?.description ?? '');
  const [assignedTo, setAssignedTo] = useState(initial?.assigned_to ?? '');
  const [fieldError, setFieldError] = useState('');

  function handleSubmit() {
    if (!description.trim()) { setFieldError(t('checklist.descriptionRequired')); return; }
    setFieldError('');
    onSubmit({ description, assignedTo });
  }

  return (
    <Modal title={initial ? t('checklist.editTaskTitle') : t('checklist.addTaskTitle')} onClose={onClose} error={error || fieldError}>
      <div className="field">
        <label>{t('checklist.taskDescription')}</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('checklist.taskDescriptionPlaceholder')} />
      </div>
      <div className="field">
        <label>{t('checklist.assignedTo')} <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>{t('common.optional')}</span></label>
        <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          <option value="">{t('checklist.unassigned')}</option>
          {crewNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={handleSubmit}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}
