

# Corrigir: Clicar no resultado da busca de cliente não funciona

## Problema

O dropdown de resultados (linhas 433-451) está renderizado **fora** do `searchRef` (linhas 368-431). Quando o usuário clica em um resultado:

1. Evento `mousedown` dispara primeiro
2. `handleClickOutside` detecta que o clique está fora de `searchRef`
3. Seta `showResults = false` — dropdown some
4. O `onClick` do botão nunca executa

## Solução

**Arquivo:** `src/components/vendas/CustomerSearch.tsx`

Mover o bloco de resultados do autocomplete (linhas 433-451) para **dentro** do `div` com `ref={searchRef}` (antes do fechamento na linha 431). Assim, clicar nos resultados não será detectado como "click outside".

Alternativa mais simples: trocar o `onClick` dos botões de resultado para `onMouseDown` com `e.preventDefault()`, igual ao que já é feito nos resultados de endereço (linha 510). Isso garante que o clique é capturado antes do blur/mousedown fechar o dropdown.

**Abordagem escolhida:** Usar `onMouseDown` + `preventDefault` nos botões de resultado do cliente (consistente com o padrão já usado no dropdown de endereço).

### Alteração
Linha 441: trocar `onClick={() => selectCliente(cliente)}` por:
```typescript
onMouseDown={(e) => {
  e.preventDefault();
  selectCliente(cliente);
}}
```

Uma linha resolve o problema.

