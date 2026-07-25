-- =========================================================
-- Vamboo — Migração 002
-- Lugares para visitar por cidade, número da reserva do
-- hotel, área pessoal (foto + documentos) e criptografia
-- dos campos sensíveis (pgcrypto).
--
-- Pressupõe que 20250101000000_initial_schema.sql já foi
-- aplicado antes (schema base: trips, hotels, RLS etc.).
-- Como usar: veja "Aplicar migrations" no README (CLI ou colar
-- este arquivo inteiro no SQL Editor do Supabase e rodar).
-- =========================================================

-- ---------------------------------------------------------
-- CHAVE DE CRIPTOGRAFIA DO BANCO
-- Projetos hospedados no Supabase não deixam rodar
-- `alter database ... set` (dá "permission denied to set
-- parameter") porque o SQL Editor não roda como superusuário.
-- Por isso a chave fica guardada no Vault do próprio Supabase
-- (extensão supabase_vault, já vem habilitada na maioria dos
-- projetos), que é feito pra exatamente esse caso.
-- Troque o placeholder abaixo por uma chave sua antes de rodar
-- (gere com `openssl rand -base64 32`). Guarde uma cópia em
-- local seguro: se o segredo for apagado do Vault, os dados
-- encriptados ficam irrecuperáveis; se trocar a chave depois,
-- o que já foi salvo com a antiga para de decriptar.
-- ---------------------------------------------------------
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

-- security definer: rodam como dono (quem executou esta migração),
-- que é quem tem permissão de ler o Vault e chamar pgcrypto — assim
-- nenhum outro role (nem authenticated) precisa de acesso direto
-- a nenhum dos dois. search_path fixo evita hijacking de schema.
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

-- Ninguém chama essas duas direto pela API — só através dos
-- triggers e das funções de coluna computada abaixo, que também
-- são security definer e por isso conseguem chamá-las mesmo sem
-- grant direto.
revoke all on function encrypt_secret(text) from public, anon, authenticated;
revoke all on function decrypt_secret(text) from public, anon, authenticated;

-- =========================================================
-- TRIP_ROUTE_PLACES — lugares para visitar em cada cidade
-- =========================================================
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

-- =========================================================
-- HOTELS — número da reserva (guardado encriptado)
-- =========================================================
alter table hotels add column if not exists reservation_number text;

-- O trigger encripta o valor sempre que ele muda; a aplicação
-- sempre lê/escreve como se fosse um campo de texto normal.
-- security definer: precisa rodar como dono pra ter permissão
-- de chamar encrypt_secret (que fica bloqueada pra authenticated).
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

-- Coluna computada: a aplicação seleciona "reservation_number_decrypted"
-- (nunca a coluna "reservation_number" crua, que fica só com o texto cifrado).
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

-- =========================================================
-- PROFILES — perfil pessoal (1 linha por usuário)
-- =========================================================
create table profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  photo_path text,          -- caminho no bucket 'personal-documents' (arquivo já sai encriptado da aplicação)
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_owner_all" on profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================
-- PERSONAL_DOCUMENTS — documentos pessoais (RG, passaporte…)
-- o número do documento fica encriptado no banco; o arquivo em
-- si é encriptado pela aplicação (AES-256-GCM) antes do upload,
-- ver lib/crypto.ts e app/api/personal-docs.
-- =========================================================
create type personal_document_type as enum ('id', 'passaporte', 'outro');

create table personal_documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  doc_type        personal_document_type not null,
  label           text,
  document_number text,              -- encriptado pelo trigger abaixo
  file_path       text,              -- caminho no bucket 'personal-documents'
  created_at      timestamptz not null default now()
);

create index idx_personal_documents_user on personal_documents(user_id);

alter table personal_documents enable row level security;

create policy "personal_documents_owner_all" on personal_documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- security definer pelo mesmo motivo do trigger de hotels acima.
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

-- =========================================================
-- STORAGE — bucket privado para foto de perfil e documentos
-- pessoais. Os arquivos já chegam encriptados (AES-256-GCM)
-- vindos da aplicação, então isso é uma segunda camada além
-- da criptografia nativa do Storage.
-- =========================================================
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

-- Fim da migração 002.
