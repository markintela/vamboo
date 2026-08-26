-- =========================================================
-- Vamboo — Migração 013
-- Substitui o anexo único do deslocamento (trip_transports.
-- attachment_path, migração 012) por vários documentos, cada um com
-- nome próprio — mesma ideia de personal_documents, só que por
-- deslocamento em vez de por usuário.
--
-- attachment_path continua na tabela (aditivo, nunca remove coluna),
-- só que o app para de usá-la a partir de agora.
--
-- ADITIVA: só cria tabela e policies novas.
-- Pressupõe que 20250101000300 (is_trip_admin/is_trip_collaborator)
-- e 20250101001100 (bucket transport-documents) já foram aplicadas.
-- =========================================================

create table trip_transport_documents (
  id           uuid primary key default gen_random_uuid(),
  transport_id uuid not null references trip_transports(id) on delete cascade,
  label        text,
  file_path    text not null,
  created_at   timestamptz not null default now()
);

create index idx_trip_transport_documents_transport on trip_transport_documents(transport_id);

alter table trip_transport_documents enable row level security;

create policy "trip_transport_documents_owner_all" on trip_transport_documents
  for all
  using (exists (
    select 1 from trip_transports tt where tt.id = trip_transport_documents.transport_id and is_trip_owner(tt.trip_id)
  ))
  with check (exists (
    select 1 from trip_transports tt where tt.id = trip_transport_documents.transport_id and is_trip_owner(tt.trip_id)
  ));

create policy "trip_transport_documents_admin_all" on trip_transport_documents
  for all
  using (exists (
    select 1 from trip_transports tt where tt.id = trip_transport_documents.transport_id and is_trip_admin(tt.trip_id)
  ))
  with check (exists (
    select 1 from trip_transports tt where tt.id = trip_transport_documents.transport_id and is_trip_admin(tt.trip_id)
  ));

create policy "trip_transport_documents_collaborator_select" on trip_transport_documents
  for select
  using (exists (
    select 1 from trip_transports tt where tt.id = trip_transport_documents.transport_id and is_trip_collaborator(tt.trip_id)
  ));

-- Fim da migração 013.
