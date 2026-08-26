'use client';

import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { User, Pencil, Trash2, Calendar, Clock, Ticket } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { SummaryCard } from '@/components/SummaryCard';
import { TripMap } from '@/components/TripMap';
import { Modal } from '@/components/Modal';
import { InviteModal } from '@/components/InviteModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CountrySelect } from '@/components/CountrySelect';
import { useLanguage } from '@/lib/i18n/context';
import { countryNameToCode, orderedCountryCodes } from '@/lib/countries';
import { getCurrencyOptions } from '@/lib/currencies';
import { Flag } from '@/components/Flag';
import { daysBetween, fmtDate, fmtMoney, routeStatus, sumByCurrency, type RouteStatus } from '@/lib/dates';
import type {
  TripWithRelations, ExpenseCategory, TripRoute, Expense, Place, Hotel,
  TripTransport, TripTransportDocument, TransportType, TripPerson, TripCollaborator, CollaboratorRole,
} from '@/lib/types';

const PALETTE = ['#e8524b', '#ef9a3d', '#9a6fe0', '#2f9be0', '#24b8bd', '#23b287', '#79c94a', '#f0bc2e'];

const CATEGORY_META: Record<ExpenseCategory, { labelKey: string; color: string }> = {
  comida: { labelKey: 'expense.catFood', color: '#f0bc2e' },
  passagem_trem: { labelKey: 'expense.tagTrain', color: '#24b8bd' },
  passagem_barco: { labelKey: 'expense.tagBoat', color: '#2f9be0' },
  outro: { labelKey: 'expense.catOther', color: '#9a6fe0' },
};

const TRANSPORT_TYPES: TransportType[] = ['barco', 'aviao', 'trem', 'carro', 'onibus', 'ferry', 'mototaxi', 'outro'];
const TRANSPORT_META: Record<TransportType, { labelKey: string; color: string }> = {
  barco: { labelKey: 'transport.typeBarco', color: '#2f9be0' },
  aviao: { labelKey: 'transport.typeAviao', color: '#24b8bd' },
  trem: { labelKey: 'transport.typeTrem', color: '#23b287' },
  carro: { labelKey: 'transport.typeCarro', color: '#ef9a3d' },
  onibus: { labelKey: 'transport.typeOnibus', color: '#9a6fe0' },
  ferry: { labelKey: 'transport.typeFerry', color: '#79c94a' },
  mototaxi: { labelKey: 'transport.typeMototaxi', color: '#f0bc2e' },
  outro: { labelKey: 'transport.typeOutro', color: '#e8524b' },
};

type Tab = 'roteiro' | 'despesas' | 'pessoas';
type ExpenseSection = 'deslocamento' | 'hoteis' | 'gerais';

type ModalState =
  | { type: 'trip' }
  | { type: 'route'; edit?: TripRoute }
  | { type: 'transport'; edit?: TripTransport }
  | { type: 'transport-doc'; transportId: string }
  | { type: 'expense'; edit?: Expense }
  | { type: 'hotel'; edit?: Hotel }
  | { type: 'person'; edit?: TripPerson }
  | { type: 'invite' }
  | { type: 'place'; routeId: string; edit?: Place }
  | null;

type DeleteTable = 'trips' | 'trip_routes' | 'trip_transports' | 'expenses' | 'hotels' | 'trip_people' | 'trip_route_places' | 'trip_transport_documents';
type DeleteTarget = { table: DeleteTable; id: string; label: string; storagePath?: string } | null;

type DocViewerState = { url: string; mimeType: string; label: string; filename: string } | null;

function mergeTotals(...groups: Record<string, number>[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const g of groups) {
    for (const [currency, amount] of Object.entries(g)) {
      merged[currency] = (merged[currency] ?? 0) + amount;
    }
  }
  return merged;
}

