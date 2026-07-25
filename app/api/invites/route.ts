import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail, inviteEmailHtml } from '@/lib/email';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { tripId, email } = await request.json();
  if (!tripId || !email) return NextResponse.json({ error: 'tripId e email são obrigatórios.' }, { status: 400 });

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, name')
    .eq('id', tripId)
    .single();
  if (tripError || !trip) {
    console.error('[api/invites] trip lookup failed', { tripId, userId: user.id, tripError });
    return NextResponse.json({ error: `Trip não encontrada. (${tripError?.code ?? 'sem trip'}: ${tripError?.message ?? 'nenhum erro retornado'})` }, { status: 404 });
  }

  const { data: invite, error: insertError } = await supabase
    .from('trip_invites')
    .insert({ trip_id: tripId, channel: 'email', destination: email })
    .select('id, token')
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  const { origin } = new URL(request.url);
  const acceptUrl = `${origin}/convite/${invite.token}`;

  const result = await sendEmail({
    to: email,
    subject: `Convite para a viagem "${trip.name}" no Vamboo`,
    html: inviteEmailHtml({ tripName: trip.name, acceptUrl }),
  });

  if (!result.ok) {
    await supabase.from('trip_invites').update({ status: 'failed' }).eq('id', invite.id);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await supabase.from('trip_invites').update({ status: 'sent' }).eq('id', invite.id);
  return NextResponse.json({ ok: true });
}
