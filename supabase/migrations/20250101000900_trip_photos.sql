-- =========================================================
-- Vamboo — Migração 010
-- Galeria de fotos por trip: upload direto (sem integração externa —
-- o Google Photos Picker não permite selecionar um álbum inteiro de
-- uma vez, só foto por foto, então optamos por upload nativo).
--
-- Fotos não são documento sensível como RG/passaporte, então não
-- passam pela camada de criptografia usada em personal-documents —
-- ficam num bucket privado, liberado só pra quem faz parte da trip
-- (dono, administrador, colaborador), via signed URL gerada no
-- servidor (nunca fica público).
--
-- ADITIVA: só cria tabela, policies e bucket novos.
-- Pressupõe que 20250101000300 (is_trip_admin) e 20250101000500
-- (is_trip_collaborator) já foram aplicadas.
-- =========================================================

create table trip_photos (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips(id) on delete cascade,
  storage_path text not null,
  added_by     uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index idx_trip_photos_trip on trip_photos(trip_id);

alter table trip_photos enable row level security;

create policy "trip_photos_owner_all" on trip_photos
  for all
  using (is_trip_owner(trip_id))
  with check (is_trip_owner(trip_id));

create policy "trip_photos_admin_all" on trip_photos
  for all
  using (is_trip_admin(trip_id))
  with check (is_trip_admin(trip_id));

create policy "trip_photos_collaborator_select" on trip_photos
  for select
  using (is_trip_collaborator(trip_id));

insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', false)
on conflict (id) do nothing;

-- Caminho no bucket: "<tripId>/<arquivo>" — dá pra checar direto com
-- is_trip_owner/is_trip_admin/is_trip_collaborator igual às policies
-- de avatar (migration 600), sem precisar de tabela auxiliar.
create policy "trip_photos_owner_all_storage" on storage.objects
  for all
  using (bucket_id = 'trip-photos' and is_trip_owner(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'trip-photos' and is_trip_owner(((storage.foldername(name))[1])::uuid));

create policy "trip_photos_admin_all_storage" on storage.objects
  for all
  using (bucket_id = 'trip-photos' and is_trip_admin(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'trip-photos' and is_trip_admin(((storage.foldername(name))[1])::uuid));

create policy "trip_photos_collaborator_select_storage" on storage.objects
  for select
  using (bucket_id = 'trip-photos' and is_trip_collaborator(((storage.foldername(name))[1])::uuid));

-- Fim da migração 010.
