## Nova rota: Gestão Operacional > Vendedores

Criar página única em `/operacional/vendedores` que centraliza visão gerencial dos vendedores cadastrados (funcionários com `is_vendedor = true`).

### 1. Roteamento e menu

- `src/pages/operacional/Vendedores.tsx` (nova página)
- Registrar em `src/routes/operacionalRoutes.ts`: `/operacional/vendedores`, roles `["admin", "gestor"]`
- Adicionar item em `src/components/layout/menuItems.ts` no grupo Operacional: ícone `Users` (ou `Briefcase`), label "Vendedores"

### 2. Layout da página (4 blocos verticais)

```text
┌────────────────────────────────────────────────────────────┐
│ Filtro de período (mês atual | anterior | custom)          │
├────────────────────────────────────────────────────────────┤
│ Bloco 1 — Dashboard (4 KPI cards)                          │
│  • Vendedores ativos   • Vendas no período (R$)            │
│  • Ticket médio        • Comissão total estimada (R$)      │
├────────────────────────────────────────────────────────────┤
│ Bloco 2 — Resumo por vendedor (TABELA)                     │
│  Vendedor | Vendas (qtd) | Total R$ | Ticket méd | Meta %  │
│  | Comissão R$ | Status (badge)                            │
│  → linha clicável abre Bloco 4 filtrado pelo vendedor      │
├────────────────────────────────────────────────────────────┤
│ Bloco 3 — Ranking + gráfico (sugestão extra)               │
│  • Top 5 vendedores em barras horizontais                  │
│  • Pódio visual (1º/2º/3º) com avatar e % de meta          │
├────────────────────────────────────────────────────────────┤
│ Bloco 4 — Histórico de vendas (TABELA paginada)            │
│  Data | Vendedor | Cliente | Tipo | Pagamento | Status | R$│
│  Filtros: vendedor, tipo (balcão/entrega), status          │
│  Export CSV                                                │
└────────────────────────────────────────────────────────────┘
```

### 3. Fonte de dados

- `funcionarios` onde `is_vendedor = true` (lista base)
- `vendedor_metas` (meta, tipo_comissao, percentual, valor_fixo_comissao)
- `pedidos` filtrados por `vendedor_id IN (user_ids dos vendedores)` e período
- Join com `clientes(nome)` para histórico

Cálculo de comissão por vendedor (mesma lógica do `VendedorMetas.tsx`):
- `percentual`: `SUM(valor_total) * percentual/100`
- `valor_fixo`: `COUNT(pedidos) * valor_fixo_comissao`

### 4. Componentes

- Tabelas usando shadcn `<Table>` (não cards) — atende pedido de "tabela para ficar melhor visivelmente"
- `usePeriodo()` para filtro de período (já existe no projeto)
- `Progress` para % de meta atingida
- `Badge` para status (ativo / abaixo da meta / bateu meta / acima)

### 5. Sugestões extras incluídas

1. **Ranking + pódio** — gamificação visual que motiva equipe
2. **Export CSV** do histórico — útil para fechar comissão no fim do mês
3. **Linha clicável** na tabela de resumo → filtra histórico automaticamente
4. **Badge de status da meta** (vermelho < 50%, amarelo 50–90%, verde ≥ 100%)
5. **Card "Vendedor do mês"** destacado no topo do ranking

### Fora do escopo
- Edição de meta/comissão (continua em Cadastros > Funcionários)
- Relatório consolidado de comissões para Financeiro (fica para depois)
- Comparativo entre meses / evolução histórica
