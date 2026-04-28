Plano de correção

1. Criar data operacional do pedido/entrega
- Adicionar no banco uma coluna em `pedidos` para guardar a data real da entrega/conferência, por exemplo `data_entrega`.
- Manter `created_at` como data/hora de lançamento/criação do pedido, para não bagunçar a ordem real de criação nem a numeração sequencial.
- Regra: se o pedido foi lançado para 27/04, a data operacional de entrega será 27/04, mesmo que o entregador finalize ou o caixa confira no dia 28/04.

2. Ajustar Nova Venda
- Na tela `Vendas > Nova Venda`, a data escolhida no campo atual será gravada como `data_entrega`.
- Também manteremos o pedido aparecendo no dia escolhido nos relatórios/tela de pedidos que dependem de data operacional.
- A numeração continua pela ordem de lançamento, usando `numero_sequencial`, independente da data selecionada.

3. Ajustar finalização no app do entregador
- Na tela de finalizar entrega, incluir um campo `Data da entrega` preenchido automaticamente com a data do pedido (`data_entrega` ou fallback pelo `created_at`).
- O entregador poderá confirmar ou alterar essa data antes de finalizar.
- Ao finalizar, o sistema atualizará o status para `entregue`, mas não jogará a entrega para o dia atual por causa do horário da conferência.

4. Ajustar Caixa > Acerto
- A tela de acerto passará a filtrar pedidos por `data_entrega`, não por `created_at`.
- Assim, ao buscar 27/04, aparecerão os pedidos cuja entrega pertence ao dia 27, mesmo que tenham sido finalizados/conferidos no dia 28.
- Na lista detalhada, mostrar a data/hora operacional correta; se necessário, exibir também a hora de lançamento como informação secundária.

5. Ajustar consultas auxiliares e relatórios principais de vendas
- Revisar os pontos que filtram vendas por `created_at` para o fluxo de pedidos/acerto, principalmente:
  - `src/hooks/usePedidos.ts`
  - `src/pages/vendas/Pedidos.tsx`
  - `src/pages/vendas/RelatorioVendas.tsx`
  - `src/pages/caixa/AcertoEntregador.tsx`
  - `src/pages/entregador/FinalizarEntrega.tsx`
- Onde o objetivo for “dia da venda/entrega”, usar `data_entrega`.
- Onde o objetivo for auditoria/ordem de criação, manter `created_at`.

Detalhes técnicos
- Será necessária uma migração para adicionar `data_entrega date` em `public.pedidos`.
- A migração deve preencher pedidos antigos com a data de `created_at` em Brasília, para não deixar registros sem data operacional.
- Inserts novos devem enviar `data_entrega` explicitamente.
- No acerto, os filtros devem trocar de:
  - `created_at >= dataInicioT00:00:00` e `created_at <= dataFimT23:59:59`
  para:
  - `data_entrega >= dataInicio` e `data_entrega <= dataFim`
- Em casos antigos sem `data_entrega`, usar fallback visual/consulta baseado em `created_at`, para não sumirem pedidos antigos.
- Não alterar `App.tsx`, rotas ou provider nesting.