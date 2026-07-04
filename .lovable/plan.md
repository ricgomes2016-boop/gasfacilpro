## Problema

Em `Acerto do Entregador` (e outras telas), a forma de pagamento aparece como o **slug técnico** (ex.: `custom_avista_vale_gas_central_gas`) porque as formas customizadas não estão no dicionário fixo `paymentLabels`. Precisamos exibir o **nome amigável** cadastrado em "Formas de pagamento customizadas" (ex.: `Vale Gás Central Gás`).

## Solução

### 1) Helper central de exibição (novo)

Adicionar em `src/lib/financeiro/formaPagamento.ts`:

- `formatFormaPagamentoLabel(slug, customs?)` — resolve rótulo a partir de:
  1. Dicionário built-in (`Dinheiro`, `PIX`, `Cartão Crédito`, etc.).
  2. Lista de customizadas (`FormaPagamentoCustom[]`) — casa por `slug` e retorna `nome` (com ícone opcional).
  3. Fallback: se for `custom_avista_*` / `custom_aprazo_*`, remove o prefixo, troca `_` por espaço e capitaliza (ex.: `Vale Gas Central Gas`) — evita mostrar o slug cru mesmo sem a lista carregada.
  4. Caso contrário, devolve o próprio valor.

### 2) Hook de conveniência

`useFormaPagamentoLabel()` em `src/hooks/useFormasPagamentoCustom.ts`:
- Usa `useFormasPagamentoCustom({ onlyActive: false })` (para exibir também inativas em históricos).
- Retorna `(slug) => label` memoizado.

### 3) Aplicar na tela de Acerto Diário

`src/pages/caixa/AcertoEntregador.tsx`:
- Consumir `useFormaPagamentoLabel()`.
- Substituir os 4 pontos que hoje usam `paymentLabels[...] || ...` pelo helper:
  - Linha ~834 (agrupamento por forma)
  - Linha ~866 (export/print)
  - Linha ~1121 (badge modal do entregador)
  - Linha ~1261 (badge lista por forma)
  - Linha ~1432 (badge coluna da tabela)
- Manter `paymentLabels` como base do helper (não remover).
- Para os badges mais estreitos (mobile 384px), usar `truncate max-w-[140px]` com `title={label}` para não estourar o layout quando o nome customizado for longo.

### 4) Auditoria de outras telas que exibem `forma_pagamento`

Aplicar o mesmo helper (sem mudar lógica de negócio) onde o slug aparece cru na UI:
- `src/pages/vendas/PedidosKanban.tsx`
- `src/pages/vendas/Pedidos.tsx`
- `src/pages/vendas/RelatorioVendas.tsx`
- `src/pages/vendedor/VendedorHistorico.tsx`
- `src/components/entregador/EntregaCard.tsx`
- `src/components/clientes/HistoricoComprasDialog.tsx`
- `src/components/vendas/CustomerHistory.tsx`
- `src/components/alerts/PedidoPendenteModal.tsx`
- `src/components/financeiro/RecebiveisPipeline.tsx`
- `src/lib/comprovanteEntregaPdf.ts` (usa versão pura do helper, sem hook, recebendo lista de customs por parâmetro)

Escopo: apenas **exibição** (labels/badges/PDF). Nada de mudar `forma_pagamento` salvo no banco, roteamento financeiro ou regras de A Vista/A Prazo.

## Critério de aceite

- Em Acerto Diário, badges mostram `Vale Gás Central Gás` em vez de `custom_avista_vale_gas_central_gas`.
- Nenhum slug `custom_*` aparece cru em nenhuma das telas listadas.
- Layout mobile 384px não quebra quando o nome customizado for longo (truncamento com tooltip).
- Nenhuma alteração em queries, filtros por `forma_pagamento`, roteamento de conta bancária ou cálculo de acerto.
