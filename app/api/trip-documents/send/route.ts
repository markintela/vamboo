import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { downloadDecryptedFile, guessMimeType } from '@/lib/secureStorage';
import { sendEmail, tripDocumentsEmailHtml } from '@/lib/email';

function extOf(path: string): string {
  const withoutEnc = path.replace(/\.enc$/, '');
  const dot = withoutEnc.lastIndexOf('.');
  return dot >= 0 ? withoutEnc.slice(dot) : '';
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { tripId, tripName, documentIds, to } = await request.json();
  if (!tripId || !to || !Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
  }

  // Consulta via cliente do usuário — RLS já garante que só vem documento
  // de trip que ele é dono, admin ou colaborador.
  const { data: docs, error: docsErr } = await supabase
    .from('trip_documents')
    .select('id, label, file_path')
    .eq('trip_id', tripId)
    .in('id', documentIds);
  if (docsErr) return NextResponse.json({ error: docsErr.message }, { status: 400 });
  if (!docs || docs.length === 0) return NextResponse.json({ error: 'Nenhum documento encontrado.' }, { status: 404 });

  const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  for (const doc of docs) {
    const result = await downloadDecryptedFile(supabase, 'trip-documents', doc.file_path);
    if ('error' in result) continue;
    const safeLabel = doc.label.replace(/[\\/:*?"<>|]/g, '-');
    attachments.push({
      filename: `${safeLabel}${extOf(doc.file_path)}`,
      content: result.data,
      contentType: guessMimeType(doc.file_path),
    });
  }
  if (attachments.length === 0) {
    return NextResponse.json({ error: 'Não foi possível preparar os anexos.' }, { status: 404 });
  }

  const result = await sendEmail({
    to,
    subject: `Documentos da viagem${tripName ? ` — ${tripName}` : ''}`,
    html: tripDocumentsEmailHtml({ tripName: tripName || '', count: attachments.length }),
    attachments,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ ok: true });
}
