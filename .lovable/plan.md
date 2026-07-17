## Objetivo
Consolidar o card **Resumo Financeiro** em `Pedidos` para exibir cada forma de pagamento **uma única vez** (ex.: "Dinheiro" aparece só uma vez, somando todas as contribuições), em vez de linhas separadas como "dinheiro", "dinheiro, pix", "dinheiro, pix_maquininha".

## Causa
Em `src/pages/vendas/Pedidos.tsx` (linhas 686–693), o agrupamento usa `p.forma_pagamento` como chave inteira. Como o campo é uma string que pode conter várias formas separadas por vírgula (ex.: `"dinheiro, pix"`), cada combinação vira uma linha diferente.

## Correção
Alterar apenas o `useMemo` `pagamentoContadores` para:

1. Fazer o split por vírgula (mesmo padrão já usado na geração de recibo em `Pedidos.tsx:562-571`).
2. Dividir o valor do pedido igualmente entre as formas (`valor / formas.length`), mantendo consistência com o recibo e preservando o total.
3. Normalizar a chave (trim + lowercase) para agrupar variações.
4. Usar `formaLabel(...)` (helper já existente no arquivo) para exibir o rótulo bonito ("Dinheiro", "PIX", "PIX Maquininha", "Cartão Débito", etc.).

Resultado esperado no card:
- Dinheiro — soma de todas as parcelas de dinheiro
- PIX — soma de todas as parcelas de PIX
- PIX Maquininha — idem
- Cartão Débito, Vale Gás, Gás do Povo — idem
- Total Geral inalterado

## Escopo
- Arquivo único: `src/pages/vendas/Pedidos.tsx` (bloco `pagamentoContadores`, ~8 linhas).
- Sem alterações em queries, RLS, tipos ou lógica de negócio.
- Sem impacto em recibo, PDF ou export.
