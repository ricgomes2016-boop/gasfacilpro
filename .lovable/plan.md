# Pedidos Kanban — Plano

Criar nova tela `/vendas/pedidos/kanban` baseada na referência HTML enviada, aplicando o tema atual (tokens, cards, KPIs sólidos, badges, radius do tema selecionado).

## 1. Rota e Menu
- Novo arquivo `src/pages/vendas/PedidosKanban.tsx`.
- Adicionar rota em `src/routes/vendasRoutes.ts`: `/vendas/pedidos/kanban` (mesmos roles de `/vendas/pedidos`).
- Adicionar item no menu Vendas em `src/components/layout/menuItems.ts` logo após "Pedidos": **"Pedidos Kanban"** com badge "Novo".

## 2. Layout (mobile + desktop)
- **Top bar:** título "Pedidos — Kanban", data de hoje, filtros (Entregador, Prioridade), botões `+ Nova Venda` e `↻ Atualizar`.
- **KPI strip (5 cards):** Novos, Confirmados, Em Rota, Entregues, Total do Dia (R$) — usando `Card variant="kpi"` com tons sólidos `amber / blue / violet / green / sky` (mesma rotação atual).
- **Board:** 5 colunas horizontais com scroll (`overflow-x-auto`), cada uma com cabeçalho colorido por status + contagem, corpo rolável vertical. No mobile, board vira coluna única com seletor de status (tabs horizontais).
- **Cards de pedido:** número do pedido, cliente, produtos (resumo), valor (destaque), horário, entregador (chip), bolinha de prioridade lateral, ações no hover (WhatsApp, ligar, abrir modal).
- Aplicar `var(--radius)` em tudo, tokens semânticos (`bg-card`, `text-foreground`, `border-border`), sem cores hardcoded. Border lateral colorida por status via tokens `--tile-*`.

## 3. Dados (reais)
- Reaproveitar a query usada em `Pedidos.tsx` (filtrar do dia atual). Mapear `status` do banco → colunas:
  - `novo` / `pendente` → **Novos**
  - `confirmado` / `em_preparo` → **Confirmados**
  - `em_rota` / `saiu_para_entrega` → **Em Rota**
  - `entregue` / `concluido` → **Entregues**
  - `cancelado` → **Cancelados**
- Realtime: subscrever `postgres_changes` em `pedidos` (filtro unidade) para refletir mudanças sem refresh; fallback de refetch a cada 30 s.
- Filtros locais por entregador e prioridade.

## 4. Drag-and-drop
- Implementar com HTML5 DnD nativo (sem dep nova). Ao soltar em outra coluna, `UPDATE pedidos SET status = ...` (mesmo helper já usado em editar pedido), otimista com rollback em erro e toast.

## 5. Modal de detalhe
- `Dialog` shadcn reutilizando tokens do tema. Conteúdo conforme referência: header com nº/sub, seletor de status (chips), cliente (avatar + nome + tel + botões WhatsApp/Ligar), produtos, entregador (select), pagamento, endereço, linha do tempo (created → confirmed → em rota → entregue), total destacado, ações Fechar / Salvar.
- "Salvar" persiste status + entregador via update na tabela `pedidos`.

## 6. Detalhes técnicos
- Hook isolado `usePedidosKanban(unidadeId, date)` com React Query (`queryKey` por unidade+data) — não mexer no hook existente da página de Pedidos.
- Componentes:
  - `PedidosKanban.tsx` (page)
  - `kanban/KanbanBoard.tsx`, `KanbanColumn.tsx`, `KanbanCard.tsx`, `KanbanDetailModal.tsx`, `KanbanTopBar.tsx`, `KanbanKpis.tsx`
- Sem alterações em `Pedidos.tsx`, `NovaVenda.tsx`, footer global, layout ou tema.
- Respeitar `unidade_id` em todos os updates (RLS).

## Fora de escopo
- Edição de produtos/valores no modal (apenas status + entregador).
- Notificações push (já existem em outro fluxo).
- Mudanças no tema/visual global.
