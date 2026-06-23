## Problema

No checkout do app do cliente (Forte Gás), o aviso "Nenhuma unidade ativa disponível para receber o pedido" aparece mesmo com a Matriz ativa na empresa.

**Causa raiz:** a query em `src/pages/cliente/ClienteCheckout.tsx` filtra `unidades` por `.eq("ativa", true)`, mas o nome real da coluna na tabela é `ativo`. Como o filtro não bate, o retorno é vazio e o fluxo bloqueia o pedido. O restante do código (ClienteContext, ClienteHome) já usa `ativo` corretamente.

## Correção

Arquivo único: `src/pages/cliente/ClienteCheckout.tsx`

1. Trocar `.eq("ativa", true)` por `.eq("ativo", true)` na resolução da unidade.
2. Preferir a unidade já selecionada pelo cliente (`lojaSelecionadaId` do `ClienteContext`) quando ela pertencer à `empresa_id` do usuário; cair na primeira unidade ativa da empresa só como fallback.
3. Manter as validações existentes (empresa do `profiles`, mensagens de erro, payload do pedido).

Sem migrações, sem mudança de RLS, sem mexer em outras telas.
