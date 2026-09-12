import { createAdminClient } from '@/lib/supabase/admin';
import { PublicLinkNotFound } from '@/components/PublicLinkNotFound';
import { DocShareClient } from './DocShareClient';

export default async function DocSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: doc, error } = await admin.from('trip_documents').select('label, trip_id').eq('share_token', token).maybeSingle();
  if (error) console.error('[share/doc] erro ao buscar documento por share_token:', error);
  if (!doc) return <PublicLinkNotFound />;

  const { data: trip, error: tripError } = await admin.from('trips').select('name').eq('id', doc.trip_id).maybeSingle();
  if (tripError) console.error('[share/doc] erro ao buscar a trip do documento:', tripError);

  return <DocShareClient label={doc.label} tripName={trip?.name ?? null} token={token} />;
}
