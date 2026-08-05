-- =========================================================
-- Vamboo — Migração 004
-- Deslocamento (tipos de transporte além de trem/barco, com dados de
-- voo opcionais), despesas unificadas e papel de administrador pra
-- colaboradores.
--
-- ADITIVA: não apaga nem move nada de "flights" ou "expenses" — os
-- dados antigos continuam intactos nessas tabelas, só passam a
-- também existir (copiados) em "trip_transports", que é a nova fonte
-- de verdade usada pela aba "Despesas > Deslocamento" do app.
--
-- Pressupõe que as migrations 20250101000000, 000100 e 000200 já
-- foram aplicadas.
-- =========================================================

-- ---------------------------------------------------------
-- TRIP_TRANSPORTS — deslocamento (era só "flights"/aviões; agora
-- cobre barco, avião, trem, carro, ônibus, ferry, mototáxi, outro),
-- sempre vinculado a uma rota (cidade) — exceto dados migrados de
-- "flights", que não tinham cidade e migram com route_id nulo.
-- ---------------------------------------------------------
create type transport_type as enum
  ('barco', 'aviao', 'trem', 'carro', 'onibus', 'ferry', 'mototaxi', 'outro');

create table trip_transports (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references trips(id) on delete cascade,
  route_id         uuid references trip_routes(id) on delete set null,
  transport_type   transport_type not null,
  description      text,
  amount           numeric(12,2) not null default 0,
  currency         text not null default 'BRL',
  transport_date   date,
  flight_time      time,          -- só relevante quando transport_type = 'aviao'
  confirmation_code text,         -- idem
  created_at       timestamptz not null default now()
);

create index idx_trip_transports_trip  on trip_transports(trip_id);
create index idx_trip_transports_route on trip_transports(route_id);

alter table trip_transports enable row level security;

create policy "trip_transports_owner_all" on trip_transports
  for all
  using (exists (select 1 from trips where trips.id = trip_transports.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = trip_transports.trip_id and trips.user_id = auth.uid()));

create policy "trip_transports_collaborator_select" on trip_transports
  for select
  using (exists (select 1 from trip_collaborators tc where tc.trip_id = trip_transports.trip_id and tc.user_id = auth.uid()));

-- ---------------------------------------------------------
-- MIGRAÇÃO DE DADOS (cópia — não apaga nada das tabelas originais)
-- ---------------------------------------------------------

-- flights -> trip_transports (tipo avião, sem rota — o dono associa
-- a cidade depois editando o registro). Reaproveita o mesmo id pra
-- ser seguro rodar de novo sem duplicar.
insert into trip_transports (id, trip_id, route_id, transport_type, description, amount, currency, transport_date, created_at)
select id, trip_id, null, 'aviao', description, amount, currency, flight_date, created_at
from flights
on conflict (id) do nothing;

-- despesas de trem/barco (dentro de "expenses") -> trip_transports,
-- preservando a rota que essas linhas já tinham. As linhas originais
-- continuam em "expenses" tal como estavam; a aba "Gerais" só passa
-- a filtrar por category in ('comida','outro') do lado do app.
insert into trip_transports (id, trip_id, route_id, transport_type, description, amount, currency, transport_date, created_at)
select id, trip_id, route_id,
       case category when 'passagem_trem' then 'trem'::transport_type else 'barco'::transport_type end,
       description, amount, currency, expense_date, created_at
from expenses
where category in ('passagem_trem', 'passagem_barco')
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- PAPEL DE ADMINISTRADOR — dono pode promover um colaborador (que
-- hoje só tem acesso de visualização) a administrador, com permissão
-- de editar a trip igual ao dono (menos gerenciar colaboradores).
-- ---------------------------------------------------------
alter table trip_collaborators add column if not exists role text not null default 'viewer' check (role in ('viewer', 'admin'));
alter table trip_collaborators add column if not exists email text;

-- is_trip_admin: mesmo motivo do is_trip_owner (migração 000200) —
-- SECURITY DEFINER pra não recriar o ciclo de recursão de RLS entre
-- trips e trip_collaborators.
create or replace function is_trip_admin(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from trip_collaborators
    where trip_id = p_trip_id and user_id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function is_trip_admin(uuid) to authenticated;

create policy "trip_routes_admin_all" on trip_routes
  for all
  using (is_trip_admin(trip_id))
  with check (is_trip_admin(trip_id));

create policy "expenses_admin_all" on expenses
  for all
  using (is_trip_admin(trip_id))
  with check (is_trip_admin(trip_id));

create policy "trip_transports_admin_all" on trip_transports
  for all
  using (is_trip_admin(trip_id))
  with check (is_trip_admin(trip_id));

create policy "hotels_admin_all" on hotels
  for all
  using (is_trip_admin(trip_id))
  with check (is_trip_admin(trip_id));

create policy "trip_people_admin_all" on trip_people
  for all
  using (is_trip_admin(trip_id))
  with check (is_trip_admin(trip_id));

create policy "trip_route_places_admin_all" on trip_route_places
  for all
  using (exists (
    select 1 from trip_routes where trip_routes.id = trip_route_places.route_id and is_trip_admin(trip_routes.trip_id)
  ))
  with check (exists (
    select 1 from trip_routes where trip_routes.id = trip_route_places.route_id and is_trip_admin(trip_routes.trip_id)
  ));

-- Administrador também pode convidar gente pra trip (não só o dono).
create policy "trip_invites_admin_all" on trip_invites
  for all
  using (is_trip_admin(trip_id))
  with check (is_trip_admin(trip_id));

-- set_collaborator_role: só o dono da trip pode promover/rebaixar um
-- colaborador — checagem feita dentro da função (não dá pra um
-- administrador promover outro administrador).
create or replace function set_collaborator_role(p_trip_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role not in ('viewer', 'admin') then
    raise exception 'invalid_role';
  end if;
  if not is_trip_owner(p_trip_id) then
    raise exception 'not_authorized';
  end if;
  update trip_collaborators set role = p_role where trip_id = p_trip_id and user_id = p_user_id;
end;
$$;

grant execute on function set_collaborator_role(uuid, uuid, text) to authenticated;

-- accept_trip_invite passa a gravar o e-mail do colaborador (só
-- legível de dentro de uma função security definer) pra dar pro
-- dono uma lista de colaboradores legível sem precisar de API admin.
create or replace function accept_trip_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id   uuid;
  v_invite_id uuid;
  v_email     text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select id, trip_id into v_invite_id, v_trip_id
  from trip_invites
  where token = p_token;

  if v_invite_id is null then
    raise exception 'invite_not_found';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into trip_collaborators (trip_id, user_id, invite_id, email)
  values (v_trip_id, auth.uid(), v_invite_id, v_email)
  on conflict (trip_id, user_id) do update set email = excluded.email;

  update trip_invites set status = 'accepted' where id = v_invite_id and status <> 'accepted';

  return v_trip_id;
end;
$$;

-- Fim da migração 004.
