'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { TripCard } from '@/components/TripCard';
import { Modal } from '@/components/Modal';

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

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) { setError('Dá um nome pra essa viagem.'); return; }
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
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nova trip</button>
          <a className="btn btn-outline" href="/perfil">Área pessoal</a>
          <button className="btn btn-outline" onClick={handleLogout}>Sair</button>
        </div>
      </div>

      <div className="page">
        <h1 className="page-title">Suas viagens</h1>
        <p className="page-sub">Cada trip guarda o roteiro, pessoas e despesas separadas por categoria.</p>

        <div className="trip-grid">
          {trips.map((t) => <TripCard key={t.id} {...t} />)}
          <button className="empty-card" onClick={() => setShowModal(true)}>
            <span style={{ fontSize: 26 }}>+</span>
            Nova trip
          </button>
        </div>
      </div>

      {showModal && (
        <Modal title="Nova trip" onClose={() => setShowModal(false)} error={error}>
          <div className="field">
            <label>Nome da viagem</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Europa — Setembro 2026" />
          </div>
          <div className="field-row">
            <div className="field"><label>Início</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="field"><label>Fim</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Salvando…' : 'Criar trip'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
