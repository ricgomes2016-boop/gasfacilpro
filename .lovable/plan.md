# Novos relatórios em Vendas → Relatório

Adicionar novas abas ao lado das existentes (Ped. / Por Entregador / Entregador x Canal / Por Canal) em `src/pages/vendas/RelatorioVendas.tsx`, reaproveitando os mesmos filtros (período, status, canal) e os dados já carregados em `pedidos` (com `pedido_itens` + `produtos`).

## Nova aba principal: Produtos Vendidos

Agrupar todos os `pedido_itens` dos pedidos filtrados (excluindo cancelados) por nome do produto.

Para cada produto, mostrar:
- Quantidade total vendida (ex.: "Gás P13: 80", "Gás P20: 4", "Água 20L: 50")
- Nº de pedidos que continham o produto
- Faturamento (Σ quantidade × preço_unitario)
- Ticket médio por unidade
- % de participação no faturamento total

Layout:
- Gráfico de barras horizontal (top 10 por quantidade) à esquerda
- Tabela completa ordenável à direita, com linha de Total no rodapé
- Card resumo no topo: "Total de unidades vendidas" e "Mix de produtos" (qtd distinta)

Incluir esses dados também na exportação **Excel** (nova aba "Por Produto") e no **PDF** (nova seção "Vendas por Produto").

## Relatórios adicionais sugeridos (3 abas extras)

1. **Por Forma de Pagamento** — agrupa pedidos por `forma_pagamento` normalizado (Dinheiro, PIX, Crédito, Débito, Fiado, Vale Gás). Mostra qtd de pedidos, faturamento, ticket médio e gráfico de pizza com % de cada forma. Ajuda a conferir mix de recebimentos.

2. **Evolução Diária** — série temporal dia a dia dentro do período: linha/barra com faturamento por dia + qtd de pedidos por dia. Inclui melhor dia, pior dia e média diária no cabeçalho. Útil para identificar sazonalidade da semana.

3. **Top Clientes** — ranking por cliente (`clientes.nome`) com qtd de pedidos, faturamento, ticket médio e data da última compra no período. Limitado aos top 20 na tela, completo na exportação. Reaproveita lógica do CRM mas restrito ao período/filtros.

## Detalhes técnicos

- Adicionar 4 novos `useMemo` (`dadosPorProduto`, `dadosPorFormaPagamento`, `dadosPorDia`, `dadosTopClientes`) usando `pedidosFiltrados` — sem nova query ao Supabase.
- `dadosPorProduto`: itera `pedido_itens`, agrega por `produtos.nome` (fallback "Sem nome"); soma `quantidade` e `quantidade * preco_unitario`.
- `dadosPorFormaPagamento`: reutiliza a normalização `canonicalForma` já criada em AcertoEntregador (extrair para `src/lib/payment-utils.ts` para evitar duplicação) — sem alterar AcertoEntregador além do import.
- `dadosPorDia`: agrupa por `data_entrega || created_at` formatado em `yyyy-MM-dd`, preenche dias sem venda com 0.
- `dadosTopClientes`: agrupa por `clientes?.nome || "Não identificado"`.
- Atualizar `TabsList` para 7 abas usando `grid grid-cols-4 sm:grid-cols-7` ou scroll horizontal para caber no mobile (viewport 1069px do usuário já comporta tudo); manter labels curtos em telas pequenas (ex.: "Prod.", "Pgto.", "Dia", "Clientes").
- Reutilizar `BarChart`, `PieChart` e `LineChart` do Recharts já importados (`LineChart` precisa ser adicionado ao import).
- Atualizar `exportarExcel` e `exportarPDF` para incluir as novas seções.

## Fora do escopo

- Não mexer no schema, RLS, edge functions, nem alterar como pedidos/itens são persistidos.
- Não criar página/rota nova — tudo dentro de `RelatorioVendas.tsx`.
- Não tocar em AcertoEntregador além de (opcionalmente) importar `canonicalForma` do novo util compartilhado.
