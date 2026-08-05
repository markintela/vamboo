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

  let role: 'viewer' | 'admin' | null = null;
  let collaborators: TripCollaborator[] | null = null;

  if (isOwner) {
    const { data } = await supabase.from('trip_collaborators').select('*').eq('trip_id', id);
    collaborators = (data as TripCollaborator[]) ?? [];
  } else if (user) {
    const { data } = await supabase
      .from('trip_collaborators')
      .select('role')
      .eq('trip_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    role = (data?.role as 'viewer' | 'admin' | undefined) ?? null;
  }

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
