
## 1. Dashboard — restaurar KPIs (não excluir)

Refatorar `src/pages/Dashboard.tsx` para voltar a exibir uma faixa de KPIs no topo (como na imagem 2), mantendo o card "Acesso Rápido" logo abaixo. Não trazer de volta gráficos nem listas de pedidos recentes (apenas KPIs + Acesso Rápido).

KPIs propostos (linha única, responsiva, com seletor Hoje/Semana/Mês):

1. Receita (R$)
2. Pedidos (total + nº pendentes em sub-linha)
3. Em Rota (com nº de entregas)
4. Clientes ativos
5. Ticket Médio
6. Produtos críticos / Estoque baixo

Implementação:
- Criar `src/components/dashboard/DashboardKpis.tsx` com os 6 cards usando `Card` (sem nesting extra) e o hook `usePedidos`/`useClientes`/dados já existentes; período controlado por um `Tabs` interno (Hoje | Semana | Mês).
- Adicionar saudação "Bom dia/Boa tarde, {nome}" + data, alinhada à esquerda, acima dos KPIs.
- `Dashboard.tsx` renderiza: saudação → `DashboardKpis` → `QuickActions`.

## 2. Acesso Rápido — alinhar ao tema (sem cantos arredondados destoantes)

Em `src/components/dashboard/QuickActions.tsx`:
- Trocar `rounded-xl` dos botões para `rounded-[var(--radius)]` (token do tema), assim cada preset (Premium, Clássico, Operacional Clean) controla o raio. No tema Clean fica retinho/sutil; no Premium continua suave.
- Remover o card-wrapper extra com `backdrop-blur` (evita "card dentro de card"). Manter apenas `CardHeader` + `CardContent`, com o mesmo padding do restante do dashboard.
- Ajuste fino de alinhamento:
  - Altura uniforme dos botões (`min-h-[88px]`), gap consistente (`gap-2.5`), ícone centralizado verticalmente, label com `leading-[1.15]` e `tracking-tight`.
  - Padding interno do card: `p-4 sm:p-5` (mesmo padding dos KPIs).
  - Grade: `grid-cols-2 min-[420px]:grid-cols-4 sm:grid-cols-5 lg:grid-cols-10` para não estourar em telas estreitas.
- Garantir que no tema Operacional Clean a sombra dos botões seja substituída por borda hairline (via CSS já presente em `themeUtils`), removendo o `shadow-lg` quando `data-theme-preset="operacional-clean"`.

Também reforçar a regra global em `src/index.css` que neutraliza `border-radius` de filhos diretos dentro de `.card` quando o preset Clean estiver ativo (para o Clean ficar realmente quadrado).

## 3. Header — mostrar a loja (unidade) selecionada ao lado de "GásFácil"

Em `src/components/layout/Header.tsx` (bloco `isCleanTheme` e também o bloco padrão):
- Após o texto "GásFácil", renderizar um separador sutil (`·`) e o nome da `unidadeAtual` em destaque, ex.:
  ```
  GásFácil · Central Gás
  ```
- Quando não houver unidade selecionada, exibir o nome da `empresa` como fallback.
- Mobile (≤ sm): esconder o "GásFácil" textual e mostrar somente o nome da loja truncado, para não quebrar o layout.
- No tema padrão (não-Clean), garantir que a unidade também apareça no subtítulo de forma consistente (já existe, manter).

## Arquivos afetados

- `src/pages/Dashboard.tsx` — adiciona saudação + KPIs
- `src/components/dashboard/DashboardKpis.tsx` — novo
- `src/components/dashboard/QuickActions.tsx` — radius via token, sem wrapper extra, alinhamentos
- `src/components/layout/Header.tsx` — nome da loja após "GásFácil" (Clean e padrão)
- `src/index.css` — regra para zerar `border-radius` interno no preset Clean

## Detalhes técnicos

- Usar tokens `--radius`, `--card`, `--border` já definidos por `themeUtils.ts` para que a aparência siga o tema ativo.
- Reaproveitar `usePedidos`, `useClientes` e queries existentes (sem novas migrações).
- Sem mudanças de lógica de negócio: apenas apresentação/UI.
