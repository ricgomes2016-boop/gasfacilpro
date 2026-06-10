## Problema
Na tabela de Pedidos (desktop), a coluna "Cliente" está limitada a `max-w-[120px] truncate` (linha 1036 de `src/pages/vendas/Pedidos.tsx`), cortando nomes como "COMIDA C..." enquanto outras colunas (Endereço 200px, Produtos 180px) ficam mais largas. No mobile o layout já está correto (cards) e não será alterado.

## Mudança
Em `src/pages/vendas/Pedidos.tsx`:

1. **Linha 1036** — célula do Cliente: trocar `max-w-[120px] truncate` por `min-w-[200px] max-w-[260px] truncate` e adicionar `title={pedido.cliente}` para tooltip ao passar o mouse.
2. **Linha 1014** — `<TableHead>Cliente</TableHead>`: adicionar `className="min-w-[200px]"` para reservar o espaço no cabeçalho.
3. Opcional de polimento: reduzir Endereço de `max-w-[200px]` para `max-w-[180px]` para equilibrar a largura total da tabela e evitar scroll horizontal extra.

Nenhuma alteração no card mobile (linhas 909–999).

## Resultado esperado
No desktop, nomes de cliente passam a aparecer por completo até ~260px, com truncamento + tooltip apenas para nomes muito longos. Mobile permanece igual.
