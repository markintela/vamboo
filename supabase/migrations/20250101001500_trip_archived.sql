-- =========================================================
-- Vamboo — Migração 016
-- Permite arquivar uma trip (some do filtro padrão do dashboard, sem
-- apagar nada). Coluna simples na própria tabela trips — já coberta
-- pelas policies existentes (trips_owner_all / trips_admin_update),
-- não precisa de policy nova.
-- =========================================================

alter table trips add column if not exists archived boolean not null default false;

-- Fim da migração 016.
