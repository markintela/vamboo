-- =========================================================
-- Vamboo — Migração 003
-- Convite por e-mail de verdade + acesso de visualização
-- compartilhado pra quem aceitar o convite.
--
-- Pressupõe que as migrations 20250101000000 e 20250101000100
-- já foram aplicadas.
-- =========================================================

-- ---------------------------------------------------------
-- TRIP_INVITES — token único usado no link do convite
-- ---------------------------------------------------------
alter table trip_invites add column if not exists token uuid not null default gen_random_uuid();
alter table trip_invites add constraint trip_invites_token_key unique (token);

-- ---------------------------------------------------------
-- TRIP_COLLABORATORS — quem aceitou o convite e por isso tem
-- acesso de visualização à trip, além do dono.
-- ---------------------------------------------------------
create table trip_collaborators (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  invite_id  uuid references trip_invites(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

alter table trip_collaborators enable row level security;

-- Cada um vê as próprias linhas (pra saber a quais trips tem acesso)
create policy "trip_collaborators_self_select" on trip_collaborators
  for select
  using (user_id = auth.uid());

-- is_trip_owner: função SECURITY DEFINER usada só pra quebrar um ciclo de
-- recursão de RLS. Sem ela, "trip_collaborators_owner_select" consultaria
-- trips diretamente, e a policy "trips_collaborator_select" (mais abaixo)
-- consulta trip_collaborators de volta — Postgres detecta o ciclo e recusa
-- a query com "infinite recursion detected in policy for relation trips".
-- Rodando como SECURITY DEFINER (dono da tabela), essa checagem específica
-- ignora a RLS de trips e quebra o ciclo.
create or replace function is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from trips where trips.id = p_trip_id and trips.user_id = auth.uid());
$$;

grant execute on function is_trip_owner(uuid) to authenticated;

-- O dono da trip vê quem colaborou com ela
create policy "trip_collaborators_owner_select" on trip_collaborators
  for select
  using (is_trip_owner(trip_id));

-- Ninguém insere direto por aqui — só a função accept_trip_invite
-- (mais abaixo), que roda como dono da tabela e por isso não
-- depende de policy de insert.

-- ---------------------------------------------------------
-- POLICIES DE VISUALIZAÇÃO PRA COLABORADORES
-- O dono continua com CRUD completo (policies "*_owner_all" já
-- existentes). Isso aqui só soma SELECT extra pra quem aceitou
-- o convite — colaborador não cria/edita/apaga nada.
-- ---------------------------------------------------------
create policy "trips_collaborator_select" on trips
  for select
  using (exists (select 1 from trip_collaborators tc where tc.trip_id = trips.id and tc.user_id = auth.uid()));

create policy "trip_people_collaborator_select" on trip_people
  for select
  using (exists (select 1 from trip_collaborators tc where tc.trip_id = trip_people.trip_id and tc.user_id = auth.uid()));

create policy "trip_routes_collaborator_select" on trip_routes
  for select
  using (exists (select 1 from trip_collaborators tc where tc.trip_id = trip_routes.trip_id and tc.user_id = auth.uid()));

create policy "expenses_collaborator_select" on expenses
  for select
  using (exists (select 1 from trip_collaborators tc where tc.trip_id = expenses.trip_id and tc.user_id = auth.uid()));

create policy "flights_collaborator_select" on flights
  for select
  using (exists (select 1 from trip_collaborators tc where tc.trip_id = flights.trip_id and tc.user_id = auth.uid()));

create policy "hotels_collaborator_select" on hotels
  for select
  using (exists (select 1 from trip_collaborators tc where tc.trip_id = hotels.trip_id and tc.user_id = auth.uid()));

create policy "trip_route_places_collaborator_select" on trip_route_places
  for select
  using (exists (
    select 1 from trip_routes
    join trip_collaborators tc on tc.trip_id = trip_routes.trip_id
    where trip_routes.id = trip_route_places.route_id and tc.user_id = auth.uid()
  ));

-- ---------------------------------------------------------
-- FUNÇÕES DE CONVITE
-- O token em si já é o segredo (só quem recebeu o e-mail tem
-- ele) — por isso essas funções podem rodar pra anon/authenticated
-- sem exigir login só pra ver os dados básicos do convite.
-- ---------------------------------------------------------
create or replace function get_invite_by_token(p_token uuid)
returns table (trip_id uuid, trip_name text, status text, destination text)
language sql
stable
security definer
set search_path = public
as $$
  select ti.trip_id, t.name, ti.status, ti.destination
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
  v_trip_id   uuid;
  v_invite_id uuid;
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

  insert into trip_collaborators (trip_id, user_id, invite_id)
  values (v_trip_id, auth.uid(), v_invite_id)
  on conflict (trip_id, user_id) do nothing;

  update trip_invites set status = 'accepted' where id = v_invite_id and status <> 'accepted';

  return v_trip_id;
end;
$$;

revoke all on function accept_trip_invite(uuid) from public, anon, authenticated;
grant execute on function accept_trip_invite(uuid) to authenticated;

-- Fim da migração 003.
