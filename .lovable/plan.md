## Diagnóstico
Conversa `3ccf7e98...` (cliente Ana, 4396343193, unidade Central Gás), às 21:37 UTC (18:37 BRT):
- Cliente passou endereço completo, escolheu PIX.
- Bia respondeu: *"Combinado! Seu pedido foi confirmado e já vou passar para a entrega."*
- **Mas o modelo NÃO emitiu o bloco `[PEDIDO_CONFIRMADO]…[/PEDIDO_CONFIRMADO]`** que o webhook procura para chamar `createOrder`.
- Sem o bloco, nada foi inserido em `pedidos` — daí o sistema "não fez nada".

Isso é falha de compliance do LLM (acontece de vez em quando com `gemini-flash-latest`). Precisa de uma rede de segurança determinística.

## Solução

### 1) Detectar confirmação sem tag (no webhook)
Em `supabase/functions/zapi-webhook/index.ts`, após o `match` da tag, se **NÃO** houver `[PEDIDO_CONFIRMADO]` mas o `rawReply` contiver uma frase de confirmação (regex case-insensitive):
- `combinado`, `pedido foi confirmado`, `pedido confirmado`, `passar para (a )?entrega`, `passar para o entregador`, `vou (passar|enviar)` + (`entrega|entregador`)

→ disparar uma 2ª chamada ao LLM apenas para extrair o bloco estruturado.

### 2) Re-chamada estrita
Nova função `requestOrderBlock(config, history, messageText)` em `_shared/bia-core.ts`:
- Mesma chave/modelo do `generateContent`.
- Prompt curto e rígido: "Você é um extrator. Com base no histórico abaixo, retorne APENAS o bloco `[PEDIDO_CONFIRMADO]…[/PEDIDO_CONFIRMADO]` com os campos `nome, produto, quantidade, endereco, pagamento, valor, telefone`. Não escreva mais nada."
- Inclui as últimas N mensagens (system + history + última do usuário).
- Resposta passa pelo mesmo `match` e por `parseOrderData`.

### 3) Criar pedido com o bloco recuperado
Se `parseOrderData` retornar dados válidos:
- Roda a mesma deduplicação de 2 min.
- Chama `createOrder(...)` igual ao caminho normal.
- Loga: `[order-recovery] criado via fallback pedido=<id>`.

Se a 2ª chamada falhar ou não devolver bloco válido:
- Apenas loga `[order-recovery] falhou`, mantém comportamento atual (cliente já recebeu o "Combinado!", mas pedido segue sem registrar — pelo menos visível no log).

### 4) Reforçar prompt (preventivo)
No `buildSystemPrompt` (linha ~1034), trocar:
```
DADOS TÉCNICOS (SÓ GERE APÓS O PASSO 5):
```
por:
```
DADOS TÉCNICOS — OBRIGATÓRIO no Passo 5:
Sempre que você responder confirmando o pedido (qualquer frase como "Combinado", "pedido confirmado", "vou passar para entrega"), você DEVE incluir IMEDIATAMENTE APÓS sua resposta o bloco abaixo, EXATAMENTE neste formato. Sem o bloco, o pedido NÃO é registrado no sistema. Esta regra é absoluta.
```

### 5) Não altera
- Schema, RLS, UI, cron de atraso, notificação ao gestor.
- Apenas `_shared/bia-core.ts` (novo helper + reforço de prompt) e `zapi-webhook/index.ts` (fallback de detecção/re-chamada).

## Limitação aceita
A 2ª chamada acrescenta ~1s de latência apenas quando a tag for omitida. No caminho feliz (tag presente), nada muda.
