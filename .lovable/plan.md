## Objetivo

Substituir a aba **Top Clientes** (em `/vendas/relatorio`) por uma nova aba **Produtos Vendidos**, replicando o relatório clássico do ERP legado (imagens enviadas): filtros avançados + tabela detalhada com custo, venda, lucro e % lucratividade, com agrupamento por Mês ou Dia.

> Top Clientes continua existindo em outra rota, então a remoção da aba não causa perda funcional.

## Layout da Tela

```
┌─ Card "Produtos Vendidos" ─────────────────────────────┐
│ [Filtros expansíveis]                                  │
│  Período: [de] [até]   Hora: [de] [até]               │
│  Cliente▼  Fornecedor▼  Vendedor▼  Entregador▼        │
│  UF▼  Cidade▼  Bairro▼                                 │
│  Marca▼  Grupo▼  SubGrupo▼  Depósito▼                  │
│  Produto▼  Tabela de Preço▼  Convênio▼                 │
│  Agrupar por: ( )Mês ( )Dia ( )Nenhum                  │
│  [✓] Totalizar produtos  [✓] Deduzir devoluções        │
│  [ ] Separar por Mês/Ano [ ] Separar por Dia           │
│  [Exibir]  [Exibir Produtos]  [Exportar XLSX] [PDF]    │
├────────────────────────────────────────────────────────┤
│ Resumo: Qtde total | Custo | Venda | Lucro | %         │
├────────────────────────────────────────────────────────┤
│ Tabela agrupada:                                       │
│  ▸ 01/2026                                             │
│      Produto | Qtde | P.Custo | T.Custo | V.Unit |    │
│              T.Venda | % Lucr. | T.Lucro              │
│      ...                                               │
│      Total Mês: ...........................            │
│  ▸ 02/2026 ...                                         │
│  Total Geral: .........................                │
└────────────────────────────────────────────────────────┘
```

Visual moderno seguindo padrão atual (`venda-card` + `VendaSectionHeader` tom `info`), colunas centralizadas com zebra (igual ao Comparativo Mensal), totais com fundo destacado.

## Escopo Técnico

**Arquivo novo:** `src/pages/vendas/ProdutosVendidosTab.tsx`
- Componente isolado que recebe `pedidos`/`itens` já carregados pelo `RelatorioVendas` ou faz própria query a `pedidos_itens` + joins (produto, cliente, entregador, vendedor) com filtro por `unidade_id`/período.
- Reaproveita `produtos.preco_custo` p/ P.Custo (fallback 0 quando ausente).
- Agrupamento por mês via `format(data, "MM/yyyy")` ou por dia.
- Cálculos: `T.Custo = qtd * p_custo`, `T.Venda = qtd * v_unit`, `%Lucr = (venda-custo)/venda*100`, `T.Lucro = venda - custo`.
- Filtros como dropdowns populados a partir dos dados (cliente, entregador, marca, grupo etc. — só os que já existem em produto/pedido; campos sem dado ficam desabilitados com tooltip).
- Toggle "Deduzir devoluções" subtrai itens de `devolucoes` no período.
- Exportação XLSX com mesma estrutura visual (cabeçalho do grupo + total mês + total geral).

**Arquivo alterado:** `src/pages/vendas/RelatorioVendas.tsx`
- Trocar `TabsTrigger value="clientes"` (linha 802) por `value="produtos-vendidos"` com ícone `PackageSearch` e label "Produtos Vendidos" / "Vendidos".
- Trocar `TabsContent value="clientes"` (linhas 1382-1422) por `<TabsContent value="produtos-vendidos"><ProdutosVendidosTab .../></TabsContent>`.
- Remover bloco da aba Top Clientes da exportação XLSX consolidada (linhas 535-542).

**Sem alterações em backend** (RLS e tabelas existentes já cobrem). Sem migrations.

## O que NÃO será feito

- Não mexer em `App.tsx`, rotas, providers.
- Não criar nova rota (fica dentro da tela `/vendas/relatorio`).
- Não alterar lógica das demais abas.
