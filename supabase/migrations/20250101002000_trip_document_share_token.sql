-- Link público de um documento específico (independente do link da viagem
-- inteira): enquanto share_token não for nulo, /share/doc/<token> deixa
-- baixar aquele documento sem login. Mesma lógica do share_token de trips —
-- fica ativo até ser desativado, sem expiração automática.
alter table trip_documents add column share_token text unique;
create index idx_trip_documents_share_token on trip_documents(share_token) where share_token is not null;
