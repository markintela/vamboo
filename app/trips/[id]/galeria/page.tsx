import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GaleriaClient } from './GaleriaClient';
import type { TripPhoto } from '@/lib/types';

export default async function GaleriaPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: rawPhotos } = await supabase.from('trip_photos').select('*').eq('trip_id', id).order('created_at', { ascending: false });
  const photos: TripPhoto[] = (rawPhotos as TripPhoto[]) ?? [];

  const { data: rawRoutes } = await supabase
    .from('trip_routes')
    .select('id, country, city, start_date')
    .eq('trip_id', id)
    .order('start_date', { ascending: true });
  const routes = rawRoutes ?? [];

  // Bucket privado — cada foto é liberada via signed URL gerada aqui no
  // servidor (RLS já garante que só quem faz parte da trip chega até aqui).
  const photosWithUrls = await Promise.all(
    photos.map(async (p) => {
      const { data: signed } = await supabase.storage.from('trip-photos').createSignedUrl(p.storage_path, 3600);
      return { ...p, url: signed?.signedUrl ?? null };
    })
  );

  return <GaleriaClient tripId={trip.id} tripName={trip.name} canEdit={canEdit} photos={photosWithUrls} routes={routes} />;
}
