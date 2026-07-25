-- =========================================================
-- Vamboo — RECREATE (recria o schema do zero)
-- Recria tudo já com roteiro, despesas, voos, hotéis, pessoas,
-- convite por e-mail com acesso de visualização compartilhado,
-- lugares para visitar, área pessoal e criptografia dos campos
-- sensíveis. Equivalente a rodar as 3 migrations de
-- supabase/migrations/ em sequência, só que num arquivo só.
--
-- Rode isto DEPOIS de reset.sql (ou num projeto novo, vazio).
-- Rodar num banco que já tem essas tabelas dá erro ("already
-- exists") — nesse caso rode reset.sql primeiro.
--
-- Como usar: cole este arquivo inteiro no SQL Editor do Supabase
-- e rode.
-- =========================================================

-- =========================================================
-- PARTE 1 — SCHEMA BASE
-- =========================================================

create extension if not exists "pgcrypto";

create type expense_category as enum ('passagem_trem', 'passagem_barco', 'comida', 'outro');

create table trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  start_date  date,
  end_date    date,
  color_index int default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table trips is 'Uma viagem cadastrada por um usuário.';

create table trip_people (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  name       text not null,
  age        int,
  created_at timestamptz not null default now()
);

create table trip_routes (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  country     text not null,
  city        text not null,
  start_date  date,
  end_date    date,
  order_index int not null default 0,
  notes       text,
  created_at  timestamptz not null default now()
);

create table expenses (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips(id) on delete cascade,
  route_id     uuid references trip_routes(id) on delete set null,
  category     expense_category not null,
  description  text,
  amount       numeric(12,2) not null default 0,
  currency     text not null default 'BRL',
  expense_date date,
  created_at   timestamptz not null default now()
);

create table flights (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips(id) on delete cascade,
  description  text not null,
  amount       numeric(12,2) not null default 0,
  currency     text not null default 'BRL',
  flight_date  date,
  created_at   timestamptz not null default now()
);

create table hotels (
  id                    uuid primary key default gen_random_uuid(),
  trip_id               uuid not null references trips(id) on delete cascade,
  route_id              uuid references trip_routes(id) on delete set null,
  name                  text not null,
  address               text,
  checkin               date,
  checkout              date,
  link                  text,
  notes                 text,
  amount                numeric(12,2) default 0,
  currency              text not null default 'BRL',
  reservation_file_path text,
  reservation_number    text,          -- fica encriptado (ver PARTE 3)
  created_at            timestamptz not null default now()
);

create index idx_trips_user            on trips(user_id);
create index idx_trip_people_trip      on trip_people(trip_id);
create index idx_trip_routes_trip      on trip_routes(trip_id, order_index);
create index idx_expenses_trip         on expenses(trip_id);
create index idx_expenses_route        on expenses(route_id);
create index idx_flights_trip          on flights(trip_id);
create index idx_hotels_trip           on hotels(trip_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_trips_updated_at
before update on trips
for each row execute function set_updated_at();

alter table trips        enable row level security;
alter table trip_people  enable row level security;
alter table trip_routes  enable row level security;
alter table expenses     enable row level security;
alter table flights      enable row level security;
alter table hotels       enable row level security;

create policy "trips_owner_all" on trips
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "trip_people_owner_all" on trip_people
  for all
  using (exists (select 1 from trips where trips.id = trip_people.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = trip_people.trip_id and trips.user_id = auth.uid()));

create policy "trip_routes_owner_all" on trip_routes
  for all
  using (exists (select 1 from trips where trips.id = trip_routes.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = trip_routes.trip_id and trips.user_id = auth.uid()));

create policy "expenses_owner_all" on expenses
  for all
  using (exists (select 1 from trips where trips.id = expenses.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = expenses.trip_id and trips.user_id = auth.uid()));

create policy "flights_owner_all" on flights
  for all
  using (exists (select 1 from trips where trips.id = flights.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = flights.trip_id and trips.user_id = auth.uid()));

create policy "hotels_owner_all" on hotels
  for all
  using (exists (select 1 from trips where trips.id = hotels.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = hotels.trip_id and trips.user_id = auth.uid()));

insert into storage.buckets (id, name, public)
values ('hotel-reservations', 'hotel-reservations', false)
on conflict (id) do nothing;

create policy "hotel_files_owner_select" on storage.objects
  for select
  using (bucket_id = 'hotel-reservations' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "hotel_files_owner_insert" on storage.objects
  for insert
  with check (bucket_id = 'hotel-reservations' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "hotel_files_owner_update" on storage.objects
  for update
  using (bucket_id = 'hotel-reservations' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "hotel_files_owner_delete" on storage.objects
  for delete
  using (bucket_id = 'hotel-reservations' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace view trip_totals as
select
  t.id as trip_id,
  coalesce(f.total_flights, 0)  as total_flights,
  coalesce(h.total_hotels, 0)   as total_hotels,
  coalesce(e.total_expenses, 0) as total_expenses,
  coalesce(f.total_flights, 0) + coalesce(h.total_hotels, 0) + coalesce(e.total_expenses, 0) as total_geral
from trips t
left join (select trip_id, sum(amount) as total_flights from flights group by trip_id) f on f.trip_id = t.id
left join (select trip_id, sum(amount) as total_hotels  from hotels  group by trip_id) h on h.trip_id = t.id
left join (select trip_id, sum(amount) as total_expenses from expenses group by trip_id) e on e.trip_id = t.id;

create table trip_invites (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  channel     text not null check (channel in ('email','whatsapp')),
  destination text not null,
  status      text not null default 'pending' check (status in ('pending','sent','accepted','failed')),
  token       uuid not null unique default gen_random_uuid(),  -- segredo do link de convite
  created_at  timestamptz not null default now()
);

alter table trip_invites enable row level security;

create policy "trip_invites_owner_all" on trip_invites
  for all
  using (exists (select 1 from trips where trips.id = trip_invites.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = trip_invites.trip_id and trips.user_id = auth.uid()));

-- =========================================================
-- PARTE 2 — LUGARES PARA VISITAR, ÁREA PESSOAL E CRIPTOGRAFIA
-- =========================================================

-- Troque o placeholder da chave logo abaixo por uma sua antes de
-- guardar dado real (gere com `openssl rand -base64 32`) e guarde
-- uma cópia em local seguro — se o segredo for apagado do Vault
-- depois, os dados encriptados ficam irrecuperáveis.
create extension if not exists supabase_vault;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'app_encryption_key') then
    perform vault.create_secret(
      'TROQUE-ESTA-CHAVE-POR-UMA-ALEATORIA-openssl-rand-base64-32',
      'app_encryption_key',
      'Chave usada para encriptar campos sensíveis do Vamboo (número de documento, número de reserva).'
    );
  end if;
end $$;

create or replace function encrypt_secret(plain text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions, vault
as $$
declare
  app_key text;
begin
  if plain is null or plain = '' then
    return null;
  end if;
  select decrypted_secret into app_key from vault.decrypted_secrets where name = 'app_encryption_key';
  return encode(pgp_sym_encrypt(plain, app_key, 'cipher-algo=aes256'), 'base64');
end;
$$;

create or replace function decrypt_secret(cipher text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions, vault
as $$
declare
  app_key text;
begin
  if cipher is null or cipher = '' then
    return null;
  end if;
  select decrypted_secret into app_key from vault.decrypted_secrets where name = 'app_encryption_key';
  return pgp_sym_decrypt(decode(cipher, 'base64'), app_key);
end;
$$;

revoke all on function encrypt_secret(text) from public, anon, authenticated;
revoke all on function decrypt_secret(text) from public, anon, authenticated;

create table trip_route_places (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references trip_routes(id) on delete cascade,
  name       text not null,
  notes      text,
  visited    boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_trip_route_places_route on trip_route_places(route_id);

alter table trip_route_places enable row level security;

create policy "trip_route_places_owner_all" on trip_route_places
  for all
  using (exists (
    select 1 from trip_routes
    join trips on trips.id = trip_routes.trip_id
    where trip_routes.id = trip_route_places.route_id and trips.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from trip_routes
    join trips on trips.id = trip_routes.trip_id
    where trip_routes.id = trip_route_places.route_id and trips.user_id = auth.uid()
  ));

create or replace function hotels_encrypt_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.reservation_number := encrypt_secret(new.reservation_number);
  elsif new.reservation_number is distinct from old.reservation_number then
    new.reservation_number := encrypt_secret(new.reservation_number);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hotels_encrypt on hotels;
create trigger trg_hotels_encrypt
before insert or update on hotels
for each row execute function hotels_encrypt_trigger();

create or replace function reservation_number_decrypted(hotels)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decrypt_secret($1.reservation_number);
$$;

grant execute on function reservation_number_decrypted(hotels) to authenticated;

create table profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  photo_path text,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_owner_all" on profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create type personal_document_type as enum ('id', 'passaporte', 'outro');

create table personal_documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  doc_type        personal_document_type not null,
  label           text,
  document_number text,
  file_path       text,
  created_at      timestamptz not null default now()
);

create index idx_personal_documents_user on personal_documents(user_id);

alter table personal_documents enable row level security;

create policy "personal_documents_owner_all" on personal_documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function personal_documents_encrypt_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.document_number := encrypt_secret(new.document_number);
  elsif new.document_number is distinct from old.document_number then
    new.document_number := encrypt_secret(new.document_number);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_personal_documents_encrypt on personal_documents;
create trigger trg_personal_documents_encrypt
before insert or update on personal_documents
for each row execute function personal_documents_encrypt_trigger();

create or replace function document_number_decrypted(personal_documents)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decrypt_secret($1.document_number);
$$;

grant execute on function document_number_decrypted(personal_documents) to authenticated;

insert into storage.buckets (id, name, public)
values ('personal-documents', 'personal-documents', false)
on conflict (id) do nothing;

create policy "personal_docs_owner_select" on storage.objects
  for select
  using (bucket_id = 'personal-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "personal_docs_owner_insert" on storage.objects
  for insert
  with check (bucket_id = 'personal-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "personal_docs_owner_update" on storage.objects
  for update
  using (bucket_id = 'personal-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "personal_docs_owner_delete" on storage.objects
  for delete
  using (bucket_id = 'personal-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
-- PARTE 3 — CONVITE POR E-MAIL + ACESSO COMPARTILHADO
-- (somente visualização pra quem aceita o convite)
-- =========================================================

create table trip_collaborators (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  invite_id  uuid references trip_invites(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

alter table trip_collaborators enable row level security;

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

create policy "trip_collaborators_owner_select" on trip_collaborators
  for select
  using (is_trip_owner(trip_id));

-- Ninguém insere direto por aqui — só a função accept_trip_invite
-- abaixo, que roda como dono da tabela e por isso não depende de
-- policy de insert.

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

-- Fim — banco recriado do zero, já com tudo (schema base + convite
-- por e-mail com acesso compartilhado + lugares para visitar + área
-- pessoal + criptografia).
