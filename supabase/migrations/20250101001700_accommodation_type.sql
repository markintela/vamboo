-- =========================================================
-- Vamboh — Migração 018
-- Renomeia o domínio "Hotéis" para "Acomodação" e adiciona um tipo
-- (hotel, casa, hostel, airbnb, guesthouse, camping, outra). Coluna
-- simples na tabela hotels — já coberta pelas policies existentes
-- (owner_all / collaborator_select / admin_all), não precisa de
-- policy nova.
-- =========================================================

create type accommodation_type as enum
  ('hotel', 'casa', 'hostel', 'airbnb', 'guesthouse', 'camping', 'outra');

alter table hotels add column if not exists accommodation_type accommodation_type not null default 'hotel';

-- Fim da migração 018.
