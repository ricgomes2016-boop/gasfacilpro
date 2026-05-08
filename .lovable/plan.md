## Objetivo

Hoje, quando o cliente liga/escreve para cancelar um pedido, a Bia responde "ligue para a empresa". Vamos ensinar a Bia a:

1. **Tentar reter o cliente** com uma abordagem amigável (entender o motivo, oferecer agilizar entrega, oferecer um pequeno desconto, reagendar).
2. Se o cliente **insistir**, executar o **cancelamento direto no sistema** via uma nova tag de comando, sem pedir para ligar para a empresa.

## Mudanças

### 1. Prompt da Bia (`supabase/functions/_shared/bia-core.ts` → `buildSystemPrompt`)

Adicionar um novo bloco de regras "CANCELAMENTO DE PEDIDO":

- Detectar intenção de cancelar ("quero cancelar", "desistir", "não quero mais", "cancela meu pedido").
- Buscar o pedido ativo do cliente (já temos `orderStatus` no contexto). Se não houver pedido ativo, responder educadamente que não há pedido em andamento.
- Se houver pedido ativo:
  - **1ª tentativa de retenção**: perguntar o motivo de forma empática ("Posso te ajudar? O que aconteceu?").
  - **2ª tentativa**: oferecer solução conforme o motivo (demora → "consigo agilizar com o entregador"; preço → oferecer desconto dentro das regras de negociação já existentes; horário → reagendar).
  - **3ª resposta (cliente insiste)**: confirmar uma última vez ("Tem certeza que deseja cancelar o pedido #XXXX no valor de R$ Y?").
  - **Confirmação final**: gerar a tag `[CANCELAR_PEDIDO]pedido_id: <id>\nmotivo: <texto curto>[/CANCELAR_PEDIDO]` e responder ao cliente que o pedido foi cancelado.
- Regra de ouro: **nunca** mais dizer "ligue para a empresa" para cancelar — a Bia resolve.

Para isso, `getOrderStatus` precisa devolver o **id completo** do pedido (hoje devolve `id.slice(0,8)`). Vamos manter o curto para exibir e adicionar `idFull` para uso interno na tag.

### 2. Processamento da tag em todos os webhooks da Bia

Onde já existe o tratamento de `[PEDIDO_CONFIRMADO]` (gateway-webhook, e demais webhooks da Bia que usam `bia-core`), adicionar tratamento equivalente para `[CANCELAR_PEDIDO]`:

- Extrair `pedido_id` e `motivo`.
- Validar que o pedido pertence ao `cliente.id` e que o status atual permite cancelamento (`pendente`, `em_preparo`, `agendado`; bloquear se já estiver `saiu_entrega` ou `entregue` — nesse caso a Bia avisa que o pedido já está a caminho/entregue e oferece falar com a equipe).
- Atualizar `pedidos`: `status = 'cancelado'`, gravar `motivo_cancelamento` (em `observacoes` se a coluna não existir) e `cancelado_em = now()`.
- Remover a tag da resposta antes de enviar ao cliente.
- Registrar no `registerCall`/log para o painel saber que houve cancelamento via Bia.

Centralizar a lógica em uma função nova em `bia-core.ts`: `cancelOrder(supabase, pedidoId, clienteId, motivo)` para reaproveitar entre webhooks (gateway, vapi, twilio, elevenlabs).

### 3. Aplicar nos webhooks existentes

- `supabase/functions/gateway-webhook/index.ts`
- `supabase/functions/vapi-webhook/index.ts` (adicionar tool `cancelar_pedido` análoga a `criar_pedido`, chamando `cancelOrder`)
- Demais webhooks da Bia que importam `bia-core` (twilio/elevenlabs já existentes) — apenas plugar o mesmo bloco de tratamento da tag.

### 4. Sem mudanças de schema obrigatórias

Se a tabela `pedidos` não tiver `cancelado_em`/`motivo_cancelamento`, gravamos o motivo concatenado em `observacoes` para evitar migração agora. (Posso fazer a migração depois se você preferir colunas dedicadas.)

## Resultado esperado

- Cliente liga, pede cancelamento → Bia tenta entender e reter.
- Cliente insiste → Bia confirma e cancela o pedido no sistema, sem mandar ligar para a empresa.
- Pedido aparece como `cancelado` no painel, com motivo registrado.

Posso prosseguir com a implementação?
