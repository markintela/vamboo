import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { downloadDecryptedFile, guessMimeType } from '@/lib/secureStorage';

function extOf(path: string): string {
  const withoutEnc = path.replace(/\.enc$/, '');
  const dot = withoutEnc.lastIndexOf('.');
  return dot >= 0 ? withoutEnc.slice(dot) : '';
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: doc, error } = await admin.from('trip_documents').select('label, file_path').eq('share_token', token).maybeSingle();
  if (error) console.error('[api/share/doc] erro ao buscar documento por share_token:', error);
  if (!doc) return NextResponse.json({ error: 'Link inválido ou desativado.' }, { status: 404 });

  const result = await downloadDecryptedFile(admin, 'trip-documents', doc.file_path);
  if ('error' in result) {
    console.error('[api/share/doc] erro ao descriptografar arquivo:', result.error);
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  const safeLabel = doc.label.replace(/[\\/:*?"<>|]/g, '-');
  const filename = `${safeLabel}${extOf(doc.file_path)}`;
  return new NextResponse(new Uint8Array(result.data), {
    headers: {
      'Content-Type': guessMimeType(doc.file_path),
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
