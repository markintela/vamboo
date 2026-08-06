import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PerfilClient } from './PerfilClient';

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  const { data: documents } = await supabase
    .from('personal_documents')
    .select('id, user_id, doc_type, label, file_path, created_at, document_number_decrypted')
    .order('created_at', { ascending: false });

  return <PerfilClient profile={profile ?? null} documents={documents ?? []} userId={user.id} />;
}
