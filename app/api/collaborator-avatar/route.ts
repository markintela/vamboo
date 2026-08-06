import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { downloadDecryptedFile, guessMimeType } from '@/lib/secureStorage';

// Serve a foto de perfil de QUALQUER usuário que compartilhe uma trip com
// quem está pedindo — autorização inteira feita via RLS (policies
// "profiles_trip_member_select" e "personal_docs_trip_avatar_select",
// migration 20250101000500), não tem checagem extra aqui: se o Supabase
// não devolver a linha/arquivo, é porque a RLS já bloqueou.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId é obrigatório.' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('photo_path').eq('user_id', userId).maybeSingle();
  if (!profile?.photo_path) return NextResponse.json({ error: 'Sem foto.' }, { status: 404 });

  const result = await downloadDecryptedFile(supabase, 'personal-documents', profile.photo_path);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 });

  return new NextResponse(new Uint8Array(result.data), {
    headers: {
      'Content-Type': guessMimeType(profile.photo_path),
      'Cache-Control': 'private, max-age=300',
    },
  });
}
