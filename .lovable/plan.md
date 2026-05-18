# Fix: número do pedido divergente em Contas a Receber

## Causa raiz

`paymentRoutingService.rotearPagamentosVenda` usa `params.pedidoNumero` para montar a descrição (`Pedido #123`, `Venda #123 - PIX`, etc.). Quando esse campo não é informado, ele cai num fallback que pega os 8 primeiros caracteres do UUID do pedido (`pedidoId.slice(0,8).toUpperCase()`).

- `src/pages/vendas/NovaVenda.tsx` ✅ já passa `pedidoNumero: numero_sequencial`
- `src/pages/vendas/PDV.tsx` ✅ já passa `pedidoNumero: numero_sequencial`
- `src/pages/caixa/AcertoEntregador.tsx` ❌ **não passa**, e o `select` da query de entregas **nem busca** `numero_sequencial`

Resultado: pedidos criados/lançados pelo entregador e finalizados via Acerto geram títulos em `contas_receber` com descrição tipo `Venda #A1B2C3D4`, enquanto na tela `/vendas/pedidos` o mesmo pedido aparece como `#123`.

## Correção (mínima, só onde tem bug)

`src/pages/caixa/AcertoEntregador.tsx`:

1. Incluir `numero_sequencial` no `select` da query de entregas (linha ~215):
   ```
   id, numero_sequencial, created_at, data_entrega, valor_total, ...
   ```
2. Repassar para o roteamento (linha ~627):
   ```ts
   await rotearPagamentosVenda({
     pedidoId: entrega.id,
     pedidoNumero: entrega.numero_sequencial ?? null,
     ...
   });
   ```

## Fora do escopo

- Não mexer em `paymentRoutingService` (já está correto).
- Não mexer em `NovaVenda` / `PDV` (já passam o número).
- Não alterar `contas_receber` antigos — apenas os novos passarão a sair com o `numero_sequencial` correto. Se o usuário quiser, em seguida posso fazer um backfill por SQL (`UPDATE contas_receber SET descricao = ...` a partir de `pedidos.numero_sequencial` via `pedido_id`).
