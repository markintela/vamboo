import { createAdminClient } from '@/lib/supabase/admin';
import { ShareTripClient, type PublicTrip } from './ShareTripClient';
import { PublicLinkNotFound } from '@/components/PublicLinkNotFound';

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: trip, error } = await admin
    .from('trips')
    .select(`
      id, name, start_date, end_date, departure_country, departure_city, arrival_country, arrival_city, color_index,
      trip_routes(id, country, city, start_date, end_date, order_index, notes),
      trip_transports(id, route_id, transport_type, description, transport_date, flight_time, arrival_time, documents:trip_transport_documents(id, label)),
      hotels(id, route_id, name, address, checkin, checkout, accommodation_type, link, reservation_file_path),
      trip_documents(id, route_id, label)
    `)
    .eq('share_token', token)
    .maybeSingle();

  if (error) console.error('[share/trip] erro ao buscar trip por share_token:', error);
  if (!trip) return <PublicLinkNotFound />;

  return <ShareTripClient trip={trip as unknown as PublicTrip} token={token} />;
}
