-- =========================================================
-- Vamboo — Migração 008
-- Adiciona nacionalidade ao perfil (usada pra mostrar a bandeira do
-- usuário logado no dashboard, ao lado do nome/e-mail).
--
-- ADITIVA: só adiciona uma coluna nullable. Nenhuma policy nova é
-- necessária — "profiles_owner_all" já cobre leitura/escrita do
-- próprio perfil.
-- =========================================================

alter table profiles add column if not exists nationality text;

-- Fim da migração 008.
