# Corrigir popover do canal de venda em Pedidos

## Problema

Na tabela **desktop** de `/vendas/pedidos`, ao clicar no lápis para editar o canal de venda, o popover não abre.

## Causa

O gatilho do popover (`PopoverTrigger asChild`) é um `<button>` que contém um `<Badge>`. O componente `Badge` é renderizado como `<div>` (em `src/components/ui/badge.tsx` linha 29). Como o HTML não permite um `<div>` (elemento de bloco) dentro de `<button>`, o navegador "conserta" a marcação movendo o `<div>` para fora do `<button>`. Isso quebra a referência do Radix `PopoverTrigger` e o clique no badge não dispara mais o popover.

A versão **mobile** funciona porque o gatilho ali é um `<button>` que contém apenas `<span>` + ícone, sem nenhum `<div>` aninhado.

## Correção

Arquivo único: `src/pages/vendas/Pedidos.tsx` (linhas ~1098-1109, coluna "Canal de venda" da tabela desktop).

Trocar o `<button>` do `PopoverTrigger` por um `<span role="button" tabIndex={0}>` (elemento inline, HTML válido com `Badge`/`div` dentro). Manter as classes visuais existentes e adicionar foco acessível.

Sem alterações em:
- versão mobile (já funciona corretamente);
- query `canais-venda-empresa`, agrupamentos `canaisFixos`/`canaisParceiros` e `renderCanalCommand`;
- regras de `podeEditarCanalPedido` ou `alterarCanalVenda`;
- backend / RLS / edge functions.

## Verificação

1. Abrir `/vendas/pedidos` em largura desktop (≥ md).
2. Clicar no lápis ao lado do canal de venda em um pedido editável.
3. O popover deve abrir com o `CommandInput` de busca e os grupos "Canais da unidade" e "Parceiros Vale Gás", roláveis.
4. Selecionar um canal deve atualizar o pedido e fechar o popover.
5. Confirmar que a versão mobile (cards) continua funcionando.
