-- =========================================================
-- Vamboo — Migração 007
-- Adiciona ponto de partida e ponto de chegada da viagem (país +
-- cidade, exibidos no Roteiro como um selo antes/depois da lista de
-- rotas) e libera administrador para editar os dados básicos da
-- trip (nome, datas, partida, chegada) — antes só o dono conseguia
-- dar UPDATE em trips (trips_owner_all). Excluir a trip continua
-- exclusivo do dono, nenhuma policy de DELETE é criada aqui.
--
-- ADITIVA: só adiciona colunas (nullable) e uma policy nova.
-- Pressupõe que 20250101000300 (is_trip_admin) já foi aplicada.
-- =========================================================

alter table trips add column if not exists departure_country text;
alter table trips add column if not exists departure_city text;
alter table trips add column if not exists arrival_country text;
alter table trips add column if not exists arrival_city text;

create policy "trips_admin_update" on trips
  for update
  using (is_trip_admin(id))
  with check (is_trip_admin(id));

-- Fim da migração 007.
