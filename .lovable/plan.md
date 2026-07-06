## Objetivo
Adicionar uma coluna **Pagamento** na tabela principal de `src/pages/vendas/Pedidos.tsx`, exibindo a forma de pagamento atual do pedido. Ao clicar, abre o modal completo de edição de pagamento (o mesmo padrão de `NovaVenda` / `EditarPedido`), permitindo escolher forma, operadora do cartão, chave PIX vinculada à conta bancária, banco do cheque etc. — garantindo roteamento correto no acerto diário.

## Escopo

1. **Nova coluna "Pagamento"** na tabela (linhas ~1180 e ~1247 de `Pedidos.tsx`), posicionada entre **Valor** e **Status**.
   - Renderiza um `Badge`/botão com o ícone + rótulo da forma atual (`dinheiro`, `pix`, `cartao_debito`, `cheque`, `boleto`, `vale_gas`, `fiado`, custom…). Se vazio: "Definir pagamento" em estilo destacado (amarelo/aviso).
   - Cursor pointer; ao clicar abre o `EditarPagamentoDialog` para aquele pedido.

2. **Novo componente `EditarPagamentoPedidoDialog`** em `src/components/vendas/EditarPagamentoPedidoDialog.tsx`:
   - Reaproveita o `PaymentSection` já usado em `NovaVenda` (mesma UX: seleção de forma, `CardOperatorSelectorModal` para débito/crédito/PIX maquininha, `PixKeySelectorModal` para PIX, banco/foto para cheque, vencimento para fiado, formas custom).
   - Recebe `pedido` (id, valor_total, forma_pagamento atual, pagamentos existentes se houver) e retorna os pagamentos escolhidos via `onSaved`.
   - Botão "Salvar" chama:
     - `UPDATE pedidos SET forma_pagamento = <resumo>` (compatível com formato atual, ex.: `"pix|cartao_debito"` ou única forma).
     - Se pedido já está **entregue/pago**: chama `rotearPagamentosVenda` (do `paymentRoutingService`) com o `pedido_id`, para (re)criar `movimentacoes_caixa` / `movimentacoes_bancarias` / `contas_receber` respeitando `operadora_id`, `conta_bancaria_id` (PIX/cheque), `resolverContaDestino`. A idempotência já implementada evita duplicação — se já existir movimento, apaga o antigo e recria com o destino correto (novo helper `rerotearPagamentosPedido` em `paymentRoutingService.ts` que faz DELETE das entradas de `movimentacoes_caixa` e `movimentacoes_bancarias` com `pedido_id` = este, e depois chama `rotearPagamentosVenda`). Também atualiza `contas_receber.conta_bancaria_destino_id` das linhas pendentes deste pedido.
   - Se o pedido ainda não está entregue: só grava `forma_pagamento` + metadados nos `pagamentos` embutidos (quando a coluna existir) ou em cache para uso no acerto/entrega.

3. **Estado no `Pedidos.tsx`**:
   - `const [pedidoEditandoPagamento, setPedidoEditandoPagamento] = useState<PedidoRow | null>(null);`
   - Handler `abrirEdicaoPagamento(pedido)`.
   - Após salvar: refetch dos pedidos e toast de sucesso, aviso "Movimentações financeiras atualizadas" quando o pedido já estava entregue.

4. **Ajustes visuais**:
   - Mapa `formaLabel(forma)` (helper local) para exibir "PIX · Itaú", "Cartão Débito · PagBank/Cielo", etc., quando os metadados existirem (via join em `pagamentos_cartao`/`contas_bancarias` — leitura opcional, fallback só para o nome da forma).

## Fora do escopo
- Kanban de pedidos, PDV, Nova Venda, Editar Pedido (já têm o fluxo completo).
- Alterações no cálculo de saldo/DRE/Fluxo além do reroteamento automático já coberto por `rotearPagamentosVenda`.

## Arquivos alterados
- `src/pages/vendas/Pedidos.tsx` — nova coluna + estado + dialog.
- `src/components/vendas/EditarPagamentoPedidoDialog.tsx` — novo.
- `src/services/paymentRoutingService.ts` — helper `rerotearPagamentosPedido(pedidoId)`.
