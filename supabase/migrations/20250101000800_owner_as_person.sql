-- =========================================================
-- Vamboo — Migração 009
-- O dono/criador da trip passa a aparecer na aba "Pessoas" junto com
-- os colaboradores e as pessoas cadastradas manualmente (antes ele
-- não aparecia na própria listagem). Pra isso, um colaborador
-- (não-dono) precisa conseguir ler o perfil (nome + foto) do dono —
-- hoje "profiles_trip_member_select" só libera perfil de quem é
-- colaborador (linha em trip_collaborators); o dono nunca é uma
-- linha lá, então ficava de fora.
--
-- ADITIVA: só soma policies novas (RLS permissivo — múltiplas
-- policies de select no mesmo recurso se combinam com OR), nenhuma
-- é removida ou alterada.
-- =========================================================

-- is_owner_of_shared_trip: verdadeiro se p_owner_id é dono de alguma
-- trip em que auth.uid() é colaborador — mesmo padrão security
-- definer de is_trip_owner/is_trip_collaborator/shares_trip_with,
-- pra evitar recursão de RLS.
create or replace function is_owner_of_shared_trip(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from trips t
    where t.user_id = p_owner_id
    and is_trip_collaborator(t.id)
  );
$$;

grant execute on function is_owner_of_shared_trip(uuid) to authenticated;

create policy "profiles_trip_owner_select" on profiles
  for select
  using (is_owner_of_shared_trip(profiles.user_id));

create policy "personal_docs_trip_owner_avatar_select" on storage.objects
  for select
  using (
    bucket_id = 'personal-documents'
    and name like '%/avatar-%'
    and is_owner_of_shared_trip(((storage.foldername(name))[1])::uuid)
  );

-- Fim da migração 009.
