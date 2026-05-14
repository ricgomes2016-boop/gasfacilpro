## Problema

Em `ai_mensagens` há respostas como:
- "O nosso gás P13 (aquele botijão **azul padrão** de cozinha) está R$ 125,00…"
- "O nosso gás P13 (aquele botijão comum de casa) tá saindo por R$ 125,00…"

A cor/marca do botijão é uma **alucinação** do modelo. O prompt em `supabase/functions/_shared/bia-core.ts` (`buildSystemPrompt`) não proíbe descrever atributos visuais, e o catálogo enviado contém só `nome, preco, estoque, categoria` — sem cor.

Resultado: clientes podem receber descrição errada (a marca de botijão da Central Gás não é azul) e isso vira ruído de credibilidade.

## Correção (1 arquivo)

Em `supabase/functions/_shared/bia-core.ts`, dentro de `buildSystemPrompt` (no bloco "REGRAS DE OURO", logo após a regra de "PREÇO RÍGIDO"), adicionar uma nova regra crítica:

```text
4. NUNCA invente atributos físicos do produto: NÃO descreva cor do botijão
   (ex: "azul", "vermelho", "padrão"), NÃO cite marca (Ultragaz, Liquigás,
   Copagaz, Supergasbras, Nacional Gás, etc.), NÃO descreva o visual nem
   diga "padrão" / "comum" / "tradicional". Refira-se ao produto APENAS pelo
   nome cadastrado (ex: "Gás P13", "Gás P20", "Gás P45", "Água 20L"). Se o
   cliente perguntar a marca/cor, responda: "Trabalhamos com a marca
   disponível no momento — pode variar por entrega. O importante é que é
   gás original, lacrado e dentro da validade. 😊"
```

E reforçar uma linha curta no bloco "ANTI-REPETIÇÃO" (ou criar um mini-bloco "ANTI-INVENÇÃO") pedindo explicitamente para não adicionar parênteses descritivos do tipo "(aquele botijão …)".

## Por que assim

- Mudança apenas no prompt → zero impacto em rotas, RLS, edge functions, banco.
- Não muda comportamento de pedido, preço, fluxo, finalização.
- Resolve para qualquer empresa do tenant (não é específico da Central Gás).
- Não precisa de migration nem de mexer em `App.tsx`.

## Fora de escopo

- Não vou cadastrar marca/cor no produto — se no futuro a empresa quiser que a Bia diga a marca real, criamos um campo `marca` em `produtos` e injetamos no prompt. Hoje não existe.
- Não vou regenerar respostas antigas já enviadas no WhatsApp.
