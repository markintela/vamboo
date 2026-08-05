'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { SummaryCard } from '@/components/SummaryCard';
import { Modal } from '@/components/Modal';
import { InviteModal } from '@/components/InviteModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CountrySelect } from '@/components/CountrySelect';
import { useLanguage } from '@/lib/i18n/context';
import { countryNameToCode, orderedCountryCodes } from '@/lib/countries';
import { Flag } from '@/components/Flag';
import { daysBetween, fmtDate, fmtMoney, routeStatus, findOverlap, type RouteStatus } from '@/lib/dates';
import type { TripWithRelations, ExpenseCategory, TripRoute, Expense, Place, Hotel, Flight, TripPerson } from '@/lib/types';

const PALETTE = ['#e8524b', '#ef9a3d', '#9a6fe0', '#2f9be0', '#24b8bd', '#23b287', '#79c94a', '#f0bc2e'];

const CATEGORY_META: Record<ExpenseCategory, { labelKey: string; color: string; transport: boolean }> = {
  comida: { labelKey: 'expense.catFood', color: '#f0bc2e', transport: false },
  passagem_trem: { labelKey: 'expense.tagTrain', color: '#24b8bd', transport: true },
  passagem_barco: { labelKey: 'expense.tagBoat', color: '#2f9be0', transport: true },
  outro: { labelKey: 'expense.catOther', color: '#9a6fe0', transport: false },
};

type Tab = 'roteiro' | 'voos' | 'hoteis' | 'pessoas';
type ModalState =
  | { type: 'route'; edit?: TripRoute }
  | { type: 'expense'; routeId: string; edit?: Expense }
  | { type: 'flight'; edit?: Flight }
  | { type: 'hotel'; edit?: Hotel }
  | { type: 'person'; edit?: TripPerson }
  | { type: 'invite' }
  | { type: 'place'; routeId: string; edit?: Place }
  | null;

type DeleteTable = 'trip_routes' | 'expenses' | 'flights' | 'hotels' | 'trip_people' | 'trip_route_places';
type DeleteTarget = { table: DeleteTable; id: string; label: string } | null;

function tripTotal(trip: TripWithRelations): number {
  const flights = trip.flights.reduce((s, f) => s + Number(f.amount || 0), 0);
  const hotels = trip.hotels.reduce((s, h) => s + Number(h.amount || 0), 0);
  const routeExp = trip.trip_routes.reduce((s, r) => s + r.expenses.reduce((s2, e) => s2 + Number(e.amount || 0), 0), 0);
  return flights + hotels + routeExp;
}

