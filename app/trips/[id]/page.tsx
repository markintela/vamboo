import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TripDetailClient } from './TripDetailClient';
import type { TripWithRelations, TripCollaborator } from '@/lib/types';

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: trip, error } = await supabase
    .from('trips')
    .select('*, trip_people(*), trip_routes(*, places:trip_route_places(*)), trip_transports(*), expenses(*), hotels(*, reservation_number_decrypted)')
    .eq('id', id)
    .single();

  if (error || !trip) notFound();

  const isOwner = trip.user_id === user?.id;

  // As "pessoas da viagem" agora incluem os colaboradores — por isso
  // busca pra todo mundo que acessa a trip (não só o dono), a RLS já
  // permite qualquer colaborador ver os outros (migration 500).
  const { data: rawCollaborators } = await supabase.from('trip_collaborators').select('*').eq('trip_id', id);
  let collaborators: TripCollaborator[] = (rawCollaborators as TripCollaborator[]) ?? [];

  if (collaborators.length > 0) {
    const userIds = collaborators.map((c) => c.user_id);
    const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, photo_path').in('user_id', userIds);
    const profileMap = new Map((profilesData ?? []).map((p) => [p.user_id, p]));
    collaborators = collaborators.map((c) => ({
      ...c,
      full_name: profileMap.get(c.user_id)?.full_name ?? null,
      photo_path: profileMap.get(c.user_id)?.photo_path ?? null,
    }));
  }

  const role = !isOwner && user ? collaborators.find((c) => c.user_id === user.id)?.role ?? null : null;
  const canEdit = isOwner || role === 'admin';

  return (
    <TripDetailClient
      trip={trip as unknown as TripWithRelations}
      isOwner={isOwner}
      canEdit={canEdit}
      collaborators={collaborators}
    />
  );
}
