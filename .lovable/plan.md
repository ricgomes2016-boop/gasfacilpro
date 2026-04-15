

## Plano: Corrigir histórico do app entregador + Permitir múltiplas formas de pagamento

### Problema 1: Vendas não aparecem no histórico do app

A página `EntregadorHistorico.tsx` filtra pedidos com `.eq("status", "entregue")` (linha 86), mas a `EntregadorNovaVenda.tsx` insere pedidos com `status: "finalizado"` (linha 428). Por isso as vendas feitas pelo app nunca aparecem no histórico.

**Correção**: Alterar o filtro do histórico para incluir ambos os status: `.in("status", ["entregue", "finalizado"])`.

### Problema 2: Pagamento único no app do entregador

Hoje o app usa um Select simples para uma única forma de pagamento. O ERP já possui o componente `PaymentSection` que permite múltiplas formas (dinheiro + pix, por exemplo).

**Solução**: Substituir o Select de pagamento único por uma versão adaptada do `PaymentSection` existente no app do entregador. Isso requer:

1. **Adaptar o `PaymentSection`** para funcionar no contexto do entregador (aceita `unidadeId` como prop em vez de usar `useUnidade`)
2. **Atualizar `EntregadorNovaVenda.tsx`**:
   - Trocar `formaPagamento` (string) por `pagamentos` (array de `Pagamento[]`)
   - Usar o `PaymentSection` no lugar do Select atual
   - Ao salvar o pedido, gravar `forma_pagamento` como a lista concatenada (ex: "dinheiro, pix") ou a forma principal
   - Validar que o total pago cobre o total da venda
3. **Remover** os modais PIX/Card avulsos que estão duplicados no EntregadorNovaVenda (já existem dentro do PaymentSection)

### Arquivos envolvidos

| Arquivo | Mudança |
|---|---|
| `src/pages/entregador/EntregadorHistorico.tsx` | Filtro `.eq("status", "entregue")` → `.in("status", ["entregue", "finalizado"])` |
| `src/pages/entregador/EntregadorNovaVenda.tsx` | Substituir Select de pagamento por `PaymentSection`, adaptar estado e lógica de finalização |
| `src/components/vendas/PaymentSection.tsx` | Adicionar prop opcional `unidadeId` para uso fora do contexto `UnidadeContext` |

### Detalhes técnicos

- O `PaymentSection` hoje usa `useUnidade()` para obter o ID da unidade. Será adicionada uma prop `unidadeId?: string` que, quando presente, é passada diretamente aos modais PIX/Card, evitando dependência do contexto.
- A `forma_pagamento` salva no pedido será a lista das formas usadas (ex: `"dinheiro, pix"`) para manter compatibilidade com o histórico e relatórios.
- A validação de finalização verificará `totalPago >= total` em vez de apenas verificar se `formaPagamento` não está vazio.

