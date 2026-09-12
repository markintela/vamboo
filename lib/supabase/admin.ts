import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente com a service_role key — ignora RLS. Server-only, e só deve ser
 * usado onde o acesso não passa por login (ex: a página pública
 * /share/[token]), com a autorização feita manualmente no código (conferindo
 * o share_token) em vez de depender de políticas de RLS.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no .env.local.');
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
