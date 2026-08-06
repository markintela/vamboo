-- =========================================================
-- Vamboo — Migração 005
-- Convite por e-mail ganha validade (expira 7 dias depois de criado)
-- e passa a conferir se quem está aceitando é a mesma pessoa que foi
-- convidada (compara o e-mail da conta logada com o destino do
-- convite). Antes disso, qualquer pessoa com o link — encaminhado,
-- vazado — conseguia virar colaboradora da trip.
--
-- ADITIVA: só adiciona uma coluna (com default, então convites já
-- existentes ganham uma data de expiração calculada na hora de rodar
-- esta migração, sem invalidar nada na hora) e recria as duas
-- funções de convite. Nada é apagado.
--
-- Pressupõe que 20250101000200 e 20250101000300 já foram aplicadas.
-- =========================================================

alter table trip_invites add column if not exists expires_at timestamptz default (now() + interval '7 days');

-- Muda o formato de retorno (adiciona channel + expires_at), por isso
-- precisa dropar antes de recriar.
drop function if exists get_invite_by_token(uuid);

create or replace function get_invite_by_token(p_token uuid)
returns table (trip_id uuid, trip_name text, status text, destination text, channel text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select ti.trip_id, t.name, ti.status, ti.destination, ti.channel, ti.expires_at
  from trip_invites ti
  join trips t on t.id = ti.trip_id
  where ti.token = p_token;
$$;

revoke all on function get_invite_by_token(uuid) from public, anon, authenticated;
grant execute on function get_invite_by_token(uuid) to anon, authenticated;

create or replace function accept_trip_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id     uuid;
  v_invite_id   uuid;
  v_destination text;
  v_channel     text;
  v_expires_at  timestamptz;
  v_email       text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select id, trip_id, destination, channel, expires_at
    into v_invite_id, v_trip_id, v_destination, v_channel, v_expires_at
  from trip_invites
  where token = p_token;

  if v_invite_id is null then
    raise exception 'invite_not_found';
  end if;

  if v_expires_at is not null and v_expires_at < now() then
    raise exception 'invite_expired';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  -- Só confere identidade pra convite por e-mail — "destination" de um
  -- convite por WhatsApp é um telefone, não dá pra comparar com e-mail.
  if v_channel = 'email' and lower(v_destination) <> lower(coalesce(v_email, '')) then
    raise exception 'email_mismatch';
  end if;

  insert into trip_collaborators (trip_id, user_id, invite_id, email)
  values (v_trip_id, auth.uid(), v_invite_id, v_email)
  on conflict (trip_id, user_id) do update set email = excluded.email;

  update trip_invites set status = 'accepted' where id = v_invite_id and status <> 'accepted';

  return v_trip_id;
end;
$$;

revoke all on function accept_trip_invite(uuid) from public, anon, authenticated;
grant execute on function accept_trip_invite(uuid) to authenticated;

-- Fim da migração 005.
