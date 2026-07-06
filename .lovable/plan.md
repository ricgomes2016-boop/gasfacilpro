## Problema

Em `src/pages/vendas/Pedidos.tsx`, os filtros de data (`dataInicio`/`dataFim`) são inicializados sempre com o dia atual (`hoje`). Ao clicar em "Editar", a rota muda para `/vendas/pedidos/:id/editar` e o componente `Pedidos` é desmontado. Ao voltar, o estado é recriado e cai novamente em "hoje", forçando o usuário a reabrir Filtros e escolher a data.

## Solução

Persistir os filtros da tela de Pedidos em `sessionStorage` para que, ao voltar da tela de edição (ou de qualquer outra), a data selecionada seja preservada durante a sessão do navegador.

### Alterações em `src/pages/vendas/Pedidos.tsx`

1. Criar uma chave única, por unidade, ex.: `pedidos:filtros:v1:<unidadeId>`.
2. Ler o estado inicial de `sessionStorage` (fallback = `hoje`) para:
   - `dataInicio`
   - `dataFim`
   - `filtroStatus`
   - `filtroEntregador`
   - `filtroOrigem`
   - `busca`
3. `useEffect` que grava o objeto de filtros no `sessionStorage` sempre que qualquer um deles muda.
4. Manter o botão "Limpar filtros" atual: além de resetar o estado, também limpa a chave do `sessionStorage`.
5. Não alterar o efeito que zera a paginação nem o efeito que força `dataInicio = hoje` quando `filtroStatus === "agendado"` (comportamento intencional).

### Fora de escopo

- Não persistir entre abas/dias diferentes: usar `sessionStorage` (não `localStorage`), então ao fechar o navegador volta ao padrão "hoje".
- Não mexer na tela `EditarPedido.tsx`, `PedidosKanban.tsx` nem no hook `usePedidos`.
- Não alterar comportamento visual dos filtros (badge de "filtros ativos" continua funcionando).

## Resultado esperado

Ao filtrar 01/07 → editar um pedido → salvar → voltar para Pedidos: a lista continua em 01/07, sem precisar reabrir o painel de filtros.