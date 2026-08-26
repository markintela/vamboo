-- =========================================================
-- Vamboo — RESET (apaga tudo)
-- ⚠️ DESTRUTIVO: apaga TODAS as tabelas, views, funções, tipos e
-- policies de Storage do app (trips, roteiro, despesas, voos,
-- hotéis, pessoas, convites, colaboradores, documentos, perfil).
--
-- NÃO apaga usuários de autenticação (auth.users) — o login
-- continua funcionando depois. Apaga a chave de criptografia do
-- Vault (será recriada com um valor placeholder ao rodar
-- recreate.sql — troque por uma sua antes de guardar dado real).
--
-- Como usar: cole este arquivo inteiro no SQL Editor do Supabase
-- (Dashboard > SQL Editor > New query) e rode. Depois, rode
-- recreate.sql pra reconstruir o schema do zero, vazio.
-- =========================================================

-- Storage: policies primeiro (senão dá erro de dependência)
drop policy if exists "hotel_files_owner_select" on storage.objects;
drop policy if exists "hotel_files_owner_insert" on storage.objects;
drop policy if exists "hotel_files_owner_update" on storage.objects;
drop policy if exists "hotel_files_owner_delete" on storage.objects;
drop policy if exists "transport_files_owner_select" on storage.objects;
drop policy if exists "transport_files_owner_insert" on storage.objects;
drop policy if exists "transport_files_owner_update" on storage.objects;
drop policy if exists "transport_files_owner_delete" on storage.objects;
drop policy if exists "personal_docs_owner_select" on storage.objects;
drop policy if exists "personal_docs_owner_insert" on storage.objects;
drop policy if exists "personal_docs_owner_update" on storage.objects;
drop policy if exists "personal_docs_owner_delete" on storage.objects;
drop policy if exists "personal_docs_trip_avatar_select" on storage.objects;
drop policy if exists "personal_docs_trip_owner_avatar_select" on storage.objects;
drop policy if exists "trip_photos_owner_all_storage" on storage.objects;
drop policy if exists "trip_photos_admin_all_storage" on storage.objects;
drop policy if exists "trip_photos_collaborator_select_storage" on storage.objects;

-- Obs: o Supabase bloqueia "delete" direto em storage.objects/storage.buckets
-- via SQL ("Direct deletion from storage tables is not allowed") — pra
-- apagar os arquivos já enviados (comprovantes, fotos, documentos), use o
-- Dashboard (Storage > bucket > selecionar tudo > excluir) antes ou depois
-- de rodar isto. Os buckets em si são recriados de forma idempotente pelo
-- recreate.sql (on conflict do nothing), então não precisa apagá-los aqui.

drop view if exists trip_totals;

-- Funções que recebem tabela como tipo de parâmetro (hotels,
-- personal_documents) e as de convite/colaborador — cascade cuida de
-- quem depende delas.
drop function if exists get_invite_by_token(uuid) cascade;
drop function if exists accept_trip_invite(uuid) cascade;
drop function if exists is_trip_owner(uuid) cascade;
drop function if exists is_trip_admin(uuid) cascade;
drop function if exists is_trip_collaborator(uuid) cascade;
drop function if exists shares_trip_with(uuid) cascade;
drop function if exists is_owner_of_shared_trip(uuid) cascade;
drop function if exists set_collaborator_role(uuid, uuid, text) cascade;
drop function if exists reservation_number_decrypted(hotels) cascade;
drop function if exists document_number_decrypted(personal_documents) cascade;

-- Tabelas — cascade cuida de FKs, policies, triggers e índices
drop table if exists trip_photos cascade;
drop table if exists trip_collaborators cascade;
drop table if exists trip_invites cascade;
drop table if exists personal_documents cascade;
drop table if exists profiles cascade;
drop table if exists trip_route_places cascade;
drop table if exists trip_transport_documents cascade;
drop table if exists trip_transports cascade;
drop table if exists hotels cascade;
drop table if exists flights cascade;
drop table if exists expenses cascade;
drop table if exists trip_routes cascade;
drop table if exists trip_people cascade;
drop table if exists trips cascade;

drop type if exists expense_category;
drop type if exists transport_type;
drop type if exists personal_document_type;

drop function if exists set_updated_at() cascade;
drop function if exists hotels_encrypt_trigger() cascade;
drop function if exists personal_documents_encrypt_trigger() cascade;
drop function if exists encrypt_secret(text) cascade;
drop function if exists decrypt_secret(text) cascade;

delete from vault.secrets where name = 'app_encryption_key';

-- Fim do reset — o banco fica sem nenhuma tabela do app (auth.users
-- continua intacto, login não é afetado). Rode recreate.sql em seguida.
