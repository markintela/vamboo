import { createClient } from '@/lib/supabase/server';
import { orderedCountryCodes } from '@/lib/countries';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
    : { data: null };

  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, color_index, archived, trip_people(id), trip_collaborators(id), trip_routes(id, city, country, start_date)')
    .order('created_at', { ascending: false });

  if (tripsError) {
    console.error('[dashboard/page] falha ao buscar trips', { userId: user?.id, tripsError });
  }

  const tripsWithStats = (trips ?? []).map((t, i) => ({
    id: t.id,
    name: t.name,
    startDate: t.start_date,
    endDate: t.end_date,
    peopleCount: 1 + (t.trip_people?.length ?? 0) + (t.trip_collaborators?.length ?? 0),
    colorIndex: t.color_index ?? i,
    flags: orderedCountryCodes(t.trip_routes ?? []),
    archived: t.archived ?? false,
  }));

  const allRoutes = (trips ?? []).filter((t) => !t.archived).flatMap((t) =>
    (t.trip_routes ?? []).map((r) => ({
      id: r.id,
      city: r.city,
      country: r.country,
      start_date: r.start_date,
      tripName: t.name,
    }))
  );

  const loadError = tripsError
    ? `Erro ao carregar trips (${tripsError.code ?? 'sem código'}): ${tripsError.message}`
    : null;

  return <DashboardClient trips={tripsWithStats} routes={allRoutes} loadError={loadError} profile={profile ?? null} />;
}
