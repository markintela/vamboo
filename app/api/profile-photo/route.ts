import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadEncryptedFile } from '@/lib/secureStorage';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });

  const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'Arquivo muito grande.' }, { status: 400 });

  const path = `${user.id}/avatar-${Date.now()}-${file.name}.enc`;
  const { error: uploadError } = await uploadEncryptedFile(supabase, 'personal-documents', path, file);
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert({ user_id: user.id, photo_path: path }, { onConflict: 'user_id' });
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 400 });

  return NextResponse.json({ path });
}
