# Refatorar Estoque do dia (`src/pages/Estoque.tsx`) — padrão Dashboard

Somente UI/layout. Nenhuma query, cálculo, mutação ou regra de negócio será alterada.

## 1. Cabeçalho / hero
- Remover o card gradiente `bg-gradient-to-br from-primary to-secondary` com título "Controle diário de produtos" (o texto some sobre o gradiente, como no print).
- Usar o mesmo `Header` já presente (`title="Estoque"`, `subtitle="Controle de estoque do dia"`), no padrão do Dashboard, e mover os botões **Atualizar** e **Movimentação** para uma barra de ações à direita, logo abaixo do Header (mesmo pattern do Dashboard: título à esquerda, ações à direita, sem card colorido envolvendo).
- O rótulo "Período: dd/mm/aaaa" vira um texto discreto (`text-sm text-muted-foreground`) ao lado dos filtros.

## 2. Cards de KPI (Cheios / Vazios / Vendas Período / Valor Estoque)
- Trocar os 4 cards sólidos coloridos (`bg-primary`, `bg-secondary`, `bg-info`, `bg-destructive`) — que estão escondendo os rótulos no preview — pelo padrão de KPI do Dashboard: card neutro (`bg-card`), borda sutil, ícone dentro de um badge tintado (`bg-primary/10 text-primary`, `bg-secondary/10`, `bg-info/10`, `bg-destructive/10`), label em `text-sm text-muted-foreground` e valor em `text-2xl font-bold text-foreground`.
- Manter os mesmos 4 indicadores e os mesmos cálculos (`getTotalCheios`, `getTotalVazios`, `totalVendas`, `getValorEstoque`).
- Grid mantém `grid-cols-2 md:grid-cols-4`.

## 3. Filtros de data
- Remover o card `modern-soft-panel` que envolve os dois date pickers.
- Colocar os dois `Popover`+`Calendar` (Data Inicial / Data Final) em uma linha compacta alinhada à direita, acima da tabela, no mesmo padrão dos filtros do Dashboard (labels curtas acima, botões `variant="outline" size="sm"`).
- Manter estado, handlers e o `periodoLabel` intactos.

## 4. Tabela / listagem do dia
- Manter estrutura de dados e colunas (Produto, Tipo, Inicial, Entradas, Saídas, Vendas, Avarias, Total, Total Vasilhame, Ação).
- Padronizar tipografia e espaçamento no padrão do sistema:
  - Cabeçalho da seção como card neutro (`Card` + `CardHeader` com ícone + título + subtítulo explicativo "Total = Inicial + Entradas − Saídas − Vendas − Avarias").
  - Cabeçalho de tabela `text-xs uppercase text-muted-foreground`, linhas com `hover:bg-muted/50`, badges de tipo com as cores semânticas já usadas no resto do ERP.
  - Sem cores hardcoded; usar apenas tokens semânticos.

## 5. Não muda
- Nenhuma query Supabase, RPC, cálculo, movimentação, dialog de "Movimentação de Estoque" (só herda os tokens visuais atualizados; conteúdo do formulário permanece).
- Nenhuma rota, nenhum import de página, nada em `App.tsx`.
- Comportamento de `fetchData`, filtros por data, `unidade_id`, permissões — tudo preservado.

## Detalhes técnicos
- Arquivo único alterado: `src/pages/Estoque.tsx`.
- Substituir apenas o JSX do `return (...)` a partir do `<MainLayout>` até o fechamento do bloco de filtros/tabela. Toda a lógica acima do `return` permanece igual.
- Reaproveitar classes utilitárias já existentes no projeto (`status-card-icon`, `modern-panel`) apenas quando forem compatíveis com o padrão Dashboard; caso contrário, usar as mesmas classes que o Dashboard usa hoje para KPIs.
- Rodar typecheck ao final.
