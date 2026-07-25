import { createClient } from '@/lib/supabase/server';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: trips } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, color_index, trip_people(id)')
    .order('created_at', { ascending: false });

  const { data: totals } = await supabase.from('trip_totals').select('*');

  const totalsByTrip = new Map((totals ?? []).map((t) => [t.trip_id, t.total_geral]));

  const tripsWithStats = (trips ?? []).map((t, i) => ({
    id: t.id,
    name: t.name,
    startDate: t.start_date,
    endDate: t.end_date,
    peopleCount: t.trip_people?.length ?? 0,
    total: Number(totalsByTrip.get(t.id) ?? 0),
    colorIndex: t.color_index ?? i,
  }));

  return <DashboardClient trips={tripsWithStats} />;
}
