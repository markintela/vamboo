-- Link público de compartilhamento da viagem: enquanto share_token não for
-- nulo, qualquer pessoa com o link em /share/<token> pode ver (sem login)
-- o itinerário, hospedagem e documentos da trip. Fica ativo até o dono
-- desativar (setar de volta pra null) — sem expiração automática.
alter table trips add column share_token text unique;
create index idx_trips_share_token on trips(share_token) where share_token is not null;
