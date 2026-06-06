## Objetivo

Aplicar o novo visual de Fluxo de Caixa (4 cards de resumo, filtros por tipo, tabela limpa em desktop e lista de cartões em mobile) na página existente `/financeiro/fluxo-caixa`, **preservando**:

- A integração real com o banco (`movimentacoes_caixa`, `contas_bancarias`, contas a pagar/receber)
- A aba "Previsão" do `FluxoCaixaConsolidado`
- O sidebar, header global e bottom nav já existentes (não recriar — usar `MainLayout`)
- Tokens semânticos HSL + Plus Jakarta Sans (não usar Inter/#0d6efd direto)

## O que muda

### `src/pages/financeiro/FluxoCaixa.tsx` (redesign visual)

1. **Cabeçalho da página**
   - Título "Fluxo de Caixa" + subtítulo "Acompanhe entradas, saídas e saldo"
   - Ações à direita (desktop): seletor de período (datas), botão Filtros, botão Exportar, botão "Nova movimentação"
   - Em mobile: ações colapsadas atrás de um botão "Filtros" (Sheet) e FAB já existente

2. **4 cards de resumo** (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4`)
   - Saldo Inicial (neutro)
   - Entradas (verde — `text-emerald-600`/token `--success`)
   - Saídas (vermelho — `--destructive`)
   - Saldo Final (azul/primary)
   - Calculados a partir do `extrato` já carregado (somar `entrada`, `saida`, aplicar saldo inicial)

3. **Tabela / Lista**
   - Tabs no topo: Todos · Entradas · Saídas (filtro client-side sobre `extrato`)
   - Input de busca à direita (filtra por `historico`)
   - Desktop (`hidden md:table`): colunas Data, Descrição, Categoria, Tipo (badge), Forma Pgto, Valor (verde/vermelho), Saldo acumulado, Ações (menu ⋮ com Editar/Excluir já existentes)
   - Mobile (`md:hidden`): cards empilhados com descrição + valor em destaque, linha secundária "data • tipo • forma"
   - Linha de total no rodapé (mantém `TableFooter` atual)

4. **Dialog "Nova movimentação"** — manter exatamente como está (apenas estilizar trigger).

### `src/pages/financeiro/FluxoCaixaConsolidado.tsx`

- Sem mudanças estruturais. Apenas conferir que a aba "Fluxo Atual" renderiza o novo visual com `embedded`.

## Detalhes técnicos

- Reusar componentes shadcn: `Card`, `Tabs`, `Table`, `Badge`, `Input`, `Button`, `Sheet` (filtros mobile).
- Cores via tokens existentes: `text-primary`, `text-destructive`, `text-emerald-600` (já presente no projeto) ou novo token `--success` se ainda não houver — usar HSL.
- Cálculos derivados via `useMemo` sobre `extrato` (regra de performance da memória).
- Mantém RLS/`unidade_id` automaticamente — nenhuma query nova.
- Nada de mexer em `App.tsx`, rotas ou providers.

## Fora de escopo

- Não criar nova rota.
- Não alterar schema do banco.
- Não tocar em `FluxoCaixaProjetado` / `PrevisaoCaixa`.
