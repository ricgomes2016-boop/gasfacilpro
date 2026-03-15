

# Correção: Loop da Bia + Regra de Água exclusiva para Central Gás

## Problemas Identificados

### 1. Regra de água na portaria é GLOBAL — deveria ser só Central Gás
O bloco `REGRAS DE DOMINGO` no system prompt (linha 421-425) é injetado para **todas** as empresas quando `isSunday === true`. A regra de "água apenas na portaria" é específica da Central Gás, mas afeta Vila Sete Gas, Forte Gás, etc.

### 2. Loop de conversação
A Bia pode entrar em loop quando:
- O cliente responde "ok" ou "sim" a uma informação (ex: aviso sobre água na portaria), e a Bia interpreta como confirmação de pedido, mas faltam dados → pergunta de novo → loop
- O `isPostOrderFollowUp` (linha 510-522) captura "sim/ok" como follow-up de pedido existente E ao mesmo tempo a IA tenta avançar o fluxo — conflito
- O prompt não tem instrução explícita de **parar** após dar um aviso informativo (como o da água na portaria)

### 3. A Bia avisa sobre portaria mas continua tentando processar o pedido de água
Falta uma instrução clara: após informar a restrição de domingo, **encerrar** o assunto água sem gerar `[PEDIDO_CONFIRMADO]`.

## Plano de Correção

### Arquivo: `supabase/functions/_shared/bia-core.ts`

**A. Tornar a regra de domingo condicional por empresa**
- Na função `checkBusinessHours`, buscar também `empresa_id` da unidade
- Retornar `empresaId` no resultado
- Nos webhooks, passar o `empresaId` para `buildSystemPrompt`
- No prompt, aplicar regra de "água na portaria" SOMENTE se `empresaId === 'f27e158e-7ab5-4617-9f66-c6b4a084d293'` (Central Gás)
- Para outras empresas, manter o horário de domingo mas SEM restrição de água

**B. Anti-loop no prompt**
Adicionar instruções explícitas ao system prompt:
- "Se você informou uma restrição (ex: sem entrega de água), NÃO repita a mesma informação se o cliente responder 'ok/entendi/tá bom'. Apenas confirme brevemente e pergunte se precisa de algo mais."
- "NUNCA faça mais de 2 perguntas seguidas sem dados novos do cliente. Se o cliente já respondeu, avance."
- "Se informou que não entrega água, NÃO tente gerar [PEDIDO_CONFIRMADO] para água."

**C. Ajustar `isPostOrderFollowUp`**
- Tornar mais restritivo: não capturar "sim" isolado como follow-up (pode ser confirmação de dados do pedido em andamento)
- Exigir que a mensagem seja SOMENTE uma palavra de follow-up (sem contexto adicional)

### Webhooks afetados
Todos os 5 webhooks + ai-assistant precisam passar o `empresaId` para `buildSystemPrompt`. A mudança é simples pois o `checkBusinessHours` já retorna os dados — basta expandir o retorno.

