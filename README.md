# Vamboo — Next.js + TypeScript + Supabase

Projeto real (não é mais só protótipo estático) do Vamboo: roteiro, despesas e
hospedagem, com login de verdade.

## 1. Configurar o Supabase

1. Crie um projeto em https://supabase.com (se ainda não tiver).
2. Rode as migrations de `supabase/migrations/` — veja a seção 2 abaixo pra
   duas formas de fazer isso (CLI, recomendado, ou colar no SQL Editor).
3. Em **Settings > API**, copie a `Project URL` e a `anon public key`
   (ou `publishable key`, em projetos mais novos — é o mesmo valor pro
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Copie `.env.local.example` para `.env.local` e preencha:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   DOCS_ENCRYPTION_KEY=...   # gere com `openssl rand -base64 32`
   ```

## 2. Aplicar migrations (schema, tabelas novas, etc.)

O Supabase não expõe uma API REST genérica pra "rodar SQL arbitrário" (por
segurança) — o jeito certo de aplicar migrations por fora do dashboard é a
**CLI oficial**, que já está instalada localmente como dependência do projeto
(`npx supabase ...`, não precisa instalar nada global).

### Opção A — CLI (recomendado, permite aplicar/versionar migrations daqui)

1. `npx supabase login` — abre o navegador pra gerar um access token.
2. `npx supabase link --project-ref hqeufkxtgvdxcbbsqajz` — liga esta pasta
   ao seu projeto (vai pedir a senha do banco, a que você definiu ao criar o
   projeto no Supabase — se não lembrar, dá pra resetar em
   **Settings > Database**).
3. Se `supabase/migrations/20250101000000_initial_schema.sql` (o schema
   base) já foi rodado antes manualmente pelo SQL Editor, avise a CLI que
   ela já está aplicada — senão ela tenta recriar tabela que já existe:
   ```
   npx supabase migration repair --status applied 20250101000000
   ```
4. Aplique o que falta:
   ```
   npx supabase db push
   ```
   Isso roda só as migrations que ainda não foram aplicadas nesse projeto.
5. Pra próximas mudanças de schema: `npx supabase migration new nome_da_mudanca`
   cria o arquivo vazio já com timestamp certo em `supabase/migrations/`;
   edite o SQL e rode `npx supabase db push` de novo.

### Opção B — colar manualmente no SQL Editor

Sem instalar/logar em nada: abra cada arquivo de `supabase/migrations/` **na
ordem do nome** (o timestamp no início do nome é a ordem), cole no SQL
Editor do dashboard e rode um de cada vez.

### Opção C — apagar tudo e recomeçar do zero

Pra quando o banco fica com dado de teste bagunçado ou schema
inconsistente e é mais fácil recomeçar do que consertar:

1. `supabase/reset.sql` — ⚠️ **destrutivo**, apaga todas as tabelas,
   views, funções e tipos do app (não mexe em `auth.users`, login
   continua funcionando). Cole no SQL Editor e rode.
2. `supabase/recreate.sql` — recria o schema inteiro do zero, já com
   tudo (equivalente às 3 migrations de `supabase/migrations/` juntas).
   Cole no SQL Editor e rode logo em seguida.

## 3. Ativar login com Google e Microsoft

Em **Authentication > Providers** no Supabase:

- **Google**: ative, cole o Client ID e Client Secret de um projeto no
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  (tipo "OAuth Client ID", "Web application"). Nas "Authorized redirect URIs"
  do Google, cole a URL de callback que o Supabase mostra na tela do provider.
- **Microsoft (Azure)**: ative o provider "Azure", cadastre um app em
  [Azure Portal > App registrations](https://portal.azure.com), copie o
  Client ID e um Client Secret, e cole a mesma URL de callback do Supabase lá
  também.
- Em **Authentication > URL Configuration**, adicione
  `http://localhost:3000/auth/callback` (e depois a URL de produção) na lista
  de Redirect URLs.

Sem isso configurado, os botões de Google/Microsoft aparecem mas dão erro —
o e-mail/senha funciona independente disso.

## 4. Ativar convite por e-mail (Resend)

O convite de pessoas pra uma trip (aba "Pessoas" > "Convidar") manda um
e-mail de verdade com um link de aceite. Isso usa o [Resend](https://resend.com),
um provedor de envio de e-mail transacional com plano grátis (100 e-mails/dia).

1. Crie uma conta em [resend.com](https://resend.com/signup) (dá pra entrar
   com Google, sem cartão).
2. No dashboard do Resend, vá em **API Keys > Create API Key**. Dê um nome
   (ex: "Vamboo"), permissão "Sending access", e copie a chave (começa com
   `re_`) — só aparece uma vez.
3. Cole no `.env.local`:
   ```
   RESEND_API_KEY=re_sua_chave_aqui
   ```
4. Sobre o remetente (`RESEND_FROM_EMAIL`), duas opções:
   - **Testar rápido, sem configurar domínio**: deixe o padrão
     `Vamboo <onboarding@resend.dev>`. Limitação do Resend: nesse modo de
     teste, e-mails só chegam pro endereço com que você criou a conta
     Resend (bom pra testar localmente, não serve pra convidar qualquer
     pessoa).
   - **Para valer, qualquer destinatário**: em **Domains > Add Domain** no
     Resend, adicione um domínio seu e configure os registros DNS
     (SPF/DKIM) que ele pedir. Depois de verificado, troque no `.env.local`:
     ```
     RESEND_FROM_EMAIL=Vamboo <convites@seudominio.com>
     ```
5. Reinicie `npm run dev` (variáveis de ambiente só carregam na
   inicialização) e teste convidando alguém numa trip.

Sem `RESEND_API_KEY` configurada, o convite mostra um erro claro na tela
("RESEND_API_KEY não configurada") em vez de travar — e o link de convite
gerado (`/convite/[token]`) continua existindo, só não é enviado por e-mail
automaticamente.

## 5. Rodar local

```bash
npm install
npm run dev
```

Abra http://localhost:3000 — vai te mandar pro login.

## 6. O que já funciona de verdade

- Cadastro/login por e-mail e senha (com confirmação por e-mail).
- Login com Google e Microsoft (assim que configurados na seção 3).
- Dashboard com as trips do usuário logado (protegido por RLS — cada um só
  vê as próprias trips e as que aceitou por convite).
- Página da trip organizada em 3 abas: **Roteiro** (cidades + lugares para
  visitar), **Despesas** (com 3 sub-seções: Deslocamento, Hotéis, Gerais) e
  **Pessoas**.
- Bloqueio de datas sobrepostas ao cadastrar uma cidade no roteiro, e as
  datas de uma cidade nova ficam restritas ao período da trip.
- Lugares para visitar por cidade, com checklist de visitado/não visitado.
- **Deslocamento**: 8 tipos de transporte (barco, avião, trem, carro, ônibus,
  ferry, mototáxi, outro), sempre vinculado a uma cidade do roteiro; avião
  tem campos opcionais de horário do voo e código de confirmação. Veja
  `supabase/migrations/20250101000300_transport_expenses_and_roles.sql`.
- Hotéis: vinculados a uma cidade do roteiro, número da reserva e upload
  real de comprovante (PDF/imagem), encriptados antes de salvar (ver
  seção 8).
- Todo item de roteiro/despesa/pessoa pode ser **editado e excluído**
  (exclusão sempre pede confirmação antes).
- Área pessoal (`/perfil`): foto e documentos (RG, passaporte, outro), com
  número do documento opcional — também encriptados.
- **Convidar pessoas por e-mail** (aba Pessoas > Convidar): manda um e-mail
  de verdade via Resend (seção 4) com um link `/convite/[token]`. Quem
  aceitar vira colaborador com um de dois papéis: **visualizador** (só vê a
  trip) ou **administrador** (edita roteiro/despesas/pessoas e também pode
  convidar gente) — só quem criou a trip pode promover/rebaixar um
  colaborador. Veja `supabase/migrations/20250101000200_trip_sharing.sql`
  (convite base) e `20250101000300_transport_expenses_and_roles.sql`
  (papel de administrador).

## 7. O que está MOCADO (fake) de propósito

- **Convite por WhatsApp** (`lib/invites.ts`): só simula o envio com um
  delay e uma mensagem de sucesso — não manda nada de verdade. Precisaria da
  WhatsApp Cloud API (Meta) ou um provedor tipo Twilio, com número comercial
  verificado e template de mensagem aprovado.

## 8. Criptografia de dados sensíveis

Só os campos que de fato precisam de proteção extra ficam encriptados —
o resto (nome da trip, valores, datas etc.) fica em texto normal, senão
totais, ordenação e RLS quebrariam:

- **Número da reserva do hotel** e **número do documento pessoal**: ficam
  encriptados no Postgres com `pgcrypto`. A chave mora no **Supabase
  Vault** (não dá pra usar `alter database ... set` num projeto hospedado —
  falta permissão de superusuário). Escrita e leitura são transparentes
  pro app: um trigger encripta ao salvar, uma função de coluna computada
  (`reservation_number_decrypted`, `document_number_decrypted`) decripta ao
  ler — e só decripta linhas que a RLS já liberou pro dono.
- **Arquivos** (comprovante de hotel, fotos de documento/perfil): passam
  por uma API Route no servidor que encripta com AES-256-GCM
  (`lib/crypto.ts`, chave em `DOCS_ENCRYPTION_KEY` no `.env.local`, nunca
  exposta ao navegador) antes de subir pro Storage, e decripta só na hora
  de você pedir pra ver.

Isso protege contra vazamento de backup/dump ou acesso casual às tabelas —
não contra alguém com acesso de superusuário/service role ao Postgres, o
que é uma limitação inerente de criptografia feita dentro do próprio banco.

## 9. Estrutura

```
app/
  login/page.tsx              tela de login (client component)
  auth/callback/route.ts      troca o código do OAuth pela sessão
  dashboard/page.tsx          busca as trips (server component)
  dashboard/DashboardClient.tsx   grid + criar trip (client component)
  trips/[id]/page.tsx         busca a trip completa (server component)
  trips/[id]/TripDetailClient.tsx  abas, formulários, convite (client component)
  perfil/page.tsx              busca perfil + documentos (server component)
  perfil/PerfilClient.tsx      foto + documentos (client component)
  convite/[token]/page.tsx     busca o convite pelo token (server component)
  convite/[token]/AcceptInviteClient.tsx  aceitar convite (client component)
  api/hotel-files/             upload/download encriptado de comprovante
  api/personal-docs/           upload/download/delete encriptado de documento
  api/profile-photo/           upload encriptado de foto de perfil
  api/invites/                 cria o convite e manda o e-mail (Resend)
  globals.css                  todos os tokens visuais (cores, fontes, etc)
components/                    Logo, TripCard, SummaryCard, Modal, InviteModal
lib/
  supabase/client.ts          cliente Supabase pro navegador
  supabase/server.ts          cliente Supabase pro servidor
  dates.ts                    noites, status da linha do tempo, sobreposição
  invites.ts                  e-mail real via /api/invites; WhatsApp ainda MOCADO
  email.ts                    envio de e-mail via Resend (server-only)
  crypto.ts                   encriptar/decriptar arquivos (AES-256-GCM)
  secureStorage.ts            upload/download encriptado no Supabase Storage
  types.ts                    tipos TypeScript do schema
middleware.ts                 protege /dashboard, /trips e /perfil, redireciona pro login
supabase/migrations/          schema + migrations, aplicar via CLI (seção 2)
supabase/config.toml          config da Supabase CLI
```

## 10. Próximos passos sugeridos

1. Configurar Google/Microsoft de verdade (seção 3).
2. Configurar o Resend com domínio verificado pra convidar qualquer e-mail,
   não só o da sua conta Resend (seção 4).
3. Trocar o envio mocado de convite por WhatsApp pela integração real.
4. Deploy: Vercel (plano free serve bem) + as mesmas variáveis de ambiente
   do `.env.local` cadastradas lá (incluindo `DOCS_ENCRYPTION_KEY` e
   `RESEND_API_KEY`).
