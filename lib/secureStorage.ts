import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptBuffer, decryptBuffer } from './crypto';

export async function uploadEncryptedFile(supabase: SupabaseClient, bucket: string, path: string, file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return supabase.storage.from(bucket).upload(path, encryptBuffer(bytes), {
    contentType: 'application/octet-stream',
    upsert: false,
  });
}

export async function downloadDecryptedFile(supabase: SupabaseClient, bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return { error: error?.message || 'Arquivo não encontrado.' } as const;
  const encrypted = Buffer.from(await data.arrayBuffer());
  return { data: decryptBuffer(encrypted) } as const;
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** path termina em "...nome-original.ext.enc" — usa a extensão original pra decidir o content-type. */
export function guessMimeType(path: string): string {
  const withoutEnc = path.replace(/\.enc$/, '');
  const ext = withoutEnc.split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}
