## Diagnóstico

Investiguei o código do Chat (`WhatsAppInbox.tsx`) e do contador de não lidas (`WhatsAppNotificationContext.tsx`) e confirmei no banco a causa do "badge 1 sem conversa":

1. **Filtros divergentes entre badge e lista**
   - `WhatsAppInbox` carrega conversas filtrando por `unidade_id = unidadeAtual.id` (e exige `telefone NOT NULL`).
   - `WhatsAppNotificationContext` (que alimenta o badge) busca **as 100 conversas mais recentes sem filtrar por empresa nem por unidade**.
   - Resultado: uma mensagem nova chega numa conversa de outra unidade (ou com `unidade_id NULL`, como várias conversas legadas que encontrei) → o badge soma `+1`, mas a conversa nunca aparece no inbox da unidade atual. É exatamente o que você viu ("badge 1, chat vazio").

2. **Conversas legadas sem `unidade_id`**
   Existem conversas reais (ex.: "Ricardo", "Valeria") com `unidade_id = NULL` e `empresa_id` preenchido. Hoje elas ficam invisíveis no inbox enquanto qualquer unidade estiver selecionada.

3. **Tempo real frágil quando o sistema está fechado**
   - O contexto só atualiza o badge enquanto a aba está aberta.
   - Quando a aba está fechada, dependemos do Web Push (já implementado para pedidos, mas **não para mensagens de chat**). Por isso "ontem o cliente mandou e você só viu hoje".

## O que vou ajustar (só frontend + 1 edge function de push)

### 1. Alinhar o escopo do badge ao do inbox
`src/contexts/WhatsAppNotificationContext.tsx`:
- Receber `empresa.id` (via `useEmpresa`) e `unidadeAtual.id` (via `useUnidade`).
- Carga inicial e contagem por conversa: filtrar `ai_conversas` por `empresa_id = empresa.id` e, quando houver unidade selecionada, `unidade_id = unidadeAtual.id OR unidade_id IS NULL` (inclui legado da mesma empresa).
- No listener Realtime de `ai_mensagens INSERT`: antes de incrementar, buscar a conversa e validar que ela bate com o mesmo escopo (empresa + unidade/legado). Conversas de outra empresa/unidade são ignoradas para o badge.

### 2. Mostrar conversas legadas no inbox
`src/components/atendimento/WhatsAppInbox.tsx` (`fetchConversas`):
- Filtro `unidade_id` passa a ser `eq(unidade_id, unidadeAtual.id) OR unidade_id IS NULL`, **sempre escopado por `empresa_id = empresa.id`** (via `.or()` no Postgrest e join lógico — uso `empresa_id` direto da tabela `ai_conversas`).
- Remover `.not("telefone", "is", null)` (ou trocar por filtro tolerante) para não esconder conversa que momentaneamente está sem telefone.
- O Realtime de `ai_conversas`/`ai_mensagens` já dispara `fetchConversas()`; só vou reaproveitar.

### 3. Selecionar automaticamente a conversa com não-lida quando o usuário abre o inbox
Quando o painel do chat for aberto (`isWidgetOpen` ou navegação para `/atendimento/caixa-de-entrada`) e houver exatamente 1 conversa com `unread > 0`, abrir essa conversa direto — evita o caso "badge diz 1 mas nada acontece".

### 4. Tempo real mesmo com sistema fechado (Web Push para chat)
Criar `supabase/functions/send-push-novo-chat/index.ts` (espelho do `send-push-novo-pedido` já existente):
- Dispara quando chega mensagem nova de cliente (`role NOT IN ('assistant','human')`).
- Reaproveita a mesma tabela `push_subscriptions`, mesmas VAPID keys, e o mesmo Service Worker (`src/sw.js` já trata `push` e `notificationclick`).
- Tag única `novo-chat-${conversa_id}` para não empilhar.
- Trigger SQL análogo ao de pedidos (`fn_dispatch_push_novo_pedido`) chamando esta function quando insere em `ai_mensagens`.

### 5. Pequena melhoria de UX
- Badge piscando suave quando `totalUnread > 0` (CSS-only) para reforçar visibilidade.
- Mostrar tooltip "X conversas não lidas" no botão flutuante.

## Arquivos afetados

```text
src/contexts/WhatsAppNotificationContext.tsx     editar (escopo empresa+unidade)
src/components/atendimento/WhatsAppInbox.tsx     editar (incluir unidade NULL, escopar empresa)
src/components/atendimento/WhatsAppFloatingChat.tsx  editar (tooltip + auto-abrir 1ª não lida)
supabase/functions/send-push-novo-chat/index.ts  criar (web push de chat)
supabase/config.toml                              editar (verify_jwt=false p/ nova function)
supabase/migrations/...sql                        criar (trigger AI mensagens → push)
```

## Não vou mexer

- App.tsx, providers, rotas — segue intocado (regra de estabilidade).
- Estrutura de `ai_conversas`/`ai_mensagens` — só adiciono trigger e function, sem alterar colunas/RLS.
- Lógica do `Bia`/webhooks — fora do escopo.

## Validação após implementar

1. Abrir Chat → o número do badge deve bater 1:1 com conversas visíveis.
2. Marcar uma conversa como lida → badge zera imediatamente.
3. Enviar uma mensagem de teste de outro WhatsApp → aparece em tempo real no inbox **e** notificação do navegador mesmo com aba fechada.
4. Verificar nos logs da edge function `send-push-novo-chat` que o envio foi 200.
