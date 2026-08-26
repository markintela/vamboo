import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadEncryptedFile } from '@/lib/secureStorage';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const tripId = form.get('tripId') as string | null;
  const transportId = form.get('transportId') as string | null;
  if (!file || !tripId || !transportId) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
  }

  const path = `${user.id}/${tripId}/${transportId}-${Date.now()}-${file.name}.enc`;
  const { error } = await uploadEncryptedFile(supabase, 'transport-documents', path, file);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ path });
}
