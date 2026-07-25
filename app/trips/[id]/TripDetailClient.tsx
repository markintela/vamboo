'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { SummaryCard } from '@/components/SummaryCard';
import { Modal } from '@/components/Modal';
import { InviteModal } from '@/components/InviteModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CountrySelect } from '@/components/CountrySelect';
import { useLanguage } from '@/lib/i18n/context';
import { countryNameToFlag, orderedCountryFlags } from '@/lib/countries';
import { daysBetween, fmtDate, fmtMoney, routeStatus, findOverlap, type RouteStatus } from '@/lib/dates';
import type { TripWithRelations, ExpenseCategory, TripRoute, Expense, Place, Hotel } from '@/lib/types';

const PALETTE = ['#e8524b', '#ef9a3d', '#9a6fe0', '#2f9be0', '#24b8bd', '#23b287', '#79c94a', '#f0bc2e'];

const CATEGORY_META: Record<ExpenseCategory, { labelKey: string; color: string; transport: boolean }> = {
  comida: { labelKey: 'expense.catFood', color: '#f0bc2e', transport: false },
  passagem_trem: { labelKey: 'expense.tagTrain', color: '#24b8bd', transport: true },
  passagem_barco: { labelKey: 'expense.tagBoat', color: '#2f9be0', transport: true },
  outro: { labelKey: 'expense.catOther', color: '#9a6fe0', transport: false },
};

