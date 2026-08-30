import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FinanceiroClient } from './FinanceiroClient';
import type { TripRoute, TransportType, ExpenseCategory } from '@/lib/types';

export interface FinanceTransportRow {
  id: string; route_id: string | null; transport_type: TransportType;
  description: string | null; amount: number; currency: string; transport_date: string | null;
}
export interface FinanceHotelRow {
  id: string; route_id: string | null; name: string; amount: number; currency: string; checkin: string | null;
}
export interface FinanceExpenseRow {
  id: string; route_id: string | null; category: ExpenseCategory;
  description: string | null; amount: number; currency: string; expense_date: string | null;
}

export default async function FinanceiroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trip, error } = await supabase
    .from('trips')
    .select('id, name, trip_routes(*), trip_transports(*), hotels(*), expenses(*)')
    .eq('id', id)
    .single();

  if (error || !trip) notFound();

  return (
    <FinanceiroClient
      tripId={trip.id}
      tripName={trip.name}
      routes={(trip.trip_routes as TripRoute[]) ?? []}
      transports={(trip.trip_transports as FinanceTransportRow[]) ?? []}
      hotels={(trip.hotels as FinanceHotelRow[]) ?? []}
      expenses={(trip.expenses as FinanceExpenseRow[]) ?? []}
    />
  );
}
