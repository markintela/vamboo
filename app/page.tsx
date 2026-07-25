import { createClient } from '@/lib/supabase/server';
import { LandingClient } from './LandingClient';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <LandingClient isLoggedIn={!!user} />;
}
