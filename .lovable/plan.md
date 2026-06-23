
## Problema
Na tela inicial do app do cliente (`/cliente`), todos os cards de produto mostram quantidade `1` por padrão. Isso confunde o cliente, que pode achar que já tem 1 item selecionado/no carrinho.

## Objetivo
Quantidade inicial = `0`, com fluxo claro para adicionar ao carrinho sem ambiguidade.

## Mudanças em `src/pages/cliente/ClienteHome.tsx`

### 1. Quantidade inicial 0
- `getQuantity`: retornar `quantities[productId] ?? 0` (em vez de `|| 1`).
- `setQuantity`: permitir mínimo `0` (em vez de forçar `1`).
- Após adicionar ao carrinho: resetar para `0` (já reseta hoje, mas para `1` → mudar para `0`).

### 2. UX do botão "Add"
Comportamento dos controles no card:
- Quando `quantity === 0`:
  - Stepper `−  0  +` fica visualmente "apagado" (muted), com `−` desabilitado.
  - Botão **"Add"** funciona como atalho: um toque adiciona **1 unidade** direto ao carrinho (sem precisar usar o `+` antes). Isso mantém o fluxo de 1 toque para o caso mais comum (1 botijão).
- Quando `quantity >= 1`:
  - Stepper habilitado normalmente, `+`/`−` ajustam (mínimo 0).
  - Botão **"Add"** adiciona a quantidade escolhida ao carrinho e reseta para `0`.

Implementação: dentro de `handleAddToCart`, se `getQuantity(product.id) === 0`, usar `qty = 1` para o `addToCart` e para o toast.

### 3. Indicador "no carrinho"
Quando `getCartQuantity(product.id) > 0`, exibir um badge pequeno no card (ex.: "2 no carrinho") para deixar claro o que já está reservado, separando do seletor de "quantos adicionar agora". Isso reforça que o `0` no stepper é "adicionar a mais", não "tenho 0 no carrinho".

### 4. Produtos indisponíveis
Sem alteração de regra: stepper e Add permanecem desabilitados como já estão hoje.

## Fora do escopo
- Nenhuma mudança no carrinho (`/cliente/carrinho`), checkout, banco de dados ou regras de pedido.
- Sem mudanças visuais além do badge "no carrinho" e do estado apagado do stepper em `0`.

## Arquivos
- `src/pages/cliente/ClienteHome.tsx` (único arquivo alterado).