export function TripDetailClient({ trip, isOwner }: { trip: TripWithRelations; isOwner: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const { lang, t } = useLanguage();

  const [tab, setTab] = useState<Tab>('roteiro');
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, [supabase]);

  function openModal(m: ModalState) { setError(''); setModal(m); }
  function closeModal() { setModal(null); setError(''); }

  async function refresh() {
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: err } = await supabase.from(deleteTarget.table).delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (err) { setError(err.message); setDeleteTarget(null); return; }
    setDeleteTarget(null);
    refresh();
  }

  // ---------- ROTEIRO ----------
  async function submitRoute(data: { country: string; city: string; start_date: string; end_date: string }, id?: string) {
    if (trip.start_date && trip.end_date && data.start_date && data.end_date) {
      if (data.start_date < trip.start_date || data.end_date > trip.end_date) {
        setError(t('route.outsidePeriod', { from: fmtDate(trip.start_date, lang), to: fmtDate(trip.end_date, lang) }));
        return;
      }
    }
    const otherRoutes = id ? trip.trip_routes.filter((r) => r.id !== id) : trip.trip_routes;
    const overlap = findOverlap(otherRoutes, { start_date: data.start_date, end_date: data.end_date });
    if (overlap) {
      setError(t('route.overlap', { city: overlap.city, from: fmtDate(overlap.start_date, lang), to: fmtDate(overlap.end_date, lang) }));
      return;
    }
    setSaving(true);
    const payload = {
      country: data.country,
      city: data.city,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
    };
    const { error: err } = id
      ? await supabase.from('trip_routes').update(payload).eq('id', id)
      : await supabase.from('trip_routes').insert({ ...payload, trip_id: trip.id, order_index: trip.trip_routes.length });
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  async function submitExpense(routeId: string, data: { category: ExpenseCategory; description: string; amount: number }, id?: string) {
    setSaving(true);
    const payload = { category: data.category, description: data.description, amount: data.amount };
    const { error: err } = id
      ? await supabase.from('expenses').update(payload).eq('id', id)
      : await supabase.from('expenses').insert({ ...payload, trip_id: trip.id, route_id: routeId });
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  async function submitFlight(data: { description: string; amount: number; flight_date: string }, id?: string) {
    setSaving(true);
    const payload = { description: data.description, amount: data.amount, flight_date: data.flight_date || null };
    const { error: err } = id
      ? await supabase.from('flights').update(payload).eq('id', id)
      : await supabase.from('flights').insert({ ...payload, trip_id: trip.id });
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  async function submitHotel(data: { name: string; address: string; checkin: string; checkout: string; link: string; notes: string; amount: number; reservation_number: string; file: File | null }, id?: string) {
    setSaving(true);
    const payload = {
      name: data.name,
      address: data.address,
      checkin: data.checkin || null,
      checkout: data.checkout || null,
      link: data.link || null,
      notes: data.notes || null,
      amount: data.amount,
      reservation_number: data.reservation_number || null,
    };

    let hotelId = id;
    if (id) {
      const { error: err } = await supabase.from('hotels').update(payload).eq('id', id);
      if (err) { setSaving(false); setError(err.message); return; }
    } else {
      const { data: hotel, error: err } = await supabase.from('hotels').insert({ ...payload, trip_id: trip.id }).select('id').single();
      if (err) { setSaving(false); setError(err.message); return; }
      hotelId = hotel.id;
    }

    if (data.file && hotelId) {
      const form = new FormData();
      form.append('file', data.file);
      form.append('tripId', trip.id);
      form.append('hotelId', hotelId);
      const res = await fetch('/api/hotel-files', { method: 'POST', body: form });
      const body = await res.json();
      if (res.ok) {
        await supabase.from('hotels').update({ reservation_file_path: body.path }).eq('id', hotelId);
      } else {
        setSaving(false);
        setError(t('hotel.savedButAttachmentFailed', { error: body.error }));
        refresh();
        return;
      }
    }

    setSaving(false);
    closeModal();
    refresh();
  }

  async function attachHotelFile(hotelId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('tripId', trip.id);
    form.append('hotelId', hotelId);
    const res = await fetch('/api/hotel-files', { method: 'POST', body: form });
    const body = await res.json();
    if (!res.ok) { setError(body.error); return; }
    await supabase.from('hotels').update({ reservation_file_path: body.path }).eq('id', hotelId);
    refresh();
  }

  async function viewHotelFile(path: string) {
    const res = await fetch(`/api/hotel-files/download?path=${encodeURIComponent(path)}`);
    if (!res.ok) { setError(t('hotel.cannotOpenAttachment')); return; }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  }

  async function submitPlace(routeId: string, data: { name: string; notes: string }, id?: string) {
    setSaving(true);
    const payload = { name: data.name, notes: data.notes || null };
    const { error: err } = id
      ? await supabase.from('trip_route_places').update(payload).eq('id', id)
      : await supabase.from('trip_route_places').insert({ ...payload, route_id: routeId });
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  async function togglePlace(placeId: string, visited: boolean) {
    await supabase.from('trip_route_places').update({ visited: !visited }).eq('id', placeId);
    refresh();
  }

  async function submitPerson(data: { name: string; age: number | null }, id?: string) {
    setSaving(true);
    const payload = { name: data.name, age: data.age };
    const { error: err } = id
      ? await supabase.from('trip_people').update(payload).eq('id', id)
      : await supabase.from('trip_people').insert({ ...payload, trip_id: trip.id });
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  const total = tripTotal(trip);

  return (
    <div>
      <div className="topbar">
        <Logo markSize={34} />
        <div className="topbar-actions">
          <LanguageSwitcher />
          <a className="btn btn-outline" href="/perfil">
            <User size={16} strokeWidth={2.25} /> <span className="btn-label">{t('nav.personalArea')}</span>
          </a>
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
        <a className="back-link" href="/dashboard">{t('trip.backToAll')}</a>
        <h1 className="page-title">
          {trip.name}
          {!isOwner && <span className="status-badge badge-future" style={{ marginLeft: 12, verticalAlign: 'middle' }}>{t('trip.viewOnly')}</span>}
        </h1>

        <SummaryCard startDate={trip.start_date} endDate={trip.end_date} peopleCount={trip.trip_people.length} total={total} flags={orderedCountryCodes(trip.trip_routes)} />

        <div className="tabs">
          <button className={'tab ' + (tab === 'roteiro' ? 'active' : '')} onClick={() => setTab('roteiro')}>{t('trip.tabRoute')}<span className="count">{trip.trip_routes.length}</span></button>
          <button className={'tab ' + (tab === 'voos' ? 'active' : '')} onClick={() => setTab('voos')}>{t('trip.tabFlights')}<span className="count">{trip.flights.length}</span></button>
          <button className={'tab ' + (tab === 'hoteis' ? 'active' : '')} onClick={() => setTab('hoteis')}>{t('trip.tabHotels')}<span className="count">{trip.hotels.length}</span></button>
          <button className={'tab ' + (tab === 'pessoas' ? 'active' : '')} onClick={() => setTab('pessoas')}>{t('trip.tabPeople')}<span className="count">{trip.trip_people.length}</span></button>
        </div>

        {tab === 'roteiro' && (
          <div>
            <div className="section-head">
              <h2>{t('route.sectionTitle')}</h2>
              {isOwner && <button className="add-btn" onClick={() => openModal({ type: 'route' })}>{t('route.addCity')}</button>}
            </div>
            {trip.trip_routes
              .slice()
              .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))
              .map((r, idx) => (
                <RouteItem
                  key={r.id}
                  route={r}
                  idx={idx}
                  isOwner={isOwner}
                  onAddExpense={(routeId) => openModal({ type: 'expense', routeId })}
                  onAddPlace={(routeId) => openModal({ type: 'place', routeId })}
                  onTogglePlace={togglePlace}
                  onEditRoute={(route) => openModal({ type: 'route', edit: route })}
                  onDeleteRoute={(route) => setDeleteTarget({ table: 'trip_routes', id: route.id, label: route.city })}
                  onEditExpense={(routeId, expense) => openModal({ type: 'expense', routeId, edit: expense })}
                  onDeleteExpense={(expense) => setDeleteTarget({ table: 'expenses', id: expense.id, label: expense.description || t('expense.formTitle') })}
                  onEditPlace={(routeId, place) => openModal({ type: 'place', routeId, edit: place })}
                  onDeletePlace={(place) => setDeleteTarget({ table: 'trip_route_places', id: place.id, label: place.name })}
                />
              ))}
          </div>
        )}

        {tab === 'voos' && (
          <div>
            <div className="section-head">
              <h2>{t('flight.sectionTitle')}</h2>
              {isOwner && <button className="add-btn" onClick={() => openModal({ type: 'flight' })}>{t('flight.addFlight')}</button>}
            </div>
            <div className="flat-list">
              {trip.flights.map((f) => (
                <div className="list-card" key={f.id}>
                  <div className="main">
                    <div className="title">{f.description}</div>
                    <div className="sub">{fmtDate(f.flight_date, lang)} · {t('flight.notLinked')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div className="amount">{fmtMoney(f.amount, lang)}</div>
                    {isOwner && (
                      <div className="item-actions">
                        <button className="icon-btn" onClick={() => openModal({ type: 'flight', edit: f })} aria-label={t('common.edit')}><Pencil size={14} /></button>
                        <button className="icon-btn danger" onClick={() => setDeleteTarget({ table: 'flights', id: f.id, label: f.description })} aria-label={t('common.delete')}><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'hoteis' && (
          <div>
            <div className="section-head">
              <h2>{t('hotel.sectionTitle')}</h2>
              {isOwner && <button className="add-btn" onClick={() => openModal({ type: 'hotel' })}>{t('hotel.addHotel')}</button>}
            </div>
            <div className="flat-list">
              {trip.hotels.map((h) => (
                <HotelCard
                  key={h.id}
                  hotel={h}
                  isOwner={isOwner}
                  onAttach={attachHotelFile}
                  onView={viewHotelFile}
                  onEdit={(hotel) => openModal({ type: 'hotel', edit: hotel })}
                  onDelete={(hotel) => setDeleteTarget({ table: 'hotels', id: hotel.id, label: hotel.name })}
                />
              ))}
            </div>
          </div>
        )}

        {tab === 'pessoas' && (
          <div>
            <div className="section-head">
              <h2>{t('person.sectionTitle')}</h2>
              {isOwner && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="add-btn" onClick={() => openModal({ type: 'invite' })}>{t('person.invite')}</button>
                  <button className="add-btn" onClick={() => openModal({ type: 'person' })}>{t('person.addPerson')}</button>
                </div>
              )}
            </div>
            <div className="people-grid">
              {trip.trip_people.map((p, i) => (
                <div className="person-card" key={p.id}>
                  <div className="person-avatar" style={{ background: PALETTE[i % PALETTE.length] }}>{p.name.slice(0, 1).toUpperCase()}</div>
                  <div className="name">{p.name}</div>
                  <div className="age">{p.age ? `${p.age} ${t('common.years')}` : '—'}</div>
                  {isOwner && (
                    <div className="item-actions" style={{ justifyContent: 'center', marginTop: 12 }}>
                      <button className="icon-btn" onClick={() => openModal({ type: 'person', edit: p })} aria-label={t('common.edit')}><Pencil size={14} /></button>
                      <button className="icon-btn danger" onClick={() => setDeleteTarget({ table: 'trip_people', id: p.id, label: p.name })} aria-label={t('common.delete')}><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modal?.type === 'route' && (
        <RouteFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => submitRoute(data, modal.edit?.id)} tripStart={trip.start_date} tripEnd={trip.end_date} initial={modal.edit} />
      )}
      {modal?.type === 'expense' && (
        <ExpenseFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => submitExpense(modal.routeId, data, modal.edit?.id)} initial={modal.edit} />
      )}
      {modal?.type === 'flight' && (
        <FlightFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => submitFlight(data, modal.edit?.id)} initial={modal.edit} />
      )}
      {modal?.type === 'hotel' && (
        <HotelFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => submitHotel(data, modal.edit?.id)} initial={modal.edit} />
      )}
      {modal?.type === 'person' && (
        <PersonFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => submitPerson(data, modal.edit?.id)} initial={modal.edit} />
      )}
      {modal?.type === 'invite' && (
        <InviteModal tripId={trip.id} onClose={closeModal} />
      )}
      {modal?.type === 'place' && (
        <PlaceFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => submitPlace(modal.routeId, data, modal.edit?.id)} initial={modal.edit} />
      )}

      {deleteTarget && (
        <Modal title={t('common.confirmDeleteTitle')} onClose={() => setDeleteTarget(null)}>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '0 0 20px' }}>
            {t('common.confirmDeleteText', { item: deleteTarget.label })}
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

// ============================================================
// Roteiro: item de cidade com transporte por padrão + linha do tempo
// ============================================================
function RouteItem({ route, idx, isOwner, onAddExpense, onAddPlace, onTogglePlace, onEditRoute, onDeleteRoute, onEditExpense, onDeleteExpense, onEditPlace, onDeletePlace }: {
  route: TripRoute & { expenses: Expense[]; places: Place[] };
  idx: number;
  isOwner: boolean;
  onAddExpense: (routeId: string) => void;
  onAddPlace: (routeId: string) => void;
  onTogglePlace: (placeId: string, visited: boolean) => void;
  onEditRoute: (route: TripRoute) => void;
  onDeleteRoute: (route: TripRoute) => void;
  onEditExpense: (routeId: string, expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
  onEditPlace: (routeId: string, place: Place) => void;
  onDeletePlace: (place: Place) => void;
}) {
  const { lang, t } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const status: RouteStatus = routeStatus(route);
  const transportExpenses = route.expenses.filter((e) => CATEGORY_META[e.category].transport);
  const otherCount = route.expenses.length - transportExpenses.length;
  const visible = showAll ? route.expenses : transportExpenses;
  const badgeLabel = { past: t('route.statusPast'), current: t('route.statusCurrent'), future: t('route.statusFuture') }[status];

  return (
    <div className={'route-item status-' + status}>
      <div className="route-main">
        <div className="route-left">
          <div className="route-dot" style={{ background: PALETTE[idx % PALETTE.length] }} />
          <div>
            <h4>{route.city}</h4>
            <div className="loc-sub">
              {countryNameToCode(route.country) && <Flag code={countryNameToCode(route.country)!} size={16} className="loc-flag" />}
              {route.country}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div className="route-dates">{fmtDate(route.start_date, lang)} — {fmtDate(route.end_date, lang)} · {daysBetween(route.start_date, route.end_date)} {t('common.nights')}</div>
            <span className={'status-badge badge-' + status}>{badgeLabel}</span>
          </div>
          {isOwner && (
            <div className="item-actions">
              <button className="icon-btn" onClick={() => onEditRoute(route)} aria-label={t('common.edit')}><Pencil size={14} /></button>
              <button className="icon-btn danger" onClick={() => onDeleteRoute(route)} aria-label={t('common.delete')}><Trash2 size={14} /></button>
            </div>
          )}
        </div>
      </div>
      <div className="route-expenses">
        <div className="route-expenses-label">{showAll ? t('route.allExpenses') : t('route.transportOnly')}</div>
        {visible.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{t('route.noExpenses')}</div>}
        {visible.map((e) => (
          <div className="expense-row" key={e.id}>
            <div>
              <span className="expense-tag" style={{ background: CATEGORY_META[e.category].color }}>{t(CATEGORY_META[e.category].labelKey)}</span>
              {e.description}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="expense-amount">{fmtMoney(e.amount, lang)}</span>
              {isOwner && (
                <div className="item-actions">
                  <button className="icon-btn" onClick={() => onEditExpense(route.id, e)} aria-label={t('common.edit')}><Pencil size={13} /></button>
                  <button className="icon-btn danger" onClick={() => onDeleteExpense(e)} aria-label={t('common.delete')}><Trash2 size={13} /></button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 8 }}>
          {isOwner && <button className="mini-add" onClick={() => onAddExpense(route.id)}>{t('route.addExpense')}</button>}
          {otherCount > 0 && (
            <button className="mini-add" onClick={() => setShowAll((s) => !s)}>
              {showAll ? t('route.viewTransportOnly') : t('route.viewAllExpenses', { count: route.expenses.length })}
            </button>
          )}
        </div>
      </div>
      <div className="route-expenses" style={{ borderTop: '1px dashed var(--border)' }}>
        <div className="route-expenses-label">{t('route.placesTitle')}</div>
        {route.places.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{t('route.noPlaces')}</div>}
        {route.places.map((p) => (
          <div className="expense-row" key={p.id}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: isOwner ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={p.visited} disabled={!isOwner} onChange={() => isOwner && onTogglePlace(p.id, p.visited)} />
              <span style={{ textDecoration: p.visited ? 'line-through' : 'none', color: p.visited ? 'var(--ink-soft)' : 'var(--ink)' }}>{p.name}</span>
              {p.notes && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{p.notes}</span>}
            </label>
            {isOwner && (
              <div className="item-actions">
                <button className="icon-btn" onClick={() => onEditPlace(route.id, p)} aria-label={t('common.edit')}><Pencil size={13} /></button>
                <button className="icon-btn danger" onClick={() => onDeletePlace(p)} aria-label={t('common.delete')}><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        ))}
        {isOwner && <button className="mini-add" onClick={() => onAddPlace(route.id)}>{t('route.addPlace')}</button>}
      </div>
    </div>
  );
}

// ============================================================
// Formulários (cada um é um pequeno modal com seu próprio estado)
// ============================================================
function RouteFormModal({ onClose, onSubmit, error, saving, tripStart, tripEnd, initial }: {
  onClose: () => void;
  onSubmit: (d: { country: string; city: string; start_date: string; end_date: string }) => void;
  error: string;
  saving: boolean;
  tripStart: string | null;
  tripEnd: string | null;
  initial?: TripRoute;
}) {
  const { lang, t } = useLanguage();
  const [country, setCountry] = useState(initial?.country ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  return (
    <Modal title={initial ? t('route.editTitle') : t('route.formTitle')} onClose={onClose} error={error}>
      <div className="field-row">
        <div className="field"><label>{t('route.country')}</label><CountrySelect value={country} onChange={setCountry} placeholder={t('route.countryPlaceholder')} /></div>
        <div className="field"><label>{t('route.city')}</label><input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('route.cityPlaceholder')} /></div>
      </div>
      <div className="field-row">
        <div className="field"><label>{t('route.arrival')}</label><input type="date" value={startDate} min={tripStart || undefined} max={tripEnd || undefined} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="field"><label>{t('route.departure')}</label><input type="date" value={endDate} min={tripStart || undefined} max={tripEnd || undefined} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      {tripStart && tripEnd && (
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: -6 }}>
          {t('route.periodHint', { from: fmtDate(tripStart, lang), to: fmtDate(tripEnd, lang) })}
        </p>
      )}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => onSubmit({ country, city, start_date: startDate, end_date: endDate })}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}

function ExpenseFormModal({ onClose, onSubmit, error, saving, initial }: { onClose: () => void; onSubmit: (d: { category: ExpenseCategory; description: string; amount: number }) => void; error: string; saving: boolean; initial?: Expense }) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? 'comida');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  return (
    <Modal title={initial ? t('expense.editTitle') : t('expense.formTitle')} onClose={onClose} error={error}>
      <div className="field">
        <label>{t('expense.category')}</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
          <option value="comida">{t('expense.catFood')}</option>
          <option value="passagem_trem">{t('expense.catTrain')}</option>
          <option value="passagem_barco">{t('expense.catBoat')}</option>
          <option value="outro">{t('expense.catOther')}</option>
        </select>
      </div>
      <div className="field"><label>{t('expense.description')}</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('expense.descriptionPlaceholder')} /></div>
      <div className="field"><label>{t('expense.amount')}</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => onSubmit({ category, description, amount: Number(amount) || 0 })}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}

function FlightFormModal({ onClose, onSubmit, error, saving, initial }: { onClose: () => void; onSubmit: (d: { description: string; amount: number; flight_date: string }) => void; error: string; saving: boolean; initial?: Flight }) {
  const { t } = useLanguage();
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [date, setDate] = useState(initial?.flight_date ?? '');
  return (
    <Modal title={initial ? t('flight.editTitle') : t('flight.formTitle')} onClose={onClose} error={error}>
      <div className="field"><label>{t('flight.description')}</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('flight.descriptionPlaceholder')} /></div>
      <div className="field-row">
        <div className="field"><label>{t('flight.date')}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label>{t('flight.amount')}</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: -6 }}>{t('flight.hint')}</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => onSubmit({ description, amount: Number(amount) || 0, flight_date: date })}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}

function HotelFormModal({ onClose, onSubmit, error, saving, initial }: {
  onClose: () => void;
  onSubmit: (d: { name: string; address: string; checkin: string; checkout: string; link: string; notes: string; amount: number; reservation_number: string; file: File | null }) => void;
  error: string;
  saving: boolean;
  initial?: Hotel;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [checkin, setCheckin] = useState(initial?.checkin ?? '');
  const [checkout, setCheckout] = useState(initial?.checkout ?? '');
  const [link, setLink] = useState(initial?.link ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [reservationNumber, setReservationNumber] = useState(initial?.reservation_number_decrypted ?? '');
  const [file, setFile] = useState<File | null>(null);
  return (
    <Modal title={initial ? t('hotel.editTitle') : t('hotel.formTitle')} onClose={onClose} error={error}>
      <div className="field"><label>{t('hotel.name')}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('hotel.namePlaceholder')} /></div>
      <div className="field"><label>{t('hotel.address')}</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('hotel.addressPlaceholder')} /></div>
      <div className="field-row">
        <div className="field"><label>{t('hotel.checkin')}</label><input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} /></div>
        <div className="field"><label>{t('hotel.checkout')}</label><input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} /></div>
      </div>
      <div className="field"><label>{t('hotel.reservationLink')}</label><input value={link} onChange={(e) => setLink(e.target.value)} placeholder={t('hotel.reservationLinkPlaceholder')} /></div>
      <div className="field"><label>{t('hotel.reservationNumber')}</label><input value={reservationNumber} onChange={(e) => setReservationNumber(e.target.value)} placeholder={t('hotel.reservationNumberPlaceholder')} /></div>
      <div className="field"><label>{t('hotel.notes')}</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('hotel.notesPlaceholder')} /></div>
      <div className="field"><label>{t('hotel.amount')}</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
      <div className="field">
        <label>{t('hotel.attachmentLabel')}</label>
        <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '6px 0 0' }}>{t('hotel.encryptedNote')}</p>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => onSubmit({ name, address, checkin, checkout, link, notes, amount: Number(amount) || 0, reservation_number: reservationNumber, file })}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}

function HotelCard({ hotel, isOwner, onAttach, onView, onEdit, onDelete }: { hotel: Hotel; isOwner: boolean; onAttach: (hotelId: string, file: File) => void; onView: (path: string) => void; onEdit: (hotel: Hotel) => void; onDelete: (hotel: Hotel) => void }) {
  const { lang, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="hotel-card">
      <div className="card-head">
        <div className="hotel-top">
          <h4>{hotel.name}</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="amount" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmtMoney(hotel.amount, lang)}</div>
            {isOwner && (
              <div className="item-actions">
                <button className="icon-btn" onClick={() => onEdit(hotel)} aria-label={t('common.edit')}><Pencil size={14} /></button>
                <button className="icon-btn danger" onClick={() => onDelete(hotel)} aria-label={t('common.delete')}><Trash2 size={14} /></button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="card-body">
        <div className="hotel-addr">📍 {hotel.address}</div>
        <div className="hotel-meta">
          <span>{t('hotel.checkin')} <b>{fmtDate(hotel.checkin, lang)}</b></span>
          <span>{t('hotel.checkout')} <b>{fmtDate(hotel.checkout, lang)}</b></span>
          <span><b>{daysBetween(hotel.checkin, hotel.checkout)}</b> {t('common.nights')}</span>
        </div>
        {hotel.reservation_number_decrypted && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 10 }}>{t('hotel.reservationNo')} <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{hotel.reservation_number_decrypted}</b></div>
        )}
        {hotel.notes && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 10 }}>“{hotel.notes}”</div>}
        <div className="hotel-actions">
          {hotel.link && <a className="pill-btn" href={hotel.link} target="_blank" rel="noreferrer">{t('hotel.viewReservation')}</a>}
          {hotel.reservation_file_path ? (
            <button className="pill-btn" onClick={() => onView(hotel.reservation_file_path as string)}>{t('hotel.viewAttachment')}</button>
          ) : isOwner ? (
            <>
              <button className="pill-btn" onClick={() => fileInputRef.current?.click()}>{t('hotel.attachReservation')}</button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach(hotel.id, f); }}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PersonFormModal({ onClose, onSubmit, error, saving, initial }: { onClose: () => void; onSubmit: (d: { name: string; age: number | null }) => void; error: string; saving: boolean; initial?: TripPerson }) {
  const { t } = useLanguage();
  const [name, setName] = useState(initial?.name ?? '');
  const [age, setAge] = useState(initial?.age != null ? String(initial.age) : '');
  return (
    <Modal title={initial ? t('person.editTitle') : t('person.formTitle')} onClose={onClose} error={error}>
      <div className="field-row">
        <div className="field"><label>{t('person.name')}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('person.namePlaceholder')} /></div>
        <div className="field" style={{ maxWidth: 100 }}><label>{t('person.age')}</label><input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="0" /></div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => onSubmit({ name, age: age ? Number(age) : null })}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}

function PlaceFormModal({ onClose, onSubmit, error, saving, initial }: { onClose: () => void; onSubmit: (d: { name: string; notes: string }) => void; error: string; saving: boolean; initial?: Place }) {
  const { t } = useLanguage();
  const [name, setName] = useState(initial?.name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  return (
    <Modal title={initial ? t('place.editTitle') : t('place.formTitle')} onClose={onClose} error={error}>
      <div className="field"><label>{t('place.name')}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('place.namePlaceholder')} /></div>
      <div className="field"><label>{t('place.notes')}</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('place.notesPlaceholder')} /></div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => onSubmit({ name, notes })}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}
