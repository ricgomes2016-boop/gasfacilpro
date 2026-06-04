# Sincronização Lovable — Vendas > Pedidos

Este commit sinaliza para importação/publicação no Lovable as melhorias já aplicadas na tela `src/pages/vendas/Pedidos.tsx`:

- resumo de quantidade e valor vendido por produto, respeitando os filtros da tela e desconsiderando pedidos cancelados;
- edição do canal de venda no layout mobile;
- regra de proteção para alteração de canal em pedidos entregues/finalizados, limitada a Admin/Gestor;
- preservação do comportamento existente no desktop.

Projeto: GasFacil Pro (`ricgomes2016-boop/gasfacilpro`).
