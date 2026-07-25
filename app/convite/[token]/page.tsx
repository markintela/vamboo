import { createClient } from '@/lib/supabase/server';
import { AcceptInviteClient } from './AcceptInviteClient';

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: invites } = await supabase.rpc('get_invite_by_token', { p_token: token });
  const invite = invites?.[0] ?? null;

  return <AcceptInviteClient token={token} invite={invite} isLoggedIn={!!user} />;
}
