-- =========================================================
-- Vamboo — Migração 017
-- Cada lugar para visitar ganha um link do Google Maps e um horário
-- planejado (data + hora) dentro do período da cidade no itinerário.
-- Colunas simples em trip_route_places — já cobertas pelas policies
-- existentes (owner_all / collaborator_select / admin_all), não
-- precisa de policy nova.
-- =========================================================

alter table trip_route_places add column if not exists maps_url text;
alter table trip_route_places add column if not exists visit_date date;
alter table trip_route_places add column if not exists visit_time time;

-- Fim da migração 017.
