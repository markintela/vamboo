'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, User, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { TripCard } from '@/components/TripCard';
import { TripMap } from '@/components/TripMap';
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
  flags: string[];
}

interface DashboardRoute {
  id: string;
  city: string;
  country: string;
  start_date: string | null;
  tripName: string;
}

export function DashboardClient({ trips, routes, loadError }: { trips: TripSummary[]; routes: DashboardRoute[]; loadError?: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, [supabase]);

  function log(msg: string) {
    console.log('[dashboard]', msg);
    setDebugLog((prev) => [...prev, msg]);
  }

  async function handleCreate() {
    setDebugLog([]);
    log(`clique recebido, nome="${name}"`);
    if (!name.trim()) { setError(t('dashboard.nameRequired')); return; }
    setSaving(true);
    setError('');

    try {
      log('verificando sessão...');
      const { data: userData, error: userError } = await supabase.auth.getUser();
      log(`sessão: user_id=${userData.user?.id ?? 'nenhum'} email=${userData.user?.email ?? 'nenhum'} erro=${userError?.message ?? 'nenhum'}`);
      if (userError || !userData.user) {
        setUserEmail(null);
        setError(t('session.expired'));
        return;
      }

      log('enviando insert para a tabela trips...');
      const { error: insertError } = await supabase.from('trips').insert({
        user_id: userData.user.id,
        name: name.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        color_index: trips.length,
      });
      log(`resultado do insert: ${insertError ? `ERRO — ${insertError.message} (code: ${insertError.code})` : 'OK, sem erro'}`);

      if (insertError) { setError(insertError.message); return; }

      log('sucesso — fechando modal e atualizando lista');
      setShowModal(false);
      setName(''); setStartDate(''); setEndDate('');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`EXCEÇÃO capturada: ${msg}`);
      console.error('[dashboard] handleCreate failed', err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div>
      <div className="topbar">
        <Logo markSize={34} />
        <div className="topbar-actions">
          <LanguageSwitcher />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} strokeWidth={2.25} /> <span className="btn-label">{t('dashboard.newTrip')}</span>
          </button>
          <a className="btn btn-outline" href="/perfil">
            <User size={16} strokeWidth={2.25} /> <span className="btn-label">{t('nav.personalArea')}</span>
          </a>
          <button className="btn btn-outline" onClick={handleLogout}>
            <LogOut size={16} strokeWidth={2.25} /> <span className="btn-label">{t('nav.logout')}</span>
          </button>
        </div>
      </div>

      {userEmail !== undefined && (
        <div className={`session-status${userEmail ? '' : ' session-status-warning'}`}>
          {userEmail ? (
            <>{t('session.loggedInAs')} <strong>{userEmail}</strong></>
          ) : (
            <>{t('session.expired')} <a href="/login">{t('session.goToLogin')}</a></>
          )}
        </div>
      )}

      <div className="page">
        <h1 className="page-title">{t('dashboard.title')}</h1>
        <p className="page-sub">{t('dashboard.subtitle')}</p>

        {loadError && <pre className="debug-log" style={{ marginBottom: 16 }}>{loadError}</pre>}

        <TripMap routes={routes} large zoomable showOrder={false} showRoute={false} />

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
          {debugLog.length > 0 && (
            <pre className="debug-log">{debugLog.join('\n')}</pre>
          )}
        </Modal>
      )}
    </div>
  );
}
