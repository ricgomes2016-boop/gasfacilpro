

# Fix: Bia Repetindo Saudação (Central Gas / Evolution)

## Diagnóstico Confirmado

Dados do banco confirmam o loop. A conversa da Janaina (43 9807-0028) mostra:
- 12:59:20 — User: "Bom dia" → Assistant: "Olá Janaina! 👋 Como posso ajudar?"
- 12:59:39 — User: "Quero uma gas" → Assistant: "Olá Janaina! 👋 Como posso ajudar?" (REPETIU)
- 12:59:56 — User: "Um gas" → Assistant: "Olá Janaina! 👋 Como posso ajudar?" (REPETIU)
- 13:00:13 — User: "Preciso de um gas" → Assistant: "Olá Janaina! 👋 Como posso ajudar?" (REPETIU)

O histórico está sendo carregado corretamente (mesmo conversation ID). O problema é que a IA repete a saudação porque:

**Causa raiz dupla:**
1. `extractCollectedData(history)` existe mas **nunca é chamada** dentro de `buildSystemPrompt` — o parâmetro `history` é recebido mas ignorado
2. O prompt não tem regra anti-repetição de saudação — diz "Passo 1: SAUDAÇÃO" e a IA segue literalmente toda vez

## Correção em `bia-core.ts`

### 1. Usar `extractCollectedData` dentro de `buildSystemPrompt`

Chamar `extractCollectedData(history)` e injetar a seção "DADOS JÁ INFORMADOS" no final do prompt, incluindo a lógica de "FINALIZE O PEDIDO IMEDIATAMENTE" se todos os dados estiverem presentes.

### 2. Adicionar regras anti-repetição no prompt

Adicionar ao system prompt:

```
ANTI-REPETIÇÃO (CRÍTICO):
- Se o histórico já contém sua saudação, NÃO cumprimente novamente. Vá direto ao assunto.
- Se o cliente já disse o que quer (gás, água, etc.), avance para o Passo 3 (endereço).
- NUNCA repita a mesma mensagem duas vezes consecutivas.
- Leia o histórico completo antes de responder — se já perguntou algo, NÃO repita.
```

### 3. Detectar etapa atual da conversa

Adicionar lógica para detectar em qual etapa a conversa está baseado no histórico:
- Se já saudou → pular passo 1
- Se cliente já pediu produto → pular passo 2, ir para passo 3
- Se endereço confirmado → pular passo 3, ir para passo 4
- Se pagamento informado → ir para passo 5

Injetar: `ETAPA ATUAL: Passo 3 (confirmar endereço). NÃO volte a passos anteriores.`

## Arquivo a alterar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/_shared/bia-core.ts` | Chamar `extractCollectedData` dentro de `buildSystemPrompt`, adicionar regras anti-repetição e detecção de etapa |

