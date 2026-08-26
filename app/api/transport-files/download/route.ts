import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { downloadDecryptedFile, guessMimeType } from '@/lib/secureStorage';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'path é obrigatório.' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const result = await downloadDecryptedFile(supabase, 'transport-documents', path);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 });

  const filename = path.split('/').pop()?.replace(/\.enc$/, '') || 'documento';
  return new NextResponse(new Uint8Array(result.data), {
    headers: {
      'Content-Type': guessMimeType(path),
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
