## Nova sub-aba: Produtos × Mês (comparativo mensal)

Adicionar uma visualização extra dentro da aba **Produtos** em `src/pages/vendas/RelatorioVendas.tsx`, sem remover o conteúdo atual (Top 10 + tabela de totais do período já filtrado).

### Layout

Dentro da aba "Produtos", separar em duas seções via sub-tabs internas (ou cards empilhados):

1. **Resumo do período** (já existente: barra Top 10 + tabela total)
2. **Comparativo Mensal por Produto** (novo)

### Tabela comparativa

Colunas dinâmicas:

```text
| Produto       | Jan | Fev | Mar | Abr | ... | Média |
|---------------|-----|-----|-----|-----|-----|-------|
| Gás P13       |  50 |  60 |  55 |  48 |     |  53,2 |
| Gás P20       |   4 |   3 |   6 |   5 |     |   4,5 |
| Água 20L      |  50 |  45 |  60 |  55 |     |  52,5 |
| **Total**     | 104 | 108 | 121 | 108 |     | 110,2 |
```

Regras:
- **Linhas**: um produto por linha (ordenadas por total desc).
- **Colunas de mês**: uma para cada mês selecionado pelo usuário.
- **Última coluna "Média"**: soma das quantidades dos meses selecionados ÷ quantidade de meses selecionados (ex.: Jan a Abr = total ÷ 4). Não conta meses excluídos da seleção.
- **Linha de Total no rodapé**: soma por mês + média geral.
- Valores em **quantidade** (unidades vendidas). Adicionar toggle Quantidade / Faturamento (R$) para alternar a métrica exibida sem mudar a estrutura.

### Seletor de meses

Acima da tabela, um seletor multi-mês:

- Padrão: **Janeiro do ano atual até o mês atual** (ex.: hoje é maio/2026 → Jan, Fev, Mar, Abr, Mai/2026 marcados).
- Componente: lista de checkboxes com todos os meses do ano atual (Jan…Dez), mais a opção de **trocar o ano** (Select com os últimos 3 anos).
- Botões rápidos: "Ano todo", "Até hoje" (padrão), "Últimos 3 meses", "Limpar".
- Ao mudar a seleção, a tabela e a média recalculam.

Importante: este seletor é **independente** dos filtros globais de período da página (que continuam controlando as outras abas). A comparação mensal precisa de visão anual, não do range filtrado.

### Fonte de dados

- Reaproveitar `pedidos` já carregados se cobrirem o ano selecionado; senão, fazer uma query adicional ao Supabase para `pedidos` + `pedido_itens` + `produtos` no intervalo Jan/{ano} – Dez/{ano}, filtrando `status != 'cancelado'` e respeitando `unidade_id` / `empresa_id` (vide regra de RLS do projeto).
- Agrupar em memória: `Map<produtoNome, { [mesIndex: 0..11]: { qtd, faturamento } }>`.
- Mês de cada pedido = `data_entrega || created_at` → `getMonth()`.

### Exportações

- **Excel**: nova aba "Comparativo Mensal" com a mesma matriz produto × mês + média.
- **PDF**: nova seção após "Vendas por Produto" com a tabela comparativa (modo retrato pode estourar; usar landscape ou tabela compacta com até 12 colunas + média).

### Detalhes técnicos

- Novo `useMemo` `dadosComparativoMensal` recebendo `pedidosAno` (novo state) e `mesesSelecionados: number[]`.
- Novo state `anoComparativo: number` (default = ano atual) e `mesesSelecionados: number[]` (default = `[0..mesAtual]`).
- Novo `useEffect` que busca pedidos do ano selecionado quando `anoComparativo` mudar (cache simples por ano em ref para evitar re-fetch).
- Toggle métrica (qtd/faturamento) via `useState<'qtd' | 'faturamento'>`.
- Componente da tabela inline em `RelatorioVendas.tsx` (sem novo arquivo) usando `Table` do shadcn já em uso, mantendo o padrão visual.
- Tokens semânticos do tema (primary/muted) — sem cores hard-coded.

### Fora do escopo

- Não mexer em schema, RLS, edge functions.
- Não alterar as outras abas (Pgto., Evolução, Top Clientes, etc.).
- Não criar página/rota nova.
- Não duplicar o seletor de meses fora da aba Produtos.
