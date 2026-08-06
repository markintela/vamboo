-- =========================================================
-- Vamboo — Migração 006
-- Unifica "pessoas da viagem" com colaboradores: qualquer colaborador
-- (não só o dono) passa a enxergar a lista completa de quem colabora
-- na trip, e a UI passa a mostrar o nome de verdade e a foto de
-- perfil de cada colaborador (antes só o e-mail bruto aparecia, e só
-- pro dono).
--
-- ADITIVA: só adiciona funções e policies novas. Nada é apagado.
-- Pressupõe que 20250101000200 e 20250101000300 já foram aplicadas.
-- =========================================================

-- is_trip_collaborator: mesmo padrão de is_trip_owner/is_trip_admin —
-- SECURITY DEFINER pra evitar recursão de RLS numa policy que
-- referencia a própria trip_collaborators.
create or replace function is_trip_collaborator(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from trip_collaborators
    where trip_id = p_trip_id and user_id = auth.uid()
  );
$$;

grant execute on function is_trip_collaborator(uuid) to authenticated;

-- Antes, só o dono via a lista inteira (trip_collaborators_owner_select)
-- e cada um via a própria linha (trip_collaborators_self_select). Agora
-- qualquer colaborador vê todos os outros colaboradores da mesma trip.
create policy "trip_collaborators_member_select" on trip_collaborators
  for select
  using (is_trip_collaborator(trip_id));

-- shares_trip_with: decide se auth.uid() pode ver o perfil (nome/foto)
-- de outro usuário — só quando os dois compartilham alguma trip (um é
-- dono ou colaborador dela, o outro é colaborador da mesma trip).
create or replace function shares_trip_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from trip_collaborators tc
    where tc.user_id = p_user_id
    and (is_trip_owner(tc.trip_id) or is_trip_collaborator(tc.trip_id))
  );
$$;

grant execute on function shares_trip_with(uuid) to authenticated;

create policy "profiles_trip_member_select" on profiles
  for select
  using (shares_trip_with(profiles.user_id));

-- Foto de perfil: os arquivos de avatar (path "<userId>/avatar-...")
-- ficam no mesmo bucket dos documentos pessoais, mas com um prefixo
-- exclusivo — só a rota de upload de foto de perfil gera nome assim,
-- documentos pessoais nunca usam esse prefixo. Por isso dá pra liberar
-- só os arquivos de avatar pra quem compartilha uma trip, sem abrir
-- acesso a documentos (RG/passaporte) de ninguém.
create policy "personal_docs_trip_avatar_select" on storage.objects
  for select
  using (
    bucket_id = 'personal-documents'
    and name like '%/avatar-%'
    and shares_trip_with(((storage.foldername(name))[1])::uuid)
  );

-- Fim da migração 006.
