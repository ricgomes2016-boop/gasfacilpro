

## Conexão "1-clique" para Redes Sociais — o que é possível

### Resposta direta

**Sim, é possível** para Instagram, Facebook, TikTok, YouTube, LinkedIn e Pinterest — todos suportam OAuth oficial (mesmo padrão que já implementamos para Meta). O fluxo fica:

1. Usuário clica **"Conectar TikTok"** → abre popup
2. Faz login na própria plataforma (ou cria conta lá mesmo)
3. Autoriza o GásFácilPro
4. Popup fecha sozinho → conta já aparece conectada no sistema

**O que NÃO é possível** (limitação das próprias plataformas, não do Lovable):

- ❌ Criar a conta da rede social *de dentro* do nosso sistema (ex: cadastrar e-mail/senha do TikTok pelo nosso form). Instagram, TikTok, YouTube etc. **proíbem** isso nos termos de uso — só permitem cadastro nos sites/apps oficiais deles.
- ❌ WhatsApp: não tem OAuth público; usa Cloud API (já implementado no projeto) ou Evolution.
- ✅ Mas o popup OAuth **já abre direto na tela de login/cadastro da plataforma**, então na prática é "2 cliques": clicar em "Criar conta" dentro do popup do TikTok e voltar — quase igual ao que você descreveu.

### O que será entregue

**1. Botão único "Conectar rede social" com seletor visual**
Substituir o wizard atual de 5 cards por um modal mais direto:
- Lista vertical das 6 plataformas com OAuth (Instagram, Facebook, TikTok, YouTube, LinkedIn, Pinterest)
- Cada uma com badge: 🟢 Conectada / ⚪ Não conectada
- Clicou → abre popup OAuth direto, sem etapas intermediárias
- Se a pessoa não tem conta ainda, o próprio popup oferece "Criar conta" da plataforma

**2. OAuth para TikTok Business**
- Nova edge function `tiktok-oauth-start` + `tiktok-oauth-callback` (mesmo padrão da Meta)
- Salva token em `social_accounts` com `plataforma='tiktok'`, `conectado_via='oauth'`
- Permissões: `user.info.basic`, `video.publish`, `video.upload`
- **Pré-requisito**: criar app em developers.tiktok.com (TikTok for Developers) — vou te guiar

**3. OAuth para YouTube (Google)**
- Reusa o `lovable.auth.signInWithOAuth("google", ...)` com escopos extras: `youtube.upload`, `youtube.readonly`
- Salva canal e token em `social_accounts` com `plataforma='youtube'`
- **Pré-requisito**: ativar YouTube Data API v3 no Google Cloud do app já existente

**4. OAuth para LinkedIn (opcional, marcar como "em breve" se preferir)**
- Edge functions `linkedin-oauth-start` + `linkedin-oauth-callback`
- Permissões: `w_member_social` (postar) + `r_organization_social` (páginas de empresa)
- **Pré-requisito**: criar app em linkedin.com/developers

**5. OAuth para Pinterest (opcional)**
- Edge functions `pinterest-oauth-start` + `pinterest-oauth-callback`
- Permissões: `boards:read`, `pins:write`
- **Pré-requisito**: criar app em developers.pinterest.com

**6. Publicação automática estendida**
- O cron `meta-publish-cron-job` já existe; criar `tiktok-publish-cron`, `youtube-publish-cron`, `linkedin-publish-cron`, `pinterest-publish-cron` (cada um a cada 5 min)
- Posts agendados publicam sozinhos para qualquer rede conectada via OAuth

**7. Tela "Adicionar rede social" simplificada**
Remover o wizard atual `CriarPaginaWizard.tsx`. Substituir por:
- Botão grande: **"+ Conectar rede social"**
- Modal lista as 6 plataformas; cada linha tem botão **"Conectar"** (OAuth) ou **"Já conectada ✓"**
- Para WhatsApp, manter o fluxo atual (Cloud API/Evolution)
- Texto pequeno: *"Não tem conta ainda? O próprio popup vai te oferecer criar uma."*

### Resumo do que **não dá** (limite das plataformas)

| Plataforma | Conectar conta existente | Criar conta nova de dentro do sistema |
|------------|--------------------------|----------------------------------------|
| Instagram  | ✅ OAuth (já feito)      | ❌ proibido pelo Meta — usuário cria no app do IG |
| Facebook   | ✅ OAuth (já feito)      | ❌ idem |
| TikTok     | ✅ OAuth (a fazer)       | ❌ usuário cria no app TikTok; popup mostra "Sign up" |
| YouTube    | ✅ OAuth (a fazer)       | ❌ requer conta Google |
| LinkedIn   | ✅ OAuth (a fazer)       | ❌ usuário cria em linkedin.com |
| Pinterest  | ✅ OAuth (a fazer)       | ❌ usuário cria em pinterest.com |
| WhatsApp   | ⚠️ via Cloud API/Evolution (já feito) | N/A |

### Sequência recomendada (porque cada plataforma exige App Review)

1. **Agora**: Implementar UX simplificada do botão único + ativar TikTok e YouTube (mais usados).
2. **Depois**: LinkedIn e Pinterest sob demanda (menos usados em distribuidoras de gás).

### Detalhes técnicos

- **Arquivos novos**:
  - `supabase/functions/tiktok-oauth-start/index.ts`
  - `supabase/functions/tiktok-oauth-callback/index.ts`
  - `supabase/functions/youtube-oauth-start/index.ts`
  - `supabase/functions/youtube-oauth-callback/index.ts`
  - `supabase/functions/tiktok-publish-cron/index.ts`
  - `supabase/functions/tiktok-publish-post/index.ts`
  - `supabase/functions/youtube-publish-cron/index.ts`
  - `supabase/functions/youtube-publish-post/index.ts`
  - `src/components/marketing/ConectarRedesModal.tsx` (substitui `CriarPaginaWizard.tsx`)
- **Arquivos alterados**:
  - `src/pages/marketing/RedesSociais.tsx` — botão único + modal
  - `src/components/marketing/ConectarRedeSocialButton.tsx` — aceitar `plataforma: 'meta' | 'tiktok' | 'youtube' | ...`
- **Secrets novos** (vou pedir após aprovação):
  - `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`
  - `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` (pode reusar o Google OAuth do app)
- **Reusa a tabela `oauth_states`** já criada na implementação anterior (multi-tenant, anti-replay).

### Perguntas antes de implementar

1. **Quais plataformas priorizar agora?** TikTok + YouTube (recomendado) ou as 4 todas?
2. Você já tem **app TikTok Developer** criado? Se não, te guio passo a passo (5 min).
3. O **Google OAuth** do projeto pode ser estendido para YouTube, ou prefere app separado?

