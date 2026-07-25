'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { TripCard } from '@/components/TripCard';
import { Modal } from '@/components/Modal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/context';

interface TripSummary {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  peopleCount: number;
  total: number;
  colorIndex: number;
}

export function DashboardClient({ trips }: { trips: TripSummary[] }) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) { setError(t('dashboard.nameRequired')); return; }
    setSaving(true);
    setError('');

    const { data: userData } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from('trips').insert({
      user_id: userData.user?.id,
      name: name.trim(),
      start_date: startDate || null,
      end_date: endDate || null,
      color_index: trips.length,
    });

    setSaving(false);
    if (insertError) { setError(insertError.message); return; }

    setShowModal(false);
    setName(''); setStartDate(''); setEndDate('');
    router.refresh();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div>
      <div className="topbar">
        <Logo />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <LanguageSwitcher />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>{t('dashboard.newTrip')}</button>
          <a className="btn btn-outline" href="/perfil">{t('nav.personalArea')}</a>
          <button className="btn btn-outline" onClick={handleLogout}>{t('nav.logout')}</button>
        </div>
      </div>

      <div className="page">
        <h1 className="page-title">{t('dashboard.title')}</h1>
        <p className="page-sub">{t('dashboard.subtitle')}</p>

        <div className="trip-grid">
          {trips.map((trip) => <TripCard key={trip.id} {...trip} />)}
          <button className="empty-card" onClick={() => setShowModal(true)}>
            <span style={{ fontSize: 26 }}>+</span>
            {t('dashboard.newTripCard')}
          </button>
        </div>
      </div>

      {showModal && (
        <Modal title={t('dashboard.modalTitle')} onClose={() => setShowModal(false)} error={error}>
          <div className="field">
            <label>{t('dashboard.tripName')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('dashboard.tripNamePlaceholder')} />
          </div>
          <div className="field-row">
            <div className="field"><label>{t('dashboard.start')}</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="field"><label>{t('dashboard.end')}</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? t('common.saving') : t('dashboard.createTrip')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
