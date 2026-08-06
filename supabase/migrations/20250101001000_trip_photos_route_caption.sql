-- =========================================================
-- Vamboo — Migração 011
-- Cada foto da galeria pode ser associada a uma cidade do roteiro
-- (route_id) e ganhar uma legenda — usados pra separar a galeria em
-- seções por rota (na mesma ordem do Roteiro), com uma seção "sem
-- localização definida" pras fotos sem rota. Editado a partir da
-- foto maximizada (lightbox), não no upload em massa.
--
-- ADITIVA: só adiciona colunas (nullable) e um índice.
-- Pressupõe que 20250101000900 (trip_photos) já foi aplicada.
-- =========================================================

alter table trip_photos add column if not exists route_id uuid references trip_routes(id) on delete set null;
alter table trip_photos add column if not exists caption text;

create index if not exists idx_trip_photos_route on trip_photos(route_id);

-- Fim da migração 011.