type Tab = 'roteiro' | 'voos' | 'hoteis' | 'pessoas';
type ModalState =
  | { type: 'route' }
  | { type: 'expense'; routeId: string }
  | { type: 'flight' }
  | { type: 'hotel' }
  | { type: 'person' }
  | { type: 'invite' }
  | { type: 'place'; routeId: string }
  | null;

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, [supabase]);

  function openModal(m: ModalState) { setError(''); setModal(m); }
  function closeModal() { setModal(null); setError(''); }

  async function refresh() {
    router.refresh();
  }

  // ---------- ROTEIRO ----------
  async function submitRoute(data: { country: string; city: string; start_date: string; end_date: string }) {
    if (trip.start_date && trip.end_date && data.start_date && data.end_date) {
      if (data.start_date < trip.start_date || data.end_date > trip.end_date) {
        setError(t('route.outsidePeriod', { from: fmtDate(trip.start_date, lang), to: fmtDate(trip.end_date, lang) }));
        return;
      }
    }
    const overlap = findOverlap(trip.trip_routes, { start_date: data.start_date, end_date: data.end_date });
    if (overlap) {
      setError(t('route.overlap', { city: overlap.city, from: fmtDate(overlap.start_date, lang), to: fmtDate(overlap.end_date, lang) }));
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.from('trip_routes').insert({
      trip_id: trip.id,
      country: data.country,
      city: data.city,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      order_index: trip.trip_routes.length,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  async function submitExpense(routeId: string, data: { category: ExpenseCategory; description: string; amount: number }) {
    setSaving(true);
    const { error: err } = await supabase.from('expenses').insert({
      trip_id: trip.id,
      route_id: routeId,
      category: data.category,
      description: data.description,
      amount: data.amount,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  async function submitFlight(data: { description: string; amount: number; flight_date: string }) {
    setSaving(true);
    const { error: err } = await supabase.from('flights').insert({
      trip_id: trip.id,
      description: data.description,
      amount: data.amount,
      flight_date: data.flight_date || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  async function submitHotel(data: { name: string; address: string; checkin: string; checkout: string; link: string; notes: string; amount: number; reservation_number: string; file: File | null }) {
    setSaving(true);
    const { data: hotel, error: err } = await supabase
      .from('hotels')
      .insert({
        trip_id: trip.id,
        name: data.name,
        address: data.address,
        checkin: data.checkin || null,
        checkout: data.checkout || null,
        link: data.link || null,
        notes: data.notes || null,
        amount: data.amount,
        reservation_number: data.reservation_number || null,
      })
      .select('id')
      .single();
    if (err) { setSaving(false); setError(err.message); return; }

    if (data.file) {
      const form = new FormData();
      form.append('file', data.file);
      form.append('tripId', trip.id);
      form.append('hotelId', hotel.id);
      const res = await fetch('/api/hotel-files', { method: 'POST', body: form });
      const body = await res.json();
      if (res.ok) {
        await supabase.from('hotels').update({ reservation_file_path: body.path }).eq('id', hotel.id);
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

  async function submitPlace(routeId: string, data: { name: string; notes: string }) {
    setSaving(true);
    const { error: err } = await supabase.from('trip_route_places').insert({
      route_id: routeId,
      name: data.name,
      notes: data.notes || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  async function togglePlace(placeId: string, visited: boolean) {
    await supabase.from('trip_route_places').update({ visited: !visited }).eq('id', placeId);
    refresh();
  }

  async function submitPerson(data: { name: string; age: number | null }) {
    setSaving(true);
    const { error: err } = await supabase.from('trip_people').insert({
      trip_id: trip.id,
      name: data.name,
      age: data.age,
    });
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

        <SummaryCard startDate={trip.start_date} endDate={trip.end_date} peopleCount={trip.trip_people.length} total={total} flags={orderedCountryFlags(trip.trip_routes)} />

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
                  <div className="amount">{fmtMoney(f.amount, lang)}</div>
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
                <HotelCard key={h.id} hotel={h} isOwner={isOwner} onAttach={attachHotelFile} onView={viewHotelFile} />
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modal?.type === 'route' && (
        <RouteFormModal saving={saving} error={error} onClose={closeModal} onSubmit={submitRoute} tripStart={trip.start_date} tripEnd={trip.end_date} />
      )}
      {modal?.type === 'expense' && (
        <ExpenseFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => submitExpense(modal.routeId, data)} />
      )}
      {modal?.type === 'flight' && (
        <FlightFormModal saving={saving} error={error} onClose={closeModal} onSubmit={submitFlight} />
      )}
      {modal?.type === 'hotel' && (
        <HotelFormModal saving={saving} error={error} onClose={closeModal} onSubmit={submitHotel} />
      )}
      {modal?.type === 'person' && (
        <PersonFormModal saving={saving} error={error} onClose={closeModal} onSubmit={submitPerson} />
      )}
      {modal?.type === 'invite' && (
        <InviteModal tripId={trip.id} onClose={closeModal} />
      )}
      {modal?.type === 'place' && (
        <PlaceFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => submitPlace(modal.routeId, data)} />
      )}
    </div>
  );
}

// ============================================================
// Roteiro: item de cidade com transporte por padrão + linha do tempo
// ============================================================
function RouteItem({ route, idx, isOwner, onAddExpense, onAddPlace, onTogglePlace }: {
  route: TripRoute & { expenses: Expense[]; places: Place[] };
  idx: number;
  isOwner: boolean;
  onAddExpense: (routeId: string) => void;
  onAddPlace: (routeId: string) => void;
  onTogglePlace: (placeId: string, visited: boolean) => void;
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
            <div className="loc-sub">{countryNameToFlag(route.country) ? `${countryNameToFlag(route.country)} ` : ''}{route.country}</div>
          </div>
        </div>
        <div>
          <div className="route-dates">{fmtDate(route.start_date, lang)} — {fmtDate(route.end_date, lang)} · {daysBetween(route.start_date, route.end_date)} {t('common.nights')}</div>
          <span className={'status-badge badge-' + status}>{badgeLabel}</span>
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
            <span className="expense-amount">{fmtMoney(e.amount, lang)}</span>
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
          <label className="expense-row" key={p.id} style={{ cursor: isOwner ? 'pointer' : 'default', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={p.visited} disabled={!isOwner} onChange={() => isOwner && onTogglePlace(p.id, p.visited)} />
              <span style={{ textDecoration: p.visited ? 'line-through' : 'none', color: p.visited ? 'var(--ink-soft)' : 'var(--ink)' }}>{p.name}</span>
            </div>
            {p.notes && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{p.notes}</span>}
          </label>
        ))}
        {isOwner && <button className="mini-add" onClick={() => onAddPlace(route.id)}>{t('route.addPlace')}</button>}
      </div>
    </div>
  );
}

// ============================================================
// Formulários (cada um é um pequeno modal com seu próprio estado)
// ============================================================
function RouteFormModal({ onClose, onSubmit, error, saving, tripStart, tripEnd }: {
  onClose: () => void;
  onSubmit: (d: { country: string; city: string; start_date: string; end_date: string }) => void;
  error: string;
  saving: boolean;
  tripStart: string | null;
  tripEnd: string | null;
}) {
  const { lang, t } = useLanguage();
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  return (
    <Modal title={t('route.formTitle')} onClose={onClose} error={error}>
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

function ExpenseFormModal({ onClose, onSubmit, error, saving }: { onClose: () => void; onSubmit: (d: { category: ExpenseCategory; description: string; amount: number }) => void; error: string; saving: boolean }) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<ExpenseCategory>('comida');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  return (
    <Modal title={t('expense.formTitle')} onClose={onClose} error={error}>
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

function FlightFormModal({ onClose, onSubmit, error, saving }: { onClose: () => void; onSubmit: (d: { description: string; amount: number; flight_date: string }) => void; error: string; saving: boolean }) {
  const { t } = useLanguage();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  return (
    <Modal title={t('flight.formTitle')} onClose={onClose} error={error}>
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

function HotelFormModal({ onClose, onSubmit, error, saving }: {
  onClose: () => void;
  onSubmit: (d: { name: string; address: string; checkin: string; checkout: string; link: string; notes: string; amount: number; reservation_number: string; file: File | null }) => void;
  error: string;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState('');
  const [reservationNumber, setReservationNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  return (
    <Modal title={t('hotel.formTitle')} onClose={onClose} error={error}>
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

function HotelCard({ hotel, isOwner, onAttach, onView }: { hotel: Hotel; isOwner: boolean; onAttach: (hotelId: string, file: File) => void; onView: (path: string) => void }) {
  const { lang, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="hotel-card">
      <div className="hotel-top">
        <h4>{hotel.name}</h4>
        <div className="amount" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmtMoney(hotel.amount, lang)}</div>
      </div>
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
  );
}

function PersonFormModal({ onClose, onSubmit, error, saving }: { onClose: () => void; onSubmit: (d: { name: string; age: number | null }) => void; error: string; saving: boolean }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  return (
    <Modal title={t('person.formTitle')} onClose={onClose} error={error}>
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

function PlaceFormModal({ onClose, onSubmit, error, saving }: { onClose: () => void; onSubmit: (d: { name: string; notes: string }) => void; error: string; saving: boolean }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <Modal title={t('place.formTitle')} onClose={onClose} error={error}>
      <div className="field"><label>{t('place.name')}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('place.namePlaceholder')} /></div>
      <div className="field"><label>{t('place.notes')}</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('place.notesPlaceholder')} /></div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => onSubmit({ name, notes })}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}
