

## Conexão e Criação de Páginas em Redes Sociais

### Resposta direta às perguntas

**1. Conectar conta de rede social existente?**
Sim, é totalmente possível via OAuth oficial das próprias plataformas (Meta Graph API para Instagram/Facebook, WhatsApp Cloud API já existente no projeto). O usuário autoriza uma vez e o sistema passa a publicar/agendar/ler métricas em nome dele.

**2. Criar uma página/conta nova direto pelo sistema?**
**Não é possível** criar contas de Instagram, Facebook, TikTok ou YouTube via API — todas as plataformas exigem cadastro manual no app/site oficial por questões de verificação humana, anti-spam e termos de uso.
O que dá para fazer é **guiar o usuário no processo** (passo a passo dentro do sistema com links diretos) e, **após criada**, conectá-la automaticamente.

### O que será entregue

**Parte A — Conexão real via OAuth (Meta: Instagram + Facebook)**

Aproveita a infraestrutura Meta já existente no projeto (WhatsApp Cloud API, App ID configurado).

1. **Tela `/marketing/redes-sociais` reformulada** (já existe como cadastro manual — vira hub de conexão real):
   - Botão **"Conectar Instagram + Facebook"** → abre fluxo OAuth da Meta solicitando escopos: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `business_management`.
   - Botão **"Conectar WhatsApp Business"** → reaproveita integração existente.
   - Botões **TikTok** e **YouTube** com tooltip "Em breve" (APIs exigem aprovação caso a caso e ficam para fase 2).

2. **Edge functions novas:**
   - `meta-oauth-start` — gera URL de autorização Meta com `state` assinado.
   - `meta-oauth-callback` — troca `code` por access token de longa duração (60 dias), descobre páginas FB e contas IG vinculadas, salva criptografado em `social_accounts`.
   - `meta-publish-post` — publica post (imagem + legenda) no IG/FB usando token salvo.
   - `meta-refresh-token` — renova tokens antes de expirar (cron diário).

3. **Tabela `social_accounts` estendida** (já existe):
```sql
ALTER TABLE social_accounts ADD COLUMN access_token text;
ALTER TABLE social_accounts ADD COLUMN refresh_token text;
ALTER TABLE social_accounts ADD COLUMN token_expires_at timestamptz;
ALTER TABLE social_accounts ADD COLUMN page_id text;          -- FB Page ID
ALTER TABLE social_accounts ADD COLUMN ig_business_id text;   -- IG Business Account ID
ALTER TABLE social_accounts ADD COLUMN scopes text[];
ALTER TABLE social_accounts ADD COLUMN conectado_via text DEFAULT 'manual'; -- 'oauth'|'manual'
```
RLS já aplicada por `empresa_id`.

4. **Integração com agendador**: posts agendados em `marketing_agendamentos` que tenham `social_account_id` com `conectado_via='oauth'` são publicados automaticamente via cron (`meta-publish-cron` rodando a cada 5 min). Posts em contas manuais continuam como lembrete.

**Parte B — Guia "Criar nova página" (assistente passo a passo)**

Como APIs não criam contas, oferecemos um **wizard de criação assistida**:

1. Card **"Não tem página ainda? Criamos com você"** na tela de Redes Sociais.
2. Modal com escolha de plataforma (Instagram, Facebook, TikTok, YouTube, WhatsApp Business).
3. Para cada plataforma, exibe:
   - Checklist de pré-requisitos (e-mail, telefone, logo, descrição da empresa).
   - Sugestão de nome/@handle baseada no nome da empresa (`{empresa.nome} + cidade`).
   - Sugestão de bio/descrição gerada por IA (reusa edge function `marketing-ai`).
   - Sugestão de foto de perfil (logo da empresa salvo no sistema) e capa.
   - Link direto que abre o fluxo de cadastro oficial em nova aba (ex.: `https://www.instagram.com/accounts/emailsignup/`, `https://www.facebook.com/pages/create`, `https://business.tiktok.com/portal/registration`, `https://www.youtube.com/create_channel`, `https://business.whatsapp.com/`).
   - Após criar, botão **"Já criei, conectar agora"** que dispara o OAuth da Parte A.

### Detalhes técnicos

**Secret necessário (Meta App):**
- `META_APP_ID` (já existe no projeto — verificar)
- `META_APP_SECRET` (precisa adicionar via `add_secret` se ainda não houver)
- `META_OAUTH_REDIRECT_URI` = `https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/meta-oauth-callback`

**Configuração no Meta Developer Console** (passo manual do usuário, com guia exibido na UI):
1. Adicionar a redirect URI acima em "Valid OAuth Redirect URIs" do app Meta.
2. Solicitar revisão dos escopos `instagram_content_publish`, `pages_manage_posts` (Meta exige App Review para sair do modo dev).
3. Vincular conta Instagram Business à Página do Facebook.

**Arquivos novos:**
- `supabase/functions/meta-oauth-start/index.ts`
- `supabase/functions/meta-oauth-callback/index.ts`
- `supabase/functions/meta-publish-post/index.ts`
- `supabase/functions/meta-publish-cron/index.ts`
- `src/pages/marketing/RedesSociaisHub.tsx` (substitui `RedesSociais.tsx` atual mantendo compatibilidade)
- `src/components/marketing/CriarPaginaWizard.tsx`
- `src/components/marketing/ConectarRedeSocialButton.tsx`

**Arquivos alterados:**
- `src/pages/marketing/AgendamentoPosts.tsx` — mostrar selo "Publicação automática" quando conta estiver via OAuth.
- `supabase/migrations/...` — alterações em `social_accounts`.

### Limites a comunicar ao usuário (importante)

- **Instagram via API**: só publica em contas **Instagram Business** ou **Creator** vinculadas a uma Página do Facebook. Conta pessoal não funciona.
- **Stories e Reels via API**: Reels suportado, Stories tem limitações (só conta Business com >100 seguidores em alguns mercados).
- **TikTok/YouTube**: APIs existem mas exigem aprovação individual (semanas a meses) — entram como roadmap.
- **App Meta em modo Desenvolvimento** publica só nas contas dos testadores cadastrados; produção exige App Review.

### Critérios de aceite

- Botão "Conectar Instagram + Facebook" abre OAuth Meta e salva tokens criptografados.
- Após conectar, contas aparecem na lista com badge "Conectado via OAuth" e nome real puxado da Meta.
- Posts agendados em conta OAuth são publicados automaticamente no horário marcado.
- Wizard "Criar nova página" guia em 5 plataformas com sugestões de IA (nome, bio, foto).
- Botão "Já criei, conectar agora" dispara OAuth direto após cadastro externo.
- Tela exibe alertas claros sobre pré-requisitos (IG Business, App Review, etc.).

### Pergunta antes de executar

A integração OAuth com Meta exige que você (ou eu, com sua autorização) configure no painel do Meta Developer:
1. A **redirect URI** no app Meta existente.
2. Adicionar o secret **`META_APP_SECRET`** no Lovable Cloud (eu solicito via tool quando aprovar).
3. Solicitar **App Review** para os escopos de publicação (processo da Meta, leva dias/semanas).

Quer que eu implemente:
- **(A) Tudo de uma vez** — OAuth Meta (IG+FB) + Wizard "Criar página" + cron de publicação automática.
- **(B) Apenas o Wizard "Criar página" agora** (sem OAuth) — entrega rápida, sem dependências externas, e deixamos a publicação automática para uma segunda etapa quando você tiver o App Review aprovado.
- **(C) Apenas o OAuth de leitura** (conectar contas e ler métricas, sem publicar) — mais fácil de aprovar na Meta, e a publicação fica manual por enquanto.

