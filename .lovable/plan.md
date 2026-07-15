## Objetivo

Padronizar todas as 8 páginas do menu **Gestão de Estoque** no visual "premium" do Dashboard principal (já aplicado no Estoque do dia): `Header` no topo, action bar limpa, KPIs neutros com badge tintado, filtros compactos, cards de conteúdo neutros e tabelas com header em `text-xs uppercase text-muted-foreground` — usando exclusivamente tokens semânticos (`bg-card`, `bg-primary/10`, `text-muted-foreground`, `border`).

Sem mudanças em queries, mutations, RLS, `unidade_id`/`empresa_id`, edge functions ou lógica de estoque. Somente reestruturação visual + extração de subcomponentes.

## Escopo

| # | Página | Arquivo | O que padronizar |
|---|--------|---------|------------------|
| 1 | Estoque do dia | `src/pages/Estoque.tsx` | Já refeito — apenas polir (ícones dos KPIs, badges de tipo, estados vazios) |
| 2 | Dashboard Estoque | `src/pages/estoque/DashboardEstoque.tsx` | Header + KPIs neutros, gráficos em cards limpos com toggle de visão, cores via tokens (remover paleta hex fixa) |
| 3 | Compras | `src/pages/estoque/Compras.tsx` | Header + action bar (Nova compra / Outlook / relatório), KPIs (total mês, pago, pendente, fornecedores), filtros compactos, tabela padrão |
| 4 | Comodatos | `src/pages/estoque/Comodatos.tsx` | Header + KPIs (ativos, vencidos, próximos, valor caução), filtro busca+status inline, tabela padrão, badges semânticos |
| 5 | MCMM | `src/pages/estoque/MCMM.tsx` | Header + KPIs (críticos, alerta, ok, excesso), gráfico em card neutro, tabela com badges de status |
| 6 | Histórico Movimentações | `src/pages/estoque/HistoricoMovimentacoes.tsx` | Header + KPIs (entradas, saídas, ajustes, total), filtros (período + tipo + busca) na mesma linha, tabela padrão |
| 7 | Transferência Estoque | `src/pages/estoque/TransferenciaEstoque.tsx` | Header + action bar (Nova transferência), KPIs (pendentes, em trânsito, recebidas mês, valor), tabela + dialog mantendo lógica atual |
| 8 | Lotes/Rastreabilidade | `src/pages/estoque/LotesRastreabilidade.tsx` | Header + KPIs (lotes ativos, próximos vencer, vencidos, rastreios mês), tabs em card neutro, tabela padrão |

## Padrão visual (aplicado em todas)

**Header/action bar**
```tsx
<Header title="..." subtitle="..." />
<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
  <div>
    <h2 className="text-lg font-semibold">Título da seção</h2>
    <p className="text-xs text-muted-foreground">Descrição curta</p>
  </div>
  <div className="flex gap-2">{/* ações principais */}</div>
</div>
```

**KPI card**
```tsx
<Card className="bg-card">
  <CardContent className="p-4 flex items-center gap-3">
    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">Label</p>
      <p className="text-2xl font-bold">{valor}</p>
    </div>
  </CardContent>
</Card>
```
Tons por semântica: `primary` (neutro/principal), `info` (informativo/azul), `success` (verde/ok), `warning` (amarelo/alerta), `destructive` (crítico). Grid `grid-cols-2 md:grid-cols-4`.

**Filtros**: `flex-col sm:flex-row gap-2`, botões `variant="outline" size="sm"`, popovers com `p-3`.

**Cards de conteúdo**: `bg-card` com `CardHeader` (ícone + título + subtítulo) e `CardContent`. Sem gradientes fixos, sem `bg-primary` sólido no card.

**Tabelas**: `TableHeader` com `text-xs uppercase text-muted-foreground`, linhas com `hover:bg-muted/50`, badges de status com variantes semânticas.

**Estados**: vazio (`text-center py-12 text-muted-foreground` + ícone `opacity-40`), loading (Skeleton no lugar dos cards/linhas).

## Reorganização de componentes

Criar utilitários compartilhados em `src/components/estoque/`:
- `EstoqueKpiCard.tsx` — card KPI reutilizado nas 8 páginas (props: icon, label, value, tone).
- `EstoquePageHeader.tsx` — bloco título + subtítulo + slot de ações da seção.
- `EstoqueEmptyState.tsx` — estado vazio padrão (icon, title, description, action opcional).

Nenhum dialog, mutation, cálculo ou fluxo existente é alterado — apenas o JSX de apresentação usa esses helpers.

## Fora de escopo

- Lógica de negócio, queries, RLS, edge functions, `unidade_id`/`empresa_id`, mutations.
- Rotas, menu lateral, permissões, `MainLayout`.
- Componentes internos já em uso nos dialogs (`ComprasListaTableEstoque`, `OutlookImportButton`, `ConfirmarNovosProdutosDialog` etc.).

## Ordem de execução

1. Criar `EstoqueKpiCard`, `EstoquePageHeader`, `EstoqueEmptyState`.
2. Refatorar em ordem: Dashboard Estoque → Compras → Comodatos → MCMM → Histórico → Transferência → Lotes → polir Estoque do dia.
3. Rodar typecheck ao final.

## Verificação

- Typecheck `tsgo` sem erros.
- Abrir cada rota via Playwright headless (`/estoque`, `/estoque/dashboard`, `/estoque/compras`, `/estoque/comodatos`, `/estoque/mcmm`, `/estoque/historico`, `/estoque/transferencia`, `/estoque/lotes`) e conferir screenshot do header + KPIs + tabela.
