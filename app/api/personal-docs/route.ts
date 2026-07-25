import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadEncryptedFile } from '@/lib/secureStorage';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file') as File | null;
  const docType = form.get('docType') as string | null;
  const label = (form.get('label') as string | null) || null;
  const documentNumber = (form.get('documentNumber') as string | null) || null;
  if (!file || !docType) return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });

  const path = `${user.id}/${Date.now()}-${file.name}.enc`;
  const { error: uploadError } = await uploadEncryptedFile(supabase, 'personal-documents', path, file);
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: row, error: insertError } = await supabase
    .from('personal_documents')
    .insert({ user_id: user.id, doc_type: docType, label, document_number: documentNumber, file_path: path })
    .select('id, doc_type, label, file_path, created_at, document_number_decrypted')
    .single();

  if (insertError) {
    await supabase.storage.from('personal-documents').remove([path]);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ document: row });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id é obrigatório.' }, { status: 400 });

  const { data: doc } = await supabase.from('personal_documents').select('file_path').eq('id', id).single();
  const { error } = await supabase.from('personal_documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (doc?.file_path) await supabase.storage.from('personal-documents').remove([doc.file_path]);

  return NextResponse.json({ ok: true });
}
