-- =========================================================
-- Vamboo — Migração 015
-- Duas páginas novas da trip (mesmo padrão de "Galeria" — link no
-- topo, página própria em /trips/[id]/...):
--
-- 1) Documentos: repositório geral de documentos da trip (além dos
--    documentos já existentes por deslocamento), cada um com nome
--    próprio e, opcionalmente, vinculado a uma cidade do roteiro.
--    Mesmo esquema de bucket privado + arquivo encriptado + acesso
--    de download restrito ao dono (mesma limitação já aceita em
--    transport-documents e hotel-reservations).
--
-- 2) Checklist: tarefas pendentes pra viagem acontecer. Ao concluir
--    uma tarefa, grava quando (done_at) e quem (done_by, resolvido
--    pra nome/foto do jeito que já é feito com trip_collaborators —
--    join com profiles, RLS já libera isso pra quem compartilha a
--    trip via profiles_trip_member_select/profiles_owner_all).
--
-- ADITIVA: só cria tabelas, bucket e policies novas.
-- Pressupõe que 20250101000300 (is_trip_owner/is_trip_admin/
-- is_trip_collaborator) já foi aplicada.
-- =========================================================

-- ---------------------------------------------------------
-- TRIP_DOCUMENTS
-- ---------------------------------------------------------
create table trip_documents (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  route_id   uuid references trip_routes(id) on delete set null,
  label      text not null,
  file_path  text not null,
  created_at timestamptz not null default now()
);

create index idx_trip_documents_trip on trip_documents(trip_id);

alter table trip_documents enable row level security;

create policy "trip_documents_owner_all" on trip_documents
  for all
  using (is_trip_owner(trip_id))
  with check (is_trip_owner(trip_id));

create policy "trip_documents_admin_all" on trip_documents
  for all
  using (is_trip_admin(trip_id))
  with check (is_trip_admin(trip_id));

create policy "trip_documents_collaborator_select" on trip_documents
  for select
  using (is_trip_collaborator(trip_id));

insert into storage.buckets (id, name, public)
values ('trip-documents', 'trip-documents', false)
on conflict (id) do nothing;

create policy "trip_document_files_owner_select" on storage.objects
  for select
  using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trip_document_files_owner_insert" on storage.objects
  for insert
  with check (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trip_document_files_owner_update" on storage.objects
  for update
  using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "trip_document_files_owner_delete" on storage.objects
  for delete
  using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------
-- TRIP_CHECKLIST_ITEMS
-- ---------------------------------------------------------
create table trip_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  description text not null,
  done        boolean not null default false,
  done_at     timestamptz,
  done_by     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index idx_trip_checklist_items_trip on trip_checklist_items(trip_id);

alter table trip_checklist_items enable row level security;

create policy "trip_checklist_items_owner_all" on trip_checklist_items
  for all
  using (is_trip_owner(trip_id))
  with check (is_trip_owner(trip_id));

create policy "trip_checklist_items_admin_all" on trip_checklist_items
  for all
  using (is_trip_admin(trip_id))
  with check (is_trip_admin(trip_id));

create policy "trip_checklist_items_collaborator_select" on trip_checklist_items
  for select
  using (is_trip_collaborator(trip_id));

-- Fim da migração 015.
