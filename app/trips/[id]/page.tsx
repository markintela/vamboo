import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TripDetailClient } from './TripDetailClient';
import type { TripWithRelations } from '@/lib/types';

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: trip, error } = await supabase
    .from('trips')
    .select('*, trip_people(*), trip_routes(*, expenses(*), places:trip_route_places(*)), flights(*), hotels(*, reservation_number_decrypted)')
    .eq('id', id)
    .single();

  if (error || !trip) notFound();

  const isOwner = trip.user_id === user?.id;

  return <TripDetailClient trip={trip as unknown as TripWithRelations} isOwner={isOwner} />;
}
