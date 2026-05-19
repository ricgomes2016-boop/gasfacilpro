## Problema
No card de "Produtos Rápidos" do PDV, os produtos de gás (Gás P13, P20, P45) não exibem o nome — apenas o ícone de chama, o preço e o estoque. O nome existe no banco; o que acontece é que o card tem altura fixa `h-20` e, quando o ícone de chama entra na pilha (`flex-col`), ultrapassa o espaço disponível e o nome acaba comprimido/oculto. O card de Água (sem ícone) cabe e mostra o nome.

Também não há foto do produto sendo usada, embora a tabela `produtos` já tenha a coluna `image_url`.

## Mudanças propostas em `src/components/pdv/PDVQuickProducts.tsx`

1. **Buscar a imagem do produto**
   - Acrescentar `image_url` no `select` da consulta a `produtos`.
   - Estender a interface `Produto` com `image_url: string | null`.

2. **Novo layout do card (uniforme p/ todos os produtos)**
   - Aumentar a altura para `h-28` (ou `h-32`) para caber: imagem/ícone + nome (2 linhas) + preço + estoque.
   - Topo do card: miniatura quadrada `h-10 w-10 rounded-md object-cover`.
     - Se `image_url` existir → `<img>` com a foto.
     - Senão, se `categoria === 'gas'` → ícone `Flame` num quadrado com `bg-primary/10`.
     - Senão, fallback genérico (ícone `Package` ou `Droplets` p/ água) no mesmo quadrado.
   - Nome do produto sempre visível: `text-xs font-medium line-clamp-2 text-center`, com `min-h-[2.25rem]` para reservar 2 linhas (evita "saltar" o layout).
   - Preço logo abaixo (`text-sm font-bold text-primary`).
   - Estoque em `text-[10px] text-muted-foreground`.

3. **Pequenos ajustes visuais**
   - Manter destaque sutil para gás (`bg-primary/5 hover:bg-primary/10`) e borda de alerta quando estoque ≤ 5.
   - Garantir que o `<img>` tenha `alt={produto.nome}` e `loading="lazy"`.

## Fora de escopo
- Não alterar a tela de cadastro de produtos nem o upload de imagens — isso já existe e usa `image_url`. Produtos sem foto continuarão usando o ícone padrão até que o usuário cadastre uma imagem.
- Não mexer em outras telas que listam produtos (apenas o card do PDV).

## Resultado esperado
Os três cards de gás passam a exibir "Gás P13 — R$ 125,00 — Est: 298", etc., com a foto cadastrada (ou ícone de chama como fallback), igual ao card de Água Mineral.
