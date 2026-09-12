import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { downloadDecryptedFile, guessMimeType } from '@/lib/secureStorage';

const BUCKETS: Record<string, string> = {
  document: 'trip-documents',
  transport: 'transport-documents',
  hotel: 'hotel-reservations',
};

function extOf(path: string): string {
  const withoutEnc = path.replace(/\.enc$/, '');
  const dot = withoutEnc.lastIndexOf('.');
  return dot >= 0 ? withoutEnc.slice(dot) : '';
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const id = searchParams.get('id');
  if (!type || !id || !BUCKETS[type]) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: trip, error: tripError } = await admin.from('trips').select('id').eq('share_token', token).maybeSingle();
  if (tripError) console.error('[api/share/download] erro ao buscar trip por share_token:', tripError);
  if (!trip) return NextResponse.json({ error: 'Link inválido ou desativado.' }, { status: 404 });

  let filePath: string | null = null;
  let label = 'documento';

  if (type === 'document') {
    const { data: doc } = await admin.from('trip_documents').select('trip_id, file_path, label').eq('id', id).maybeSingle();
    if (!doc || doc.trip_id !== trip.id) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
    filePath = doc.file_path;
    label = doc.label;
  } else if (type === 'transport') {
    const { data: doc } = await admin.from('trip_transport_documents').select('transport_id, file_path, label').eq('id', id).maybeSingle();
    if (!doc) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
    const { data: transport } = await admin.from('trip_transports').select('trip_id').eq('id', doc.transport_id).maybeSingle();
    if (!transport || transport.trip_id !== trip.id) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
    filePath = doc.file_path;
    label = doc.label || 'anexo';
  } else if (type === 'hotel') {
    const { data: hotel } = await admin.from('hotels').select('trip_id, reservation_file_path, name').eq('id', id).maybeSingle();
    if (!hotel || hotel.trip_id !== trip.id || !hotel.reservation_file_path) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
    }
    filePath = hotel.reservation_file_path;
    label = hotel.name;
  }

  if (!filePath) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });

  const result = await downloadDecryptedFile(admin, BUCKETS[type], filePath);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 });

  const safeLabel = label.replace(/[\\/:*?"<>|]/g, '-');
  const filename = `${safeLabel}${extOf(filePath)}`;
  return new NextResponse(new Uint8Array(result.data), {
    headers: {
      'Content-Type': guessMimeType(filePath),
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
