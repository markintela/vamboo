import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChecklistClient } from './ChecklistClient';
import type { ChecklistItem } from '@/lib/types';

export default async function ChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: trip, error } = await supabase.from('trips').select('id, name, user_id').eq('id', id).single();
  if (error || !trip) notFound();

  const isOwner = trip.user_id === user?.id;
  let canEdit = isOwner;
  if (!isOwner && user) {
    const { data: collab } = await supabase.from('trip_collaborators').select('role').eq('trip_id', id).eq('user_id', user.id).maybeSingle();
    canEdit = collab?.role === 'admin';
  }

  const { data: rawItems } = await supabase.from('trip_checklist_items').select('*').eq('trip_id', id).order('created_at', { ascending: true });
  const items: ChecklistItem[] = (rawItems as ChecklistItem[]) ?? [];

  // Resolve done_by (uuid) pro nome de exibição — mesma técnica já usada
  // pra colaboradores: join direto em profiles, liberado pela RLS pra
  // quem compartilha a trip com a pessoa (migration 006/009).
  const doneByIds = Array.from(new Set(items.map((i) => i.done_by).filter((v): v is string => !!v)));
  const doneByNames = new Map<string, string>();
  if (doneByIds.length > 0) {
    const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name').in('user_id', doneByIds);
    for (const p of profilesData ?? []) {
      if (p.full_name) doneByNames.set(p.user_id, p.full_name);
    }
  }

  return (
    <ChecklistClient
      tripId={trip.id}
      tripName={trip.name}
      canEdit={canEdit}
      items={items}
      doneByNames={Object.fromEntries(doneByNames)}
    />
  );
}
