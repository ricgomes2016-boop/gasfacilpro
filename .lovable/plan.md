

## Multi-Tenant para Conexão Meta + Limpeza

### Resposta à pergunta 2
O app Meta do SaaS é **um só, do produto** (não da Central Gás). Cada empresa cliente autoriza esse app a postar nas Páginas/Instagrams **dela** via OAuth — os tokens já ficam isolados por `empresa_id` em `social_accounts` com RLS. Funciona como Hootsuite, Buffer, mLabs etc.

A Central Gás é apenas a **primeira empresa testadora** enquanto o app está em modo Desenvolvimento da Meta. Para os demais clientes funcionarem, precisamos: (a) passar pelo App Review da Meta para liberar produção, e (b) implementar algumas melhorias de UX e segurança listadas abaixo.

### O que será entregue

**1. Limpar cron duplicado**
- SQL via insert tool: `SELECT cron.unschedule('meta-publish-cron');` (mantém só `meta-publish-cron-job`).

**2. Reforçar isolamento por empresa no callback OAuth**
- Em `meta-oauth-callback`: validar que o `state.empresa_id` corresponde a uma empresa real e que o `state.user_id` ainda pertence àquela empresa (anti-replay).
- Adicionar `nonce` aleatório no `state` (gerado no `meta-oauth-start`, persistido em tabela `oauth_states` com TTL 10 min) para evitar reuso.
- Validar `ts` do state (rejeitar se >15 min).

**3. Tela de status do app Meta (`/marketing/redes-sociais`)**
- Card no topo informando o estado do app Meta:
  - "🟡 Modo Desenvolvimento — só Facebooks cadastrados como testadores conseguem conectar. Solicite acesso ao admin do SaaS."
  - "🟢 Aprovado pela Meta — qualquer empresa pode conectar."
- Estado controlado por flag em `configuracoes_globais` (nova linha `meta_app_review_status: 'dev' | 'approved'`).

**4. Guia visual no botão Conectar quando empresa ≠ testadora**
- Se a tentativa de OAuth falhar com erro Meta tipo `(#10) Application does not have permission` ou redirect com erro, exibir modal explicando:
  - "Seu Facebook ainda não está autorizado como testador no nosso app Meta. Envie seu Facebook ID para o suporte do SaaS adicionar."
  - Botão "Copiar meu Facebook ID" (extraído do callback, se houver) e link para `https://findmyfbid.com`.

**5. Documento interno: passos de App Review**
- Criar `docs/meta-app-review.md` com checklist do que a Meta exige:
  - Vídeo de demonstração de cada permissão (`pages_manage_posts`, `instagram_content_publish` etc.)
  - URL da política de privacidade do SaaS
  - Termos de uso
  - Conta de teste para o revisor da Meta
  - Justificativa de uso de cada escopo

**6. Painel super-admin: lista de conexões OAuth por empresa**
- Em `/admin` (rota existente), nova aba **"Integrações Meta"** mostrando: empresa, contas conectadas, data de expiração do token, última publicação. Permite ao super-admin do SaaS ver quem está usando.
- Apenas role `super_admin` enxerga.

**7. Cron de renovação preventiva de tokens (`meta-refresh-tokens`)**
- Edge function nova rodando 1x/dia que pega contas com `token_expires_at` < 7 dias e chama `/oauth/access_token?grant_type=fb_exchange_token` para renovar mais 60 dias.
- Atualiza `access_token` e `token_expires_at`.
- Se renovação falhar (usuário revogou), marca conta como `ativo=false` e cria notificação para o admin daquela empresa reconectar.

### Detalhes técnicos
- **Nova tabela**: `oauth_states (nonce uuid pk, user_id uuid, empresa_id uuid, expires_at timestamptz, used_at timestamptz)` com TTL e RLS service-role only.
- **Arquivos novos**:
  - `supabase/functions/meta-refresh-tokens/index.ts`
  - `src/components/admin/MetaIntegrationsPanel.tsx`
  - `src/components/marketing/MetaAppStatusBanner.tsx`
  - `docs/meta-app-review.md`
- **Arquivos alterados**:
  - `supabase/functions/meta-oauth-start/index.ts` — gerar e gravar nonce
  - `supabase/functions/meta-oauth-callback/index.ts` — validar nonce, ts, empresa
  - `src/pages/marketing/RedesSociais.tsx` — banner de status + tratamento de erro de testador

### Critérios de aceite
- Cron `meta-publish-cron` (duplicado) removido; só `meta-publish-cron-job` ativo.
- OAuth com state expirado ou nonce reusado é rejeitado com erro claro.
- Banner em `/marketing/redes-sociais` mostra se o app Meta está em modo dev ou aprovado.
- Empresa não-testadora vê instruções claras de como pedir acesso em vez de erro genérico.
- Super-admin vê painel com todas as conexões OAuth por empresa.
- Tokens com vencimento <7 dias são renovados automaticamente; falhas geram notificação para reconectar.
- Documento `meta-app-review.md` com checklist pronto para submeter à Meta.

