## Modernizar cards do Relatório de Vendas (aba Produtos)

Aplicar o padrão visual já existente no projeto (`VendaSectionHeader` + tons coloridos por tema) e alinhar a tabela do Comparativo Mensal.

### 1. Headers coloridos (padrão do tema)

Substituir `CardHeader` + `CardTitle` "soltos" pelo componente `VendaSectionHeader`, que já aplica o fundo colorido em sintonia com o tema (gasfacil, saas, pastel-dashboard, executivo etc.).

Cards a atualizar em `src/pages/vendas/RelatorioVendas.tsx`:

| Card | Tone | Ícone |
|---|---|---|
| Filtros (topo) | `muted` | `Filter` |
| Top 10 — Quantidade | `info` | `Package` |
| Detalhamento por Produto | `primary` | `FileSpreadsheet` |
| Comparativo Mensal por Produto | `success` | `CalendarDays` |

Cada um vira:
```tsx
<Card className="venda-card">
  <VendaSectionHeader tone="info" icon={<Package className="h-5 w-5" />} title="Top 10 — Quantidade" action={...} />
  <CardContent>...</CardContent>
</Card>
```

O `action` recebe os seletores (Ano / Métrica) no card do Comparativo e os selects de Status/Canal no card de Filtros, mantendo a lógica intacta.

### 2. Alinhamento da tabela Comparativo Mensal

Problemas atuais: cabeçalho `text-right` mas as células do corpo usam um botão flex que não alinha com a borda direita; coluna "Produto" sem largura mínima; números com fontes proporcionais ficam tortos.

Ajustes:

- `Table` com `min-w-[640px] tabular-nums`.
- Primeira coluna (Produto): `sticky left-0 bg-card z-10 min-w-[180px] max-w-[220px] truncate`, para não comprimir nos meses.
- Cabeçalhos de mês: `text-right tabular-nums w-[88px]`.
- Células do corpo: `text-right p-2 tabular-nums` e o componente `CelulaMesEditavel` já produz conteúdo `justify-end` — garantir que o botão interno tenha `w-full justify-end` (ajustar largura mínima do botão para `min-w-[72px]` para não "dançar" entre números curtos/longos).
- Linha Total: mesma largura/`tabular-nums`, fundo levemente mais escuro (`bg-muted/60`), `font-bold`, primeira coluna também `sticky`.
- Coluna Média: separador visual (`border-l border-border/60`) para destacar do bloco de meses, `font-semibold text-primary`.

### 3. Pequenos polimentos

- Cards do topo (Unidades vendidas, Mix, Faturamento) ganham `venda-card` para herdar a borda colorida sutil já existente.
- Espaçamento: `space-y-4` entre as três seções (KPIs → grid 2 colunas → Comparativo) — já existe `mt-4` no comparativo, manter.
- Não mexer em: lógica de filtros, queries, `dadosComparativoMensal`, `salvarVendaManual`, `CelulaMesEditavel` (apenas ajuste de largura mínima do botão se necessário).

### Arquivos

- `src/pages/vendas/RelatorioVendas.tsx` — refatorar 4 cards e a tabela.
- `src/pages/vendas/CelulaMesEditavel.tsx` — ajuste leve (`w-full justify-end min-w-[72px]`) para o alinhamento à direita ficar firme.

### Fora de escopo

- Não alterar as abas Entregadores / Canais / Pagamento nesta rodada (o pedido foi específico para Filtros, Top 10, Detalhamento Produtos e Comparativo Mensal). Se quiser, aplico o mesmo padrão depois.
