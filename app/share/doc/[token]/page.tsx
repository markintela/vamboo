import { createAdminClient } from '@/lib/supabase/admin';
import { PublicLinkNotFound } from '@/components/PublicLinkNotFound';
import { DocShareClient } from './DocShareClient';

export default async function DocSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: doc } = await admin.from('trip_documents').select('label, trip_id').eq('share_token', token).maybeSingle();
  if (!doc) return <PublicLinkNotFound />;

  const { data: trip } = await admin.from('trips').select('name').eq('id', doc.trip_id).maybeSingle();

  return <DocShareClient label={doc.label} tripName={trip?.name ?? null} token={token} />;
}
