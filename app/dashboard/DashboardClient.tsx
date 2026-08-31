'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, User, LogOut, Home, Camera } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { TripCard } from '@/components/TripCard';
import { TripMap } from '@/components/TripMap';
import { Modal } from '@/components/Modal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Flag } from '@/components/Flag';
import { useLanguage } from '@/lib/i18n/context';
import { routeStatus } from '@/lib/dates';
import { countryNameToCode } from '@/lib/countries';
import { CONTINENT_BY_CODE } from '@/lib/continents';
import type { Profile } from '@/lib/types';

interface TripSummary {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  peopleCount: number;
  colorIndex: number;
  flags: string[];
  archived: boolean;
}

interface DashboardRoute {
  id: string;
  city: string;
  country: string;
  start_date: string | null;
  tripName: string;
}

export function DashboardClient({ trips, routes, loadError, profile }: { trips: TripSummary[]; routes: DashboardRoute[]; loadError?: string | null; profile: Profile | null }) {
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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [tripFilter, setTripFilter] = useState<'upcoming' | 'past' | 'all' | 'archived'>('upcoming');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, [supabase]);

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

  const displayName = profile?.full_name || userEmail || '';
  const nationalityCode = profile?.nationality ? countryNameToCode(profile.nationality) : null;

  const distinctCountries = Array.from(new Set(routes.map((r) => r.country.trim()).filter(Boolean)));
  const citiesCount = new Set(routes.map((r) => `${r.city.trim().toLowerCase()}__${r.country.trim().toLowerCase()}`).filter((k) => k !== '__')).size;
  const continentsCount = new Set(
    distinctCountries
      .map((name) => { const code = countryNameToCode(name); return code ? CONTINENT_BY_CODE[code] : undefined; })
      .filter((c): c is NonNullable<typeof c> => !!c)
  ).size;

  const activeTrips = trips.filter((trip) => !trip.archived);
  const archivedTrips = trips.filter((trip) => trip.archived);
  const tripsWithStatus = activeTrips.map((trip) => ({ trip, status: routeStatus({ start_date: trip.startDate, end_date: trip.endDate }) }));
  const pastCount = tripsWithStatus.filter((t) => t.status === 'past').length;
  const upcomingCount = tripsWithStatus.length - pastCount;
  const visibleTrips = tripFilter === 'archived'
    ? archivedTrips
    : tripsWithStatus
        .filter(({ status }) => tripFilter === 'all' || (tripFilter === 'past' ? status === 'past' : status !== 'past'))
        .map(({ trip }) => trip);

  async function handleArchiveToggle(tripId: string, archived: boolean) {
    await supabase.from('trips').update({ archived: !archived }).eq('id', tripId);
    router.refresh();
  }

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
      <div className="topbar topbar-centered">
        <Logo markSize={34} />
        <div className="topbar-actions">
          <LanguageSwitcher />
          <a className="btn btn-outline" href="/">
            <Home size={16} strokeWidth={2.25} /> <span className="btn-label">{t('nav.home')}</span>
          </a>
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

      {userEmail === null && (
        <div className="session-status session-status-warning">
          {t('session.expired')} <a href="/login">{t('session.goToLogin')}</a>
        </div>
      )}

      <div className="page">
        <div className="dashboard-card">
        {displayName && (
          <>
            <div className="section-head" style={{ marginBottom: 10 }}>
              <h2>{t('dashboard.profileSectionTitle')}</h2>
            </div>
            <div className="dashboard-stats-row">
              <div className="passport-card">
                <div className="passport-photo-frame">
                  {photoUrl ? <img src={photoUrl} alt="" /> : <Camera size={22} strokeWidth={1.6} />}
                </div>
                <div className="passport-fields">
                  <div className="passport-field-label">{t('dashboard.passportLabel')}</div>
                  <div className="passport-name">{displayName}</div>
                  {nationalityCode && (
                    <div className="passport-flag-row"><Flag code={nationalityCode} size={16} /> {profile?.nationality}</div>
                  )}
                </div>
              </div>
              <div className="stat-card">
                <div className="value">{trips.length}</div>
                <div className="label">{t('dashboard.statTrips')}</div>
              </div>
              <div className="stat-card">
                <div className="value">{continentsCount}</div>
                <div className="label">{t('dashboard.statContinents')}</div>
              </div>
              <div className="stat-card">
                <div className="value">{distinctCountries.length}</div>
                <div className="label">{t('dashboard.statCountries')}</div>
              </div>
              <div className="stat-card">
                <div className="value">{citiesCount}</div>
                <div className="label">{t('dashboard.statCities')}</div>
              </div>
            </div>
          </>
        )}

        <h1 className="page-title">{t('dashboard.title')}</h1>
        <p className="page-sub">{t('dashboard.subtitle')}</p>

        {loadError && <pre className="debug-log" style={{ marginBottom: 16 }}>{loadError}</pre>}

        <TripMap routes={routes} large zoomable showOrder={false} showRoute={false} groupByCountry />

        <div className="trip-filter">
          <button className={'pill-btn' + (tripFilter === 'upcoming' ? ' active' : '')} onClick={() => setTripFilter('upcoming')}>
            {t('dashboard.filterUpcoming')} ({upcomingCount})
          </button>
          <button className={'pill-btn' + (tripFilter === 'past' ? ' active' : '')} onClick={() => setTripFilter('past')}>
            {t('dashboard.filterPast')} ({pastCount})
          </button>
          <button className={'pill-btn' + (tripFilter === 'all' ? ' active' : '')} onClick={() => setTripFilter('all')}>
            {t('dashboard.filterAll')} ({activeTrips.length})
          </button>
          <button className={'pill-btn' + (tripFilter === 'archived' ? ' active' : '')} onClick={() => setTripFilter('archived')}>
            {t('dashboard.filterArchived')} ({archivedTrips.length})
          </button>
        </div>

        {visibleTrips.length === 0 && (
          <div className="gallery-empty">
            <p>
              {tripFilter === 'past' ? t('dashboard.noPastTrips')
                : tripFilter === 'archived' ? t('dashboard.noArchivedTrips')
                : t('dashboard.noUpcomingTrips')}
            </p>
          </div>
        )}

        <div className="trip-grid">
          {visibleTrips.map((trip) => (
            <TripCard key={trip.id} {...trip} onArchiveToggle={() => handleArchiveToggle(trip.id, trip.archived)} />
          ))}
          <button className="empty-card" onClick={() => setShowModal(true)}>
            <span style={{ fontSize: 26 }}>+</span>
            {t('dashboard.newTripCard')}
          </button>
        </div>
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
