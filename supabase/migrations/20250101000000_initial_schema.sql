-- =========================================================
-- Vamboo — Schema do Supabase (Postgres)
-- =========================================================
-- Como usar: cole este arquivo inteiro no SQL Editor do seu
-- projeto Supabase (Dashboard > SQL Editor > New query) e
-- clique em "Run". Pode rodar tudo de uma vez.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- ENUM: categorias de despesa
-- (passagens aéreas ficam de fora do enum de propósito —
--  elas moram na tabela "flights", separada, conforme pedido)
-- ---------------------------------------------------------
create type expense_category as enum ('passagem_trem', 'passagem_barco', 'comida', 'outro');

-- ---------------------------------------------------------
-- TRIPS — cada viagem, dona de um usuário
-- ---------------------------------------------------------
create table trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  start_date  date,
  end_date    date,
  color_index int default 0,           -- qual cor da paleta usar no card (0-3)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table trips is 'Uma viagem cadastrada por um usuário.';

-- ---------------------------------------------------------
-- TRIP_PEOPLE — pessoas que participam da viagem
-- ---------------------------------------------------------
create table trip_people (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  name       text not null,
  age        int,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- TRIP_ROUTES — o roteiro: uma linha por cidade/país visitado
-- ---------------------------------------------------------
create table trip_routes (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  country     text not null,
  city        text not null,
  start_date  date,
  end_date    date,
  order_index int not null default 0,   -- ordem de exibição no roteiro
  notes       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------
-- EXPENSES — despesas que PODEM ser vinculadas a uma cidade
-- do roteiro (comida, trem, outro). route_id fica opcional
-- de propósito: dá pra registrar sem vincular também.
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- FLIGHTS — passagens aéreas: aba própria, NUNCA vinculadas
-- a uma cidade específica do roteiro.
-- ---------------------------------------------------------
create table flights (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips(id) on delete cascade,
  description  text not null,
  amount       numeric(12,2) not null default 0,
  currency     text not null default 'BRL',
  flight_date  date,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------
-- HOTELS — aba própria. Endereço em texto livre, link da
-- reserva, anotações e um arquivo anexado (Supabase Storage).
-- route_id é opcional, caso queira amarrar o hotel a uma
-- cidade do roteiro internamente (não aparece misturado
-- na aba de roteiro, só ajuda a agrupar se precisar depois).
-- ---------------------------------------------------------
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
  reservation_file_path text,          -- caminho no bucket 'hotel-reservations'
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Índices
-- ---------------------------------------------------------
create index idx_trips_user            on trips(user_id);
create index idx_trip_people_trip      on trip_people(trip_id);
create index idx_trip_routes_trip      on trip_routes(trip_id, order_index);
create index idx_expenses_trip         on expenses(trip_id);
create index idx_expenses_route        on expenses(route_id);
create index idx_flights_trip          on flights(trip_id);
create index idx_hotels_trip           on hotels(trip_id);

-- ---------------------------------------------------------
-- updated_at automático na tabela trips
-- ---------------------------------------------------------
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

-- =========================================================
-- ROW LEVEL SECURITY
-- Cada usuário só vê e edita as próprias trips (e tudo que
-- pende delas). É isso que permite "criar trips por pessoas
-- diferentes" com segurança.
-- =========================================================

alter table trips        enable row level security;
alter table trip_people  enable row level security;
alter table trip_routes  enable row level security;
alter table expenses     enable row level security;
alter table flights      enable row level security;
alter table hotels       enable row level security;

-- TRIPS: dono total
create policy "trips_owner_all" on trips
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- TRIP_PEOPLE: acesso via trip do dono
create policy "trip_people_owner_all" on trip_people
  for all
  using (exists (select 1 from trips where trips.id = trip_people.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = trip_people.trip_id and trips.user_id = auth.uid()));

-- TRIP_ROUTES
create policy "trip_routes_owner_all" on trip_routes
  for all
  using (exists (select 1 from trips where trips.id = trip_routes.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = trip_routes.trip_id and trips.user_id = auth.uid()));

-- EXPENSES
create policy "expenses_owner_all" on expenses
  for all
  using (exists (select 1 from trips where trips.id = expenses.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = expenses.trip_id and trips.user_id = auth.uid()));

-- FLIGHTS
create policy "flights_owner_all" on flights
  for all
  using (exists (select 1 from trips where trips.id = flights.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = flights.trip_id and trips.user_id = auth.uid()));

-- HOTELS
create policy "hotels_owner_all" on hotels
  for all
  using (exists (select 1 from trips where trips.id = hotels.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = hotels.trip_id and trips.user_id = auth.uid()));

-- =========================================================
-- STORAGE — bucket para anexar comprovantes/reservas de hotel
-- =========================================================
insert into storage.buckets (id, name, public)
values ('hotel-reservations', 'hotel-reservations', false)
on conflict (id) do nothing;

-- Convenção de caminho recomendada ao fazer upload:
--   {user_id}/{trip_id}/{hotel_id}-{nome-do-arquivo}
-- Isso permite que as policies abaixo restrinjam por pasta do usuário.

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

-- =========================================================
-- VIEW opcional: total gasto por trip (útil pro dashboard)
-- =========================================================
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

-- Fim do schema.

-- ---------------------------------------------------------
-- TRIP_INVITES — preparado para quando o envio real (e-mail/
-- WhatsApp) for conectado. Hoje o app só simula o envio
-- (veja lib/invites.ts no projeto Next.js) e não grava aqui
-- ainda; a tabela já fica pronta pro próximo passo.
-- ---------------------------------------------------------
create table trip_invites (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  channel     text not null check (channel in ('email','whatsapp')),
  destination text not null,           -- e-mail ou número de telefone
  status      text not null default 'pending' check (status in ('pending','sent','accepted','failed')),
  created_at  timestamptz not null default now()
);

alter table trip_invites enable row level security;

create policy "trip_invites_owner_all" on trip_invites
  for all
  using (exists (select 1 from trips where trips.id = trip_invites.trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from trips where trips.id = trip_invites.trip_id and trips.user_id = auth.uid()));
