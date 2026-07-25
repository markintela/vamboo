import { createClient } from '@/lib/supabase/server';
import { orderedCountryFlags } from '@/lib/countries';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, color_index, trip_people(id), trip_routes(country, start_date)')
    .order('created_at', { ascending: false });

  if (tripsError) {
    console.error('[dashboard/page] falha ao buscar trips', { userId: user?.id, tripsError });
  }

  const { data: totals, error: totalsError } = await supabase.from('trip_totals').select('*');

  if (totalsError) {
    console.error('[dashboard/page] falha ao buscar trip_totals', { userId: user?.id, totalsError });
  }

  const totalsByTrip = new Map((totals ?? []).map((t) => [t.trip_id, t.total_geral]));

  const tripsWithStats = (trips ?? []).map((t, i) => ({
    id: t.id,
    name: t.name,
    startDate: t.start_date,
    endDate: t.end_date,
    peopleCount: t.trip_people?.length ?? 0,
    total: Number(totalsByTrip.get(t.id) ?? 0),
    colorIndex: t.color_index ?? i,
    flags: orderedCountryFlags(t.trip_routes ?? []),
  }));

  const loadError = tripsError
    ? `Erro ao carregar trips (${tripsError.code ?? 'sem código'}): ${tripsError.message}`
    : null;

  return <DashboardClient trips={tripsWithStats} loadError={loadError} />;
}
