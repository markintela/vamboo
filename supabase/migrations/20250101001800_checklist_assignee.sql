-- =========================================================
-- Vamboh — Migração 019
-- "Check points" vira o domínio "Tarefas" — sem mudança de schema
-- pra isso (é só rótulo na UI). Nessa migração, só adiciona a
-- possibilidade de atribuir uma tarefa a um tripulante (nome livre,
-- já que trip_people não tem conta de usuário — não dá pra ser uma FK
-- pra auth.users como done_by). Coluna simples, já coberta pelas
-- policies existentes de trip_checklist_items.
-- =========================================================

alter table trip_checklist_items add column if not exists assigned_to text;

-- Fim da migração 019.
