-- =========================================================
-- Vamboo — Migração 014
-- Hora de chegada do deslocamento (avião), ao lado da hora de
-- partida (flight_time) já existente.
-- =========================================================

alter table trip_transports add column if not exists arrival_time time; -- só relevante quando transport_type = 'aviao'

-- Fim da migração 014.
