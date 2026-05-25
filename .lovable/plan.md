## Diagnóstico definitivo

A BIA respondeu R$ 125,00 e negou desconto, mas o pedido foi registrado a R$ 120,00. Existem **duas fontes de preço** desencontradas no fluxo:

1. **No chat com o cliente** (`buildSystemPrompt` → `productList`): a BIA cita o preço de `regras_bia.tabela_precos.gas_p13.preco` configurado (R$ 125,00).
2. **Na criação do pedido** (`createOrder`, `supabase/functions/_shared/bia-core.ts` linha 1291): o total é calculado como `produto.preco * qty - disc`, lendo `produtos.preco` da tabela (que está em R$ 120,00).

O campo `valor:` da tag `[PEDIDO_CONFIRMADO]` — onde a BIA é instruída a colocar "O valor EXATO que você informou ao cliente" — **nunca é lido**. Por isso o pedido sai com o preço do cadastro de produtos, ignorando a cotação do chat.

Quando o cliente pediu desconto, a BIA agiu corretamente (recusou). Mas no momento do insert, o sistema buscou `produtos.preco` (R$ 120) — o que acidentalmente "deu o desconto" que ela tinha negado.

## Correção

Tornar a cotação do chat a fonte autoritativa do preço do pedido.

### Arquivo: `supabase/functions/_shared/bia-core.ts`

**1. Em `createOrder` (linhas ~1288-1311):**

- Ler `orderData.valor` (string do tag) e converter para número (`parseFloat` com vírgula→ponto).
- Se `valorCotado > 0`:
  - `precoUnitario = valorCotado / qty` (cotação inclui qty).
  - `total = valorCotado - disc` (desconto adicional ainda subtrai, mas raramente vem aqui — `disc` quase sempre é 0 quando o valor já vem cotado).
- Se `valorCotado == 0` ou ausente (institucional/vale gás ou tag mal formada): manter fallback atual `produto.preco * qty - disc`.
- Garantir `total >= 0` com `Math.max(0, …)`.
- Usar `precoUnitario` (não `produto.preco`) no insert de `pedido_itens.preco_unitario`, para o DRE/relatórios baterem com o que o cliente pagou.
- Adicionar log claro: `console.log("[createOrder] preço fonte:", valorCotado > 0 ? "cotação BIA" : "produtos.preco", { valorCotado, produtoPreco: produto.preco, total })` para auditoria futura.

**2. Reforço no prompt (`buildSystemPrompt`, bloco `[PEDIDO_CONFIRMADO]` linha ~907-916):**

Trocar o comentário do campo `valor:` por uma instrução mais explícita e fechada:

```
valor: NÚMERO TOTAL DO PEDIDO (preço × quantidade, descontando o que você ofereceu).
       Use EXATAMENTE o valor que você falou ao cliente nesta conversa.
       NUNCA use 0 a não ser que seja institucional ou vale gás.
       Se houver dúvida, use o preço da tabela acima multiplicado pela quantidade.
```

Isso elimina ambiguidade e garante que o modelo sempre emite o número correto.

### Por que isso resolve definitivamente

- **Uma única fonte de verdade no momento de fechar**: o que o cliente leu na conversa = o que entra no `valor_total` do pedido = o que aparece em `pedido_itens.preco_unitario`.
- Atualizar o cadastro de `produtos` deixa de ser obrigatório para a BIA cobrar o valor certo (`tabela_precos` já é a referência usada pela BIA, e agora ela também alimenta o pedido).
- Negociações de desconto que a BIA faz (`extractLatestNegotiatedDiscountPerUnit`, fluxo de gerente) continuam funcionando — o `valor` que ela escreve na tag já considera o desconto que ela aceitou.
- Pedidos institucional/vale gás (valor: 0) continuam intactos pelo fallback.

## Fora de escopo

- Não vou unificar `tabela_precos` e `produtos.preco` no banco (isso exige migração e validação do usuário).
- Não vou mexer em layout, telas financeiras, estoque, ou envio manual do operador.
- Não vou alterar `webhook` handlers — só o núcleo compartilhado `bia-core.ts`.

## Deploy

Após editar, fazer deploy dos webhooks que usam `createOrder`: `evolution-webhook`, `gateway-webhook`, `meta-webhook`, `uazapi-webhook`, `zapi-webhook`.
