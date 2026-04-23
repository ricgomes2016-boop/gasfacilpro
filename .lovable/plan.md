

## Badge "Conectado via OAuth" + Publicação Automática

### Estado atual
- `RedesSociais.tsx` já mostra um badge `🔗 OAuth` / `Manual`, mas pequeno (text-[10px]) e sem destaque visual.
- Edge function `meta-publish-cron` existe e está pronta para processar agendamentos vencidos de contas OAuth, **mas nunca é disparada** — falta registrar o `pg_cron` que chama a função a cada 5 minutos.
- `meta-publish-post` já publica corretamente em IG Business e Facebook Page usando o token salvo.

### O que será entregue

**1. Badge "Conectado via OAuth" mais visível (`src/pages/marketing/RedesSociais.tsx`)**
- Substituir o badge atual por um destacado verde com ícone de check (`CheckCircle2` do lucide), texto "Conectado via OAuth" e tooltip explicando "Publicação automática habilitada".
- Contas manuais ganham badge cinza "Cadastro manual" com tooltip "Apenas lembrete, não publica automaticamente".
- Quando OAuth, exibir também a data da última renovação de token (`token_expires_at`) em pequeno abaixo do nome.

**2. Agendamento da publicação automática (nova migration SQL)**
- Garantir extensões `pg_cron` e `pg_net` ativas.
- Registrar job `meta-publish-cron-job` rodando `*/5 * * * *` que faz `net.http_post` para `https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/meta-publish-cron` com header `Authorization: Bearer <ANON_KEY>`.
- Como o conteúdo do SQL contém URL e chave específicas do projeto, será aplicado via tool de insert SQL (não migration), conforme instrução de `schedule-jobs-supabase-edge-functions`.

**3. Selo "Publicação automática" no agendador (`src/pages/marketing/AgendamentoPosts.tsx`)**
- Quando o usuário seleciona uma `social_account` no formulário de agendar post, mostrar abaixo do select um chip verde "✓ Será publicado automaticamente" se `conectado_via === 'oauth'`, ou um chip âmbar "⚠ Apenas lembrete — publique manualmente" se `manual`.
- Ajuda o usuário a entender por que alguns posts publicam sozinhos e outros não.

**4. Coluna de status na lista de agendamentos**
- Já existe coluna `status` em `marketing_agendamentos` (`agendado | publicado | erro`). Garantir que a UI da lista mostre badge colorido por status e, quando `erro`, exibir tooltip com `erro_mensagem`.

### Detalhes técnicos
- **Arquivo alterado**: `src/pages/marketing/RedesSociais.tsx` — substituir bloco de badges (linhas 175–182) e adicionar Tooltip.
- **Arquivo alterado**: `src/pages/marketing/AgendamentoPosts.tsx` — adicionar chip informativo abaixo do select de conta.
- **SQL via insert tool** (conteúdo com chave/URL específicos):
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
  SELECT cron.schedule(
    'meta-publish-cron-job',
    '*/5 * * * *',
    $$ SELECT net.http_post(
        url:='https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/meta-publish-cron',
        headers:='{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
        body:='{}'::jsonb
    ); $$
  );
  ```
- **Sem novas dependências, sem mudança de schema, sem novo secret.**

### Critérios de aceite
- Conta OAuth aparece com badge verde "Conectado via OAuth" + ícone de check; conta manual aparece com badge cinza "Cadastro manual".
- Job `meta-publish-cron-job` listado em `cron.job` rodando a cada 5 min.
- Post agendado para conta OAuth com `data_agendada` no passado é publicado automaticamente em até 5 min e seu status muda para `publicado` com `external_post_id` preenchido.
- Erros de publicação salvam `status='erro'` e `erro_mensagem`, e a lista exibe tooltip com a causa.
- No formulário de agendamento, ao escolher a conta, o usuário vê imediatamente se aquele post irá publicar sozinho ou ficará só como lembrete.

