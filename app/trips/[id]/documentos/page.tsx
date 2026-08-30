import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DocumentosClient } from './DocumentosClient';
import type { TripDocument } from '@/lib/types';

export default async function DocumentosPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: rawDocs } = await supabase.from('trip_documents').select('*').eq('trip_id', id).order('created_at', { ascending: false });
  const documents: TripDocument[] = (rawDocs as TripDocument[]) ?? [];

  const { data: rawRoutes } = await supabase
    .from('trip_routes')
    .select('id, country, city, start_date')
    .eq('trip_id', id)
    .order('start_date', { ascending: true });
  const routes = rawRoutes ?? [];

  return <DocumentosClient tripId={trip.id} tripName={trip.name} canEdit={canEdit} documents={documents} routes={routes} />;
}