export function TripDetailClient({ trip, isOwner, canEdit, collaborators, ownerProfile }: {
  trip: TripWithRelations;
  isOwner: boolean;
  canEdit: boolean;
  collaborators: TripCollaborator[];
  ownerProfile: { full_name: string | null; photo_path: string | null } | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { lang, t } = useLanguage();

  const [tab, setTab] = useState<Tab>('roteiro');
  const [expenseSection, setExpenseSection] = useState<ExpenseSection>('deslocamento');
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);
  const [docViewer, setDocViewer] = useState<DocViewerState>(null);

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
    if (deleteTarget.storagePath) {
      await supabase.storage.from('transport-documents').remove([deleteTarget.storagePath]);
    }
    setDeleteTarget(null);
    if (deleteTarget.table === 'trips') { router.push('/dashboard'); return; }
    refresh();
  }

  // ---------- DADOS DA TRIP (nome, datas, partida/chegada) ----------
  async function submitTrip(data: {
    name: string; start_date: string; end_date: string;
    departure_country: string; departure_city: string; arrival_country: string; arrival_city: string;
  }) {
    setSaving(true);
    const payload = {
      name: data.name,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      departure_country: data.departure_country || null,
      departure_city: data.departure_city || null,
      arrival_country: data.arrival_country || null,
      arrival_city: data.arrival_city || null,
    };
    const { error: err } = await supabase.from('trips').update(payload).eq('id', trip.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  // +1 é o próprio dono/criador da trip — ele não vira uma linha em
  // trip_people nem trip_collaborators, mas conta como pessoa da viagem.
  const peopleCount = 1 + trip.trip_people.length + collaborators.length;


  // ---------- ROTEIRO ----------
  async function submitRoute(data: { country: string; city: string; start_date: string; end_date: string }, id?: string) {
    if (trip.start_date && trip.end_date && data.start_date && data.end_date) {
      if (data.start_date < trip.start_date || data.end_date > trip.end_date) {
        setError(t('route.outsidePeriod', { from: fmtDate(trip.start_date, lang), to: fmtDate(trip.end_date, lang) }));
        return;
      }
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

  // ---------- DESPESAS: DESLOCAMENTO ----------
  async function submitTransport(data: {
    route_id: string; transport_type: TransportType; description: string; amount: number; currency: string;
    transport_date: string; flight_time: string; confirmation_code: string;
  }, id?: string) {
    setSaving(true);
    const payload = {
      route_id: data.route_id || null,
      transport_type: data.transport_type,
      description: data.description || null,
      amount: data.amount,
      currency: data.currency,
      transport_date: data.transport_date || null,
      flight_time: data.transport_type === 'aviao' ? (data.flight_time || null) : null,
      confirmation_code: data.transport_type === 'aviao' ? (data.confirmation_code || null) : null,
    };
    const { error: err } = id
      ? await supabase.from('trip_transports').update(payload).eq('id', id)
      : await supabase.from('trip_transports').insert({ ...payload, trip_id: trip.id });
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  // Um deslocamento pode ter vários documentos (bilhete, comprovante,
  // etc.), cada um com nome próprio — por isso é tabela filha
  // (trip_transport_documents), não mais uma coluna única no
  // deslocamento (migration 013).
  async function addTransportDocument(transportId: string, label: string, file: File) {
    setSaving(true);
    const form = new FormData();
    form.append('file', file);
    form.append('tripId', trip.id);
    form.append('transportId', transportId);
    const res = await fetch('/api/transport-files', { method: 'POST', body: form });
    const body = await res.json();
    if (!res.ok) { setSaving(false); setError(body.error); return; }
    const { error: err } = await supabase.from('trip_transport_documents').insert({
      transport_id: transportId,
      label: label.trim() || null,
      file_path: body.path,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  async function viewTransportDocument(path: string, label: string) {
    const res = await fetch(`/api/transport-files/download?path=${encodeURIComponent(path)}`);
    if (!res.ok) { setError(t('transport.cannotOpenAttachment')); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const filename = path.split('/').pop()?.replace(/\.enc$/, '') || label;
    setDocViewer({ url, mimeType: blob.type, label, filename });
  }

  function closeDocViewer() {
    if (docViewer) URL.revokeObjectURL(docViewer.url);
    setDocViewer(null);
  }

  // ---------- DESPESAS: HOTÉIS ----------
  async function submitHotel(data: {
    route_id: string; name: string; address: string; checkin: string; checkout: string; link: string;
    notes: string; amount: number; currency: string; reservation_number: string; file: File | null;
  }, id?: string) {
    setSaving(true);
    const payload = {
      route_id: data.route_id || null,
      name: data.name,
      address: data.address,
      checkin: data.checkin || null,
      checkout: data.checkout || null,
      link: data.link || null,
      notes: data.notes || null,
      amount: data.amount,
      currency: data.currency,
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

  // ---------- DESPESAS: GERAIS ----------
  async function submitExpense(data: { category: ExpenseCategory; description: string; amount: number; currency: string; route_id: string }, id?: string) {
    setSaving(true);
    const payload = { category: data.category, description: data.description, amount: data.amount, currency: data.currency, route_id: data.route_id || null };
    const { error: err } = id
      ? await supabase.from('expenses').update(payload).eq('id', id)
      : await supabase.from('expenses').insert({ ...payload, trip_id: trip.id });
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    refresh();
  }

  // ---------- PESSOAS ----------
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

  async function handleRoleChange(collaboratorId: string, userId: string, role: CollaboratorRole) {
    setRoleUpdating(collaboratorId);
    const { error: err } = await supabase.rpc('set_collaborator_role', { p_trip_id: trip.id, p_user_id: userId, p_role: role });
    setRoleUpdating(null);
    if (err) { setError(err.message); return; }
    refresh();
  }

  const gerais = trip.expenses.filter((e) => e.category === 'comida' || e.category === 'outro');
  const transportTotals = sumByCurrency(trip.trip_transports);
  const hotelTotals = sumByCurrency(trip.hotels);
  const geraisTotals = sumByCurrency(gerais);
  const tripTotals = mergeTotals(transportTotals, hotelTotals, geraisTotals);

  return (
    <div>
      <div className="topbar topbar-centered">
        <Logo markSize={34} />
        <div className="topbar-actions">
          <LanguageSwitcher />
          <a className="btn btn-outline" href="/perfil">
            <User size={16} strokeWidth={2.25} /> <span className="btn-label">{t('nav.personalArea')}</span>
          </a>
        </div>
      </div>

      {userEmail === null && (
        <div className="session-status session-status-warning">
          {t('session.expired')} <a href="/login">{t('session.goToLogin')}</a>
        </div>
      )}

      <div className="page">
        <a className="back-link" href="/dashboard">{t('trip.backToAll')}</a>
        <h1 className="page-title">
          {trip.name}
          {!canEdit && <span className="status-badge badge-future" style={{ marginLeft: 12, verticalAlign: 'middle' }}>{t('trip.viewOnly')}</span>}
          {canEdit && (
            <span className="item-actions" style={{ display: 'inline-flex', marginLeft: 12, verticalAlign: 'middle' }}>
              <button className="icon-btn" onClick={() => openModal({ type: 'trip' })} aria-label={t('common.edit')}><Pencil size={14} /></button>
              {isOwner && (
                <button className="icon-btn danger" onClick={() => setDeleteTarget({ table: 'trips', id: trip.id, label: trip.name })} aria-label={t('common.delete')}><Trash2 size={14} /></button>
              )}
            </span>
          )}
        </h1>

        <SummaryCard startDate={trip.start_date} endDate={trip.end_date} peopleCount={peopleCount} totalsByCurrency={tripTotals} flags={orderedCountryCodes(trip.trip_routes)} />

        <div className="expense-totals-row">
          <ExpenseCategoryTotal label={t('expensesTab.deslocamento')} totals={transportTotals} color="var(--blue)" />
          <ExpenseCategoryTotal label={t('expensesTab.hoteis')} totals={hotelTotals} color="var(--purple)" />
          <ExpenseCategoryTotal label={t('expensesTab.gerais')} totals={geraisTotals} color="var(--teal-green)" />
        </div>

        <TripMap routes={trip.trip_routes} />

        <div className="tabs">
          <button className={'tab ' + (tab === 'roteiro' ? 'active' : '')} onClick={() => setTab('roteiro')}>{t('trip.tabRoute')}<span className="count">{trip.trip_routes.length}</span></button>
          <button className={'tab ' + (tab === 'despesas' ? 'active' : '')} onClick={() => setTab('despesas')}>{t('trip.tabExpenses')}<span className="count">{trip.trip_transports.length + trip.hotels.length + gerais.length}</span></button>
          <button className={'tab ' + (tab === 'pessoas' ? 'active' : '')} onClick={() => setTab('pessoas')}>{t('trip.tabPeople')}<span className="count">{peopleCount}</span></button>
          <a className="tab" href={`/trips/${trip.id}/galeria`}>{t('trip.tabGallery')}</a>
        </div>

        {tab === 'roteiro' && (
          <div>
            <div className="section-head">
              <h2>{t('route.sectionTitle')}</h2>
              {canEdit && <button className="add-btn" onClick={() => openModal({ type: 'route' })}>{t('route.addCity')}</button>}
            </div>

            {trip.departure_city && <TripEndpoint label={t('trip.departurePoint')} country={trip.departure_country} city={trip.departure_city} />}

            {trip.trip_routes
              .slice()
              .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))
              .map((r, idx) => (
                <RouteItem
                  key={r.id}
                  route={r}
                  idx={idx}
                  canEdit={canEdit}
                  transports={trip.trip_transports.filter((tr) => tr.route_id === r.id)}
                  onAddPlace={(routeId) => openModal({ type: 'place', routeId })}
                  onTogglePlace={togglePlace}
                  onEditRoute={(route) => openModal({ type: 'route', edit: route })}
                  onDeleteRoute={(route) => setDeleteTarget({ table: 'trip_routes', id: route.id, label: route.city })}
                  onEditPlace={(routeId, place) => openModal({ type: 'place', routeId, edit: place })}
                  onDeletePlace={(place) => setDeleteTarget({ table: 'trip_route_places', id: place.id, label: place.name })}
                />
              ))}

            {trip.arrival_city && <TripEndpoint label={t('trip.arrivalPoint')} country={trip.arrival_country} city={trip.arrival_city} />}
          </div>
        )}

        {tab === 'despesas' && (
          <div>
            <div className="channel-toggle">
              <button className={'channel-btn ' + (expenseSection === 'deslocamento' ? 'active' : '')} onClick={() => setExpenseSection('deslocamento')}>{t('expensesTab.deslocamento')}</button>
              <button className={'channel-btn ' + (expenseSection === 'hoteis' ? 'active' : '')} onClick={() => setExpenseSection('hoteis')}>{t('expensesTab.hoteis')}</button>
              <button className={'channel-btn ' + (expenseSection === 'gerais' ? 'active' : '')} onClick={() => setExpenseSection('gerais')}>{t('expensesTab.gerais')}</button>
            </div>

            {expenseSection === 'deslocamento' && (
              <div>
                <div className="section-head">
                  <h2>{t('transport.sectionTitle')}</h2>
                  {canEdit && <button className="add-btn" onClick={() => openModal({ type: 'transport' })}>{t('transport.addTransport')}</button>}
                </div>
                <ExpenseCityGroups
                  items={trip.trip_transports}
                  routes={trip.trip_routes}
                  emptyLabel={t('transport.empty')}
                  renderItem={(tr) => (
                    <TransportListItem
                      key={tr.id}
                      transport={tr}
                      canEdit={canEdit}
                      onAddDocument={(transportId) => openModal({ type: 'transport-doc', transportId })}
                      onViewDocument={viewTransportDocument}
                      onDeleteDocument={(doc) => setDeleteTarget({ table: 'trip_transport_documents', id: doc.id, label: doc.label || t('transport.documentFallbackName'), storagePath: doc.file_path })}
                      onEdit={(transport) => openModal({ type: 'transport', edit: transport })}
                      onDelete={(transport) => setDeleteTarget({ table: 'trip_transports', id: transport.id, label: t(TRANSPORT_META[transport.transport_type].labelKey) })}
                    />
                  )}
                />
              </div>
            )}

            {expenseSection === 'hoteis' && (
              <div>
                <div className="section-head">
                  <h2>{t('hotel.sectionTitle')}</h2>
                  {canEdit && <button className="add-btn" onClick={() => openModal({ type: 'hotel' })}>{t('hotel.addHotel')}</button>}
                </div>
                <ExpenseCityGroups
                  items={trip.hotels}
                  routes={trip.trip_routes}
                  emptyLabel={t('hotel.empty')}
                  renderItem={(h) => (
                    <HotelCard
                      key={h.id}
                      hotel={h}
                      canEdit={canEdit}
                      onAttach={attachHotelFile}
                      onView={viewHotelFile}
                      onEdit={(hotel) => openModal({ type: 'hotel', edit: hotel })}
                      onDelete={(hotel) => setDeleteTarget({ table: 'hotels', id: hotel.id, label: hotel.name })}
                    />
                  )}
                />
              </div>
            )}

            {expenseSection === 'gerais' && (
              <div>
                <div className="section-head">
                  <h2>{t('expense.sectionTitle')}</h2>
                  {canEdit && <button className="add-btn" onClick={() => openModal({ type: 'expense' })}>{t('expense.addExpense')}</button>}
                </div>
                <ExpenseCityGroups
                  items={gerais}
                  routes={trip.trip_routes}
                  emptyLabel={t('expense.empty')}
                  renderItem={(e) => (
                    <div className="list-card" key={e.id}>
                      <div className="main">
                        <div className="title">
                          <span className="expense-tag" style={{ background: CATEGORY_META[e.category].color }}>{t(CATEGORY_META[e.category].labelKey)}</span>
                          {e.description}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div className="amount">{fmtMoney(e.amount, lang, e.currency)}</div>
                        {canEdit && (
                          <div className="item-actions">
                            <button className="icon-btn" onClick={() => openModal({ type: 'expense', edit: e })} aria-label={t('common.edit')}><Pencil size={14} /></button>
                            <button className="icon-btn danger" onClick={() => setDeleteTarget({ table: 'expenses', id: e.id, label: e.description || t('expense.formTitle') })} aria-label={t('common.delete')}><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                />
              </div>
            )}
          </div>
        )}

        {tab === 'pessoas' && (
          <div>
            <div className="section-head">
              <h2>{t('person.sectionTitle')}</h2>
              {canEdit && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="add-btn" onClick={() => openModal({ type: 'invite' })}>{t('person.invite')}</button>
                  <button className="add-btn" onClick={() => openModal({ type: 'person' })}>{t('person.addPerson')}</button>
                </div>
              )}
            </div>
            <div className="people-grid">
              <OwnerCard fullName={ownerProfile?.full_name ?? null} photoPath={ownerProfile?.photo_path ?? null} userId={trip.user_id} />
              {trip.trip_people.map((p, i) => (
                <div className="person-card" key={p.id}>
                  <div className="person-avatar" style={{ background: PALETTE[i % PALETTE.length] }}>{p.name.slice(0, 1).toUpperCase()}</div>
                  <div className="name">{p.name}</div>
                  <div className="age">{p.age ? `${p.age} ${t('common.years')}` : '—'}</div>
                  {canEdit && (
                    <div className="item-actions" style={{ justifyContent: 'center', marginTop: 12 }}>
                      <button className="icon-btn" onClick={() => openModal({ type: 'person', edit: p })} aria-label={t('common.edit')}><Pencil size={14} /></button>
                      <button className="icon-btn danger" onClick={() => setDeleteTarget({ table: 'trip_people', id: p.id, label: p.name })} aria-label={t('common.delete')}><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
              {collaborators.map((c, i) => (
                <CollaboratorCard
                  key={c.id}
                  collaborator={c}
                  isOwner={isOwner}
                  roleUpdating={roleUpdating}
                  onRoleChange={handleRoleChange}
                  colorIndex={i}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {modal?.type === 'trip' && (
        <TripFormModal saving={saving} error={error} onClose={closeModal} onSubmit={submitTrip} trip={trip} />
      )}
      {modal?.type === 'route' && (
        <RouteFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => submitRoute(data, modal.edit?.id)} tripStart={trip.start_date} tripEnd={trip.end_date} initial={modal.edit} />
      )}
      {modal?.type === 'transport' && (
        <TransportFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => submitTransport(data, modal.edit?.id)} routes={trip.trip_routes} initial={modal.edit} />
      )}
      {modal?.type === 'transport-doc' && (
        <TransportDocumentFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => addTransportDocument(modal.transportId, data.label, data.file)} />
      )}
      {modal?.type === 'expense' && (
        <ExpenseFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => submitExpense(data, modal.edit?.id)} routes={trip.trip_routes} initial={modal.edit} />
      )}
      {modal?.type === 'hotel' && (
        <HotelFormModal saving={saving} error={error} onClose={closeModal} onSubmit={(data) => submitHotel(data, modal.edit?.id)} routes={trip.trip_routes} initial={modal.edit} />
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

      {docViewer && (
        <DocumentViewerModal
          label={docViewer.label}
          filename={docViewer.filename}
          url={docViewer.url}
          mimeType={docViewer.mimeType}
          onClose={closeDocViewer}
        />
      )}
    </div>
  );
}

// Data/hora do voo e número da reserva, com o rótulo de cada campo —
// usado tanto no Roteiro (por cidade) quanto na aba Despesas.
function FlightHighlight({ date, time, code, style }: { date: string | null; time: string | null; code: string | null; style?: CSSProperties }) {
  const { lang, t } = useLanguage();
  if (!date && !time && !code) return null;
  return (
    <div className="flight-highlight" style={style}>
      {date && (
        <div className="flight-highlight-item">
          <Calendar size={13} />
          <div>
            <span className="flight-highlight-label">{t('transport.dateLabel')}</span>
            <span className="flight-highlight-value">{fmtDate(date, lang)}</span>
          </div>
        </div>
      )}
      {time && (
        <div className="flight-highlight-item">
          <Clock size={13} />
          <div>
            <span className="flight-highlight-label">{t('transport.timeLabel')}</span>
            <span className="flight-highlight-value">{time}</span>
          </div>
        </div>
      )}
      {code && (
        <div className="flight-highlight-item">
          <Ticket size={13} />
          <div>
            <span className="flight-highlight-label">{t('transport.reservationLabel')}</span>
            <span className="flight-highlight-value">{code}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Selo de partida/chegada da viagem — mostrado antes/depois da lista
// de rotas do Roteiro, não é um item do roteiro em si (não tem datas
// nem entra na validação de sobreposição).
function TripEndpoint({ label, country, city }: { label: string; country: string | null; city: string }) {
  const code = country ? countryNameToCode(country) : null;
  return (
    <div className="trip-endpoint">
      <span className="trip-endpoint-label">{label}</span>
      {code && <Flag code={code} size={18} />}
      <span className="trip-endpoint-city">{city}</span>
      {country && <span className="trip-endpoint-country">{country}</span>}
    </div>
  );
}

// Total de uma categoria de despesa, separado por moeda — nunca soma
// moedas diferentes num só número.
function ExpenseCategoryTotal({ label, totals, color }: { label: string; totals: Record<string, number>; color: string }) {
  const { lang } = useLanguage();
  const entries = Object.entries(totals);
  return (
    <div className="expense-total-card" style={{ ['--item-color' as any]: color }}>
      <div className="expense-total-label">{label}</div>
      {entries.length === 0 ? (
        <div className="expense-total-value">{fmtMoney(0, lang)}</div>
      ) : (
        entries.map(([currency, amount]) => (
          <div className="expense-total-value" key={currency}>{fmtMoney(amount, lang, currency)}</div>
        ))
      )}
    </div>
  );
}

// Agrupa uma lista de despesas (deslocamento/hotéis/gerais) por
// cidade do roteiro — mesma ideia de seção usada na galeria de
// fotos: uma seção por rota, na ordem da viagem, e uma seção "sem
// localização definida" no final pras que não têm rota vinculada.
function ExpenseCityGroups<T extends { id: string; route_id: string | null }>({ items, routes, emptyLabel, renderItem }: {
  items: T[];
  routes: TripRoute[];
  emptyLabel: string;
  renderItem: (item: T) => ReactNode;
}) {
  const { t } = useLanguage();

  if (items.length === 0) return <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{emptyLabel}</p>;

  const byRoute = new Map<string, T[]>();
  const unassigned: T[] = [];
  for (const item of items) {
    if (item.route_id) {
      const list = byRoute.get(item.route_id);
      if (list) list.push(item); else byRoute.set(item.route_id, [item]);
    } else {
      unassigned.push(item);
    }
  }

  const sections = routes
    .slice()
    .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))
    .map((r) => ({ route: r, items: byRoute.get(r.id) ?? [] }))
    .filter((s) => s.items.length > 0);

  return (
    <>
      {sections.map(({ route, items: routeItems }) => {
        const code = countryNameToCode(route.country);
        return (
          <div className="gallery-section" key={route.id}>
            <div className="gallery-section-title">
              {code && <Flag code={code} size={16} />}
              <h3>{route.city}</h3>
              <span className="gallery-section-country">{route.country}</span>
            </div>
            <div className="flat-list">{routeItems.map(renderItem)}</div>
          </div>
        );
      })}
      {unassigned.length > 0 && (
        <div className="gallery-section">
          <div className="gallery-section-title"><h3>{t('gallery.noLocationSection')}</h3></div>
          <div className="flat-list">{unassigned.map(renderItem)}</div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Roteiro: item de cidade + lugares para visitar (despesas moraram
// pra aba "Despesas")
// ============================================================
function RouteItem({ route, idx, canEdit, transports, onAddPlace, onTogglePlace, onEditRoute, onDeleteRoute, onEditPlace, onDeletePlace }: {
  route: TripRoute & { places: Place[] };
  idx: number;
  canEdit: boolean;
  transports: TripTransport[];
  onAddPlace: (routeId: string) => void;
  onTogglePlace: (placeId: string, visited: boolean) => void;
  onEditRoute: (route: TripRoute) => void;
  onDeleteRoute: (route: TripRoute) => void;
  onEditPlace: (routeId: string, place: Place) => void;
  onDeletePlace: (place: Place) => void;
}) {
  const { lang, t } = useLanguage();
  const status: RouteStatus = routeStatus(route);
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
          {canEdit && (
            <div className="item-actions">
              <button className="icon-btn" onClick={() => onEditRoute(route)} aria-label={t('common.edit')}><Pencil size={14} /></button>
              <button className="icon-btn danger" onClick={() => onDeleteRoute(route)} aria-label={t('common.delete')}><Trash2 size={14} /></button>
            </div>
          )}
        </div>
      </div>
      {transports.length > 0 && (
        <div className="route-expenses">
          <div className="route-expenses-label">{t('route.transportTitle')}</div>
          {transports.map((tr) => (
            <div className="expense-row" key={tr.id}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="expense-tag" style={{ background: TRANSPORT_META[tr.transport_type].color }}>{t(TRANSPORT_META[tr.transport_type].labelKey)}</span>
                {tr.description}
              </span>
              <FlightHighlight date={tr.transport_date} time={tr.flight_time} code={tr.confirmation_code} />
            </div>
          ))}
        </div>
      )}
      <div className="route-expenses">
        <div className="route-expenses-label">{t('route.placesTitle')}</div>
        {route.places.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{t('route.noPlaces')}</div>}
        {route.places.map((p) => (
          <div className="expense-row" key={p.id}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: canEdit ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={p.visited} disabled={!canEdit} onChange={() => canEdit && onTogglePlace(p.id, p.visited)} />
              <span style={{ textDecoration: p.visited ? 'line-through' : 'none', color: p.visited ? 'var(--ink-soft)' : 'var(--ink)' }}>{p.name}</span>
              {p.notes && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{p.notes}</span>}
            </label>
            {canEdit && (
              <div className="item-actions">
                <button className="icon-btn" onClick={() => onEditPlace(route.id, p)} aria-label={t('common.edit')}><Pencil size={13} /></button>
                <button className="icon-btn danger" onClick={() => onDeletePlace(p)} aria-label={t('common.delete')}><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        ))}
        {canEdit && <button className="mini-add" onClick={() => onAddPlace(route.id)}>{t('route.addPlace')}</button>}
      </div>
    </div>
  );
}

// ============================================================
// Formulários
// ============================================================
function TripFormModal({ onClose, onSubmit, error, saving, trip }: {
  onClose: () => void;
  onSubmit: (d: { name: string; start_date: string; end_date: string; departure_country: string; departure_city: string; arrival_country: string; arrival_city: string }) => void;
  error: string;
  saving: boolean;
  trip: TripWithRelations;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.start_date ?? '');
  const [endDate, setEndDate] = useState(trip.end_date ?? '');
  const [departureCountry, setDepartureCountry] = useState(trip.departure_country ?? '');
  const [departureCity, setDepartureCity] = useState(trip.departure_city ?? '');
  const [arrivalCountry, setArrivalCountry] = useState(trip.arrival_country ?? '');
  const [arrivalCity, setArrivalCity] = useState(trip.arrival_city ?? '');

  return (
    <Modal title={t('trip.editTripTitle')} onClose={onClose} error={error}>
      <div className="field"><label>{t('dashboard.tripName')}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('dashboard.tripNamePlaceholder')} /></div>
      <div className="field-row">
        <div className="field"><label>{t('dashboard.start')}</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div className="field"><label>{t('dashboard.end')}</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 6px' }}>{t('trip.departurePoint')}</p>
      <div className="field-row">
        <div className="field"><label>{t('route.country')}</label><CountrySelect value={departureCountry} onChange={setDepartureCountry} placeholder={t('route.countryPlaceholder')} /></div>
        <div className="field"><label>{t('route.city')}</label><input value={departureCity} onChange={(e) => setDepartureCity(e.target.value)} placeholder={t('route.cityPlaceholder')} /></div>
      </div>
      <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '4px 0 6px' }}>{t('trip.arrivalPoint')}</p>
      <div className="field-row">
        <div className="field"><label>{t('route.country')}</label><CountrySelect value={arrivalCountry} onChange={setArrivalCountry} placeholder={t('route.countryPlaceholder')} /></div>
        <div className="field"><label>{t('route.city')}</label><input value={arrivalCity} onChange={(e) => setArrivalCity(e.target.value)} placeholder={t('route.cityPlaceholder')} /></div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button
          className="btn btn-primary"
          disabled={saving}
          onClick={() => onSubmit({ name, start_date: startDate, end_date: endDate, departure_country: departureCountry, departure_city: departureCity, arrival_country: arrivalCountry, arrival_city: arrivalCity })}
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </Modal>
  );
}

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

function TransportFormModal({ onClose, onSubmit, error, saving, routes, initial }: {
  onClose: () => void;
  onSubmit: (d: { route_id: string; transport_type: TransportType; description: string; amount: number; currency: string; transport_date: string; flight_time: string; confirmation_code: string }) => void;
  error: string;
  saving: boolean;
  routes: TripRoute[];
  initial?: TripTransport;
}) {
  const { lang, t } = useLanguage();
  const [routeId, setRouteId] = useState(initial?.route_id ?? '');
  const [transportType, setTransportType] = useState<TransportType>(initial?.transport_type ?? 'aviao');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'BRL');
  const [date, setDate] = useState(initial?.transport_date ?? '');
  const [flightTime, setFlightTime] = useState(initial?.flight_time ?? '');
  const [confirmationCode, setConfirmationCode] = useState(initial?.confirmation_code ?? '');
  const [routeError, setRouteError] = useState('');

  function handleSubmit() {
    if (!routeId) { setRouteError(t('transport.routeRequired')); return; }
    setRouteError('');
    onSubmit({ route_id: routeId, transport_type: transportType, description, amount: Number(amount) || 0, currency, transport_date: date, flight_time: flightTime, confirmation_code: confirmationCode });
  }

  return (
    <Modal title={initial ? t('transport.editTitle') : t('transport.formTitle')} onClose={onClose} error={error || routeError}>
      <div className="field">
        <label>{t('transport.route')}</label>
        <select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
          <option value="">{t('transport.routePlaceholder')}</option>
          {routes.map((r) => <option key={r.id} value={r.id}>{r.city}{r.country ? ` — ${r.country}` : ''}</option>)}
        </select>
      </div>
      <div className="field">
        <label>{t('transport.type')}</label>
        <select value={transportType} onChange={(e) => setTransportType(e.target.value as TransportType)}>
          {TRANSPORT_TYPES.map((tt) => <option key={tt} value={tt}>{t(TRANSPORT_META[tt].labelKey)}</option>)}
        </select>
      </div>
      <div className="field"><label>{t('transport.description')}</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('transport.descriptionPlaceholder')} /></div>
      <div className="field-row">
        <div className="field"><label>{t('transport.date')}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label>{t('transport.amount')}</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
        <div className="field" style={{ maxWidth: 130 }}>
          <label>{t('common.currency')}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {getCurrencyOptions(lang).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
      </div>
      {transportType === 'aviao' && (
        <div className="field-row">
          <div className="field"><label>{t('transport.flightTime')} <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>{t('common.optional')}</span></label><input type="time" value={flightTime} onChange={(e) => setFlightTime(e.target.value)} /></div>
          <div className="field"><label>{t('transport.confirmationCode')} <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>{t('common.optional')}</span></label><input value={confirmationCode} onChange={(e) => setConfirmationCode(e.target.value)} placeholder="ABC123" /></div>
        </div>
      )}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={handleSubmit}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}

function ExpenseFormModal({ onClose, onSubmit, error, saving, routes, initial }: {
  onClose: () => void;
  onSubmit: (d: { category: ExpenseCategory; description: string; amount: number; currency: string; route_id: string }) => void;
  error: string;
  saving: boolean;
  routes: TripRoute[];
  initial?: Expense;
}) {
  const { lang, t } = useLanguage();
  const [category, setCategory] = useState<ExpenseCategory>(initial && initial.category !== 'passagem_trem' && initial.category !== 'passagem_barco' ? initial.category : 'comida');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'BRL');
  const [routeId, setRouteId] = useState(initial?.route_id ?? '');
  return (
    <Modal title={initial ? t('expense.editTitle') : t('expense.formTitle')} onClose={onClose} error={error}>
      <div className="field">
        <label>{t('expense.category')}</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
          <option value="comida">{t('expense.catFood')}</option>
          <option value="outro">{t('expense.catOther')}</option>
        </select>
      </div>
      <div className="field"><label>{t('expense.description')}</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('expense.descriptionPlaceholder')} /></div>
      <div className="field-row">
        <div className="field"><label>{t('expense.amount')}</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
        <div className="field" style={{ maxWidth: 130 }}>
          <label>{t('common.currency')}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {getCurrencyOptions(lang).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>{t('expense.route')} <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>{t('common.optional')}</span></label>
        <select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
          <option value="">{t('expense.routePlaceholder')}</option>
          {routes.map((r) => <option key={r.id} value={r.id}>{r.city}</option>)}
        </select>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => onSubmit({ category, description, amount: Number(amount) || 0, currency, route_id: routeId })}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}

function HotelFormModal({ onClose, onSubmit, error, saving, routes, initial }: {
  onClose: () => void;
  onSubmit: (d: { route_id: string; name: string; address: string; checkin: string; checkout: string; link: string; notes: string; amount: number; currency: string; reservation_number: string; file: File | null }) => void;
  error: string;
  saving: boolean;
  routes: TripRoute[];
  initial?: Hotel;
}) {
  const { lang, t } = useLanguage();
  const [routeId, setRouteId] = useState(initial?.route_id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [checkin, setCheckin] = useState(initial?.checkin ?? '');
  const [checkout, setCheckout] = useState(initial?.checkout ?? '');
  const [link, setLink] = useState(initial?.link ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'BRL');
  const [reservationNumber, setReservationNumber] = useState(initial?.reservation_number_decrypted ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [routeError, setRouteError] = useState('');

  function handleSubmit() {
    if (!routeId) { setRouteError(t('hotel.routeRequired')); return; }
    setRouteError('');
    onSubmit({ route_id: routeId, name, address, checkin, checkout, link, notes, amount: Number(amount) || 0, currency, reservation_number: reservationNumber, file });
  }

  const selectedRoute = routes.find((r) => r.id === routeId);
  const googleHotelsUrl = selectedRoute
    ? `https://www.google.com/travel/hotels?q=${encodeURIComponent(`hotéis em ${selectedRoute.city}, ${selectedRoute.country}`)}`
    : null;

  return (
    <Modal title={initial ? t('hotel.editTitle') : t('hotel.formTitle')} onClose={onClose} error={error || routeError}>
      <div className="field">
        <label>{t('hotel.route')}</label>
        <select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
          <option value="">{t('hotel.routePlaceholder')}</option>
          {routes.map((r) => <option key={r.id} value={r.id}>{r.city}{r.country ? ` — ${r.country}` : ''}</option>)}
        </select>
      </div>
      {googleHotelsUrl && (
        <a className="pill-btn" href={googleHotelsUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 14 }}>
          🔍 {t('hotel.searchGoogle', { city: selectedRoute!.city })}
        </a>
      )}
      <div className="field"><label>{t('hotel.name')}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('hotel.namePlaceholder')} /></div>
      <div className="field"><label>{t('hotel.address')}</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('hotel.addressPlaceholder')} /></div>
      <div className="field-row">
        <div className="field"><label>{t('hotel.checkin')}</label><input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} /></div>
        <div className="field"><label>{t('hotel.checkout')}</label><input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} /></div>
      </div>
      <div className="field"><label>{t('hotel.reservationLink')}</label><input value={link} onChange={(e) => setLink(e.target.value)} placeholder={t('hotel.reservationLinkPlaceholder')} /></div>
      <div className="field"><label>{t('hotel.reservationNumber')}</label><input value={reservationNumber} onChange={(e) => setReservationNumber(e.target.value)} placeholder={t('hotel.reservationNumberPlaceholder')} /></div>
      <div className="field"><label>{t('hotel.notes')}</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('hotel.notesPlaceholder')} /></div>
      <div className="field-row">
        <div className="field"><label>{t('hotel.amount')}</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
        <div className="field" style={{ maxWidth: 130 }}>
          <label>{t('common.currency')}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {getCurrencyOptions(lang).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>{t('hotel.attachmentLabel')}</label>
        <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '6px 0 0' }}>{t('hotel.encryptedNote')}</p>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={saving} onClick={handleSubmit}>{saving ? t('common.saving') : t('common.save')}</button>
      </div>
    </Modal>
  );
}

function TransportListItem({ transport, canEdit, onAddDocument, onViewDocument, onDeleteDocument, onEdit, onDelete }: {
  transport: TripTransport;
  canEdit: boolean;
  onAddDocument: (transportId: string) => void;
  onViewDocument: (path: string, label: string) => void;
  onDeleteDocument: (doc: TripTransportDocument) => void;
  onEdit: (transport: TripTransport) => void;
  onDelete: (transport: TripTransport) => void;
}) {
  const { lang, t } = useLanguage();
  return (
    <div className="list-card">
      <div className="main">
        <div className="title">
          <span className="expense-tag" style={{ background: TRANSPORT_META[transport.transport_type].color }}>{t(TRANSPORT_META[transport.transport_type].labelKey)}</span>
          {transport.description}
        </div>
        {transport.transport_type === 'aviao' && (transport.flight_time || transport.confirmation_code) ? (
          <FlightHighlight date={transport.transport_date} time={transport.flight_time} code={transport.confirmation_code} style={{ marginTop: 6 }} />
        ) : (
          transport.transport_date && <div className="sub">{fmtDate(transport.transport_date, lang)}</div>
        )}
        <div className="transport-doc-list" style={{ marginTop: 8 }}>
          {transport.documents.map((doc) => (
            <div className="transport-doc-row" key={doc.id}>
              <button className="pill-btn" onClick={() => onViewDocument(doc.file_path, doc.label || t('transport.documentFallbackName'))}>
                📎 {doc.label || t('transport.documentFallbackName')}
              </button>
              {canEdit && (
                <button className="icon-btn danger" onClick={() => onDeleteDocument(doc)} aria-label={t('common.delete')}><Trash2 size={12} /></button>
              )}
            </div>
          ))}
          {canEdit && (
            <button className="pill-btn" onClick={() => onAddDocument(transport.id)}>{t('transport.attachDocument')}</button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="amount">{fmtMoney(transport.amount, lang, transport.currency)}</div>
        {canEdit && (
          <div className="item-actions">
            <button className="icon-btn" onClick={() => onEdit(transport)} aria-label={t('common.edit')}><Pencil size={14} /></button>
            <button className="icon-btn danger" onClick={() => onDelete(transport)} aria-label={t('common.delete')}><Trash2 size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function TransportDocumentFormModal({ onClose, onSubmit, error, saving }: {
  onClose: () => void;
  onSubmit: (d: { label: string; file: File }) => void;
  error: string;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const [label, setLabel] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');

  function handleSubmit() {
    if (!file) { setFileError(t('transport.fileRequired')); return; }
    setFileError('');
    onSubmit({ label, file });
  }

  return (
    <Modal title={t('transport.addDocumentTitle')} onClose={onClose} error={error || fileError}>
      <div className="field">
        <label>{t('transport.documentName')} <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>{t('common.optional')}</span></label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('transport.documentNamePlaceholder')} />
      </div>
      <div className="field">
        <label>{t('transport.file')}</label>
        <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '6px 0 0' }}>{t('transport.encryptedNote')}</p>
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
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{t('transport.previewUnavailable')}</p>
        )}
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <a className="btn btn-primary" href={url} download={filename}>{t('transport.download')}</a>
      </div>
    </Modal>
  );
}

function HotelCard({ hotel, canEdit, onAttach, onView, onEdit, onDelete }: {
  hotel: Hotel;
  canEdit: boolean;
  onAttach: (hotelId: string, file: File) => void;
  onView: (path: string) => void;
  onEdit: (hotel: Hotel) => void;
  onDelete: (hotel: Hotel) => void;
}) {
  const { lang, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="hotel-card">
      <div className="card-head">
        <div className="hotel-top">
          <h4>{hotel.name}</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="amount" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmtMoney(hotel.amount, lang, hotel.currency)}</div>
            {canEdit && (
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
          ) : canEdit ? (
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

// Dono/criador da trip — sempre o primeiro card da lista de pessoas,
// sem ações de editar/excluir (esse card só existe pra ele aparecer
// na contagem e na listagem, não é uma linha editável em tabela nenhuma).
function OwnerCard({ fullName, photoPath, userId }: { fullName: string | null; photoPath: string | null; userId: string }) {
  const { t } = useLanguage();
  const [imgError, setImgError] = useState(false);
  const displayName = fullName || t('collab.ownerFallback');
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="person-card">
      {photoPath && !imgError ? (
        <img src={`/api/collaborator-avatar?userId=${userId}`} alt="" className="person-avatar-photo" onError={() => setImgError(true)} />
      ) : (
        <div className="person-avatar" style={{ background: PALETTE[0] }}>{initial}</div>
      )}
      <div className="name">{displayName}</div>
      <div className="age">{t('collab.roleOwner')}</div>
    </div>
  );
}

// Colaborador que aceitou convite — mesma carinha de .person-card das
// pessoas adicionadas manualmente, mas com foto real (se tiver) e o
// papel (visualizador/administrador) em vez de idade. Só o dono edita
// o papel; os outros só veem qual é.
function CollaboratorCard({ collaborator, isOwner, roleUpdating, onRoleChange, colorIndex }: {
  collaborator: TripCollaborator;
  isOwner: boolean;
  roleUpdating: string | null;
  onRoleChange: (collaboratorId: string, userId: string, role: CollaboratorRole) => void;
  colorIndex: number;
}) {
  const { t } = useLanguage();
  const [imgError, setImgError] = useState(false);
  const [pendingRole, setPendingRole] = useState<CollaboratorRole>(collaborator.role);

  useEffect(() => { setPendingRole(collaborator.role); }, [collaborator.role]);

  const displayName = collaborator.full_name || collaborator.email || collaborator.user_id;
  const initial = displayName.slice(0, 1).toUpperCase();
  const hasChange = pendingRole !== collaborator.role;
  const saving = roleUpdating === collaborator.id;

  return (
    <div className="person-card">
      {collaborator.photo_path && !imgError ? (
        <img
          src={`/api/collaborator-avatar?userId=${collaborator.user_id}`}
          alt=""
          className="person-avatar-photo"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="person-avatar" style={{ background: PALETTE[colorIndex % PALETTE.length] }}>{initial}</div>
      )}
      <div className="name">{displayName}</div>
      {isOwner ? (
        <>
          <select
            className="collab-role-select"
            value={pendingRole}
            disabled={saving}
            onChange={(e) => setPendingRole(e.target.value as CollaboratorRole)}
          >
            <option value="viewer">{t('collab.roleViewer')}</option>
            <option value="admin">{t('collab.roleAdmin')}</option>
          </select>
          {hasChange && (
            <button
              className="btn btn-primary collab-role-confirm"
              disabled={saving}
              onClick={() => onRoleChange(collaborator.id, collaborator.user_id, pendingRole)}
            >
              {saving ? t('common.saving') : t('common.confirm')}
            </button>
          )}
        </>
      ) : (
        <div className="age">{collaborator.role === 'admin' ? t('collab.roleAdmin') : t('collab.roleViewer')}</div>
      )}
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
