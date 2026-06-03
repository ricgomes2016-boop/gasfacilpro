# Refatoração da tela /vendas/relatorio

Refatorar **apenas a UI** de `src/pages/vendas/RelatorioVendas.tsx` para um painel executivo moderno, limpo e responsivo. Sem nova rota, sem nova página, sem mudança em queries existentes nem regras de negócio.

## Escopo

**Arquivo único alterado:** `src/pages/vendas/RelatorioVendas.tsx`

**Mantido intacto:**
- Rota `/vendas/relatorio` e permissões (`admin`, `gestor`, `financeiro`).
- Hooks de query atuais (`useQuery` em `pedidos` + `pedido_itens` + `entregadores` + `produtos`).
- Funções de exportação Excel/PDF (reaproveitar lógica existente).
- Componentes auxiliares já importados (`ProdutosVendidosTab`, `CelulaMesEditavel`, etc. continuam disponíveis mesmo que removidos do novo layout — não serão deletados).

## Novo layout

### 1. Cabeçalho
- `Header` com título **"Relatório de Vendas"** e subtítulo **"Acompanhe vendas por produto, entregador e canal."**.
- Barra de ações à direita (desktop) / abaixo (mobile): `Exportar Excel`, `Exportar PDF`, `Atualizar` (refetch).

### 2. Filtros (somente 5)
- Data Inicial, Data Final, Entregador, Canal de Venda, Produto (busca/typeahead).
- Layout:
  - Desktop: `grid grid-cols-5 gap-3`.
  - Mobile: `grid grid-cols-1 gap-2` (um por linha).
- Demais filtros do arquivo atual (status, forma de pagamento, importação, etc.) ficam **fora deste painel** — código removido do render, mas as queries permanecem.

### 3. Cards KPI (4)
Grid: `grid-cols-2 md:grid-cols-4 gap-3`.
1. **Faturamento Total** — soma de `valor_total` dos pedidos filtrados.
2. **Itens Vendidos** — soma de `quantidade` em `pedido_itens`.
3. **Preço Médio de Venda** — faturamento ÷ itens.
4. **Total de Pedidos** — count de pedidos filtrados.

Visual: card com ícone à esquerda em tom suave, label `text-xs text-muted-foreground`, valor `text-2xl font-bold`, borda sutil, hover leve.

### 4. Abas
`Tabs` com 3 entradas: **Por Produto**, **Por Entregador**, **Por Canal**.

#### Aba Produto
- Campo de busca acima da tabela.
- Tabela: Produto | Qtd Vendida | Preço Médio | Total Vendido.
- Ordenação padrão: Total DESC.
- Linha de **Total** no rodapé (soma qtd e total; preço médio = total/qtd).

#### Aba Entregador (cards, não tabela)
- Grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3`.
- Cada card: Nome (destaque), 4 métricas em linha (Itens, Faturamento, Lucro, Margem %), botão **Ver Detalhes**.
- **Lucro** = Σ `(preco_unitario − produtos.preco_custo) × quantidade` (usando `preco_custo` já existente em `produtos`; quando ausente, considerar 0 e exibir margem como `—`).
- **Margem %** = lucro / faturamento × 100.
- Ao clicar em **Ver Detalhes**: expandir o próprio card (estado local `expandedId`) mostrando mini-tabela: Produto | Qtd | Preço Médio | Total, com linha de total do entregador.

#### Aba Canal
- Tabela: Canal | Qtd | Preço Médio | Total, ordenada por Total DESC.
- Linha de Total no rodapé.
- Usar `canalLabels` existente para nomes amigáveis (WhatsApp, Telefone, Balcão, App Cliente, Entregador, Parceiro).

## Responsividade
- Container: `p-3 sm:p-6 space-y-4 sm:space-y-6`, `w-full min-w-0 max-w-full`.
- Tabelas envoltas em `overflow-x-auto` com `min-w-[420px]`.
- Inputs com `h-10` e `text-base` no mobile (evita zoom iOS).
- Botões de ação: `flex-col sm:flex-row` no header.

## Detalhes técnicos

- Estado adicional: `produtoBusca`, `entregadorFiltro`, `canalFiltro`, `produtoFiltro`, `expandedEntregadorId`.
- Memoização: `useMemo` para `kpis`, `porProduto`, `porEntregador` (com detalhamento por produto interno), `porCanal`, derivados a partir de `pedidosFiltrados`.
- A query atual em `pedidos` será estendida no `select` para incluir `produtos(nome, preco_custo)` (apenas adicionar campo — sem alterar filtros nem regras).
- Exportação Excel/PDF: reaproveitar funções existentes, ajustando para exportar os 3 datasets agregados (Produto, Entregador, Canal) usando os mesmos memos.
- Tokens semânticos do design system (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-primary`) — nenhum hex novo.

## Fora de escopo
- Não criar novas rotas/páginas/componentes externos.
- Não alterar RLS, permissões, edge functions, schema.
- Não tocar em outras telas de vendas.
