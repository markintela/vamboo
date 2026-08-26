-- =========================================================
-- Vamboo — Migração 012
-- Anexo de documento (foto/PDF) nas despesas de Deslocamento — mesmo
-- padrão já usado nas reservas de hotel: bucket privado, arquivo
-- encriptado antes do upload, path prefixado pelo dono
-- ("<userId>/<tripId>/<transportId>-...") e liberado só pra ele.
--
-- ADITIVA: só adiciona uma coluna (nullable), um bucket novo e
-- policies novas.
-- =========================================================

alter table trip_transports add column if not exists attachment_path text;

insert into storage.buckets (id, name, public)
values ('transport-documents', 'transport-documents', false)
on conflict (id) do nothing;

create policy "transport_files_owner_select" on storage.objects
  for select
  using (bucket_id = 'transport-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "transport_files_owner_insert" on storage.objects
  for insert
  with check (bucket_id = 'transport-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "transport_files_owner_update" on storage.objects
  for update
  using (bucket_id = 'transport-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "transport_files_owner_delete" on storage.objects
  for delete
  using (bucket_id = 'transport-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Fim da migração 012.
