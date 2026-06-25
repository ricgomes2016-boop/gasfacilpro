## Ajuste fino — Tabela de Pedidos e card-in-card global

### 1. Tabela de Pedidos (`src/pages/vendas/Pedidos.tsx` + `src/components/ui/table.tsx`)
- O wrapper da tabela hoje usa `rounded-xl` fixo, ignorando o `--radius` do tema. Trocar por `rounded-[var(--radius)]` no `<Table>` para que o tema Clean (radius 4px) e os demais respeitem o padrão.
- Remover o card-wrapper externo "Pedidos (2)" quando a tabela já é o conteúdo principal: o `<Card>` que envolve a `<Table>` na página Pedidos será marcado como container "flush" (sem padding extra e sem borda interna duplicada na tabela).
- Padronizar os "chips" internos da linha (badge ERP, nº pedido, campo data inline) para `rounded-[var(--radius-sm,4px)]`, removendo o aspecto de pílula `rounded-full`/`rounded-xl` solto que destoa no tema Clean.
- Cards mobile (linha 1030) `rounded-2xl` → `rounded-[var(--radius)]`.
- Pequenos boxes internos (linhas 1294, 1320, 1327, 904, 927, 1355, 1402, 1487, 1508) `rounded-lg/xl` → `rounded-[var(--radius)]` para herdar do tema.

### 2. Componentes UI base
- `src/components/ui/card.tsx`: trocar `rounded-xl` por `rounded-[var(--radius)]`.
- `src/components/ui/table.tsx`: trocar `rounded-xl` por `rounded-[var(--radius)]` e adicionar variante "flush" (sem borda própria) usada quando dentro de `.app-card`.
- `src/components/ui/input.tsx` / `button.tsx` já usam tokens — sem mudança.

### 3. Card-in-card global (`src/index.css`)
Reforçar o bloco já existente (linhas 1386-1409) para cobrir os casos que escapam:
- Adicionar seletores para `.app-card .rounded-xl, .app-card .rounded-2xl, .app-card .rounded-lg` reescrevendo o raio para `var(--radius)` (sem mexer em `rounded-full` de avatares/badges circulares).
- Forçar tabelas dentro de cards a herdarem `border-radius: 0` no wrapper e a usar a borda do card pai.
- Garantir que `.app-card .app-card` continue sem sombra/borda/fundo, e estender para qualquer `div` filha com classe `bg-card`/`bg-background` direta — neutralizar borda/sombra também.

### 4. Tema Operacional Clean (`src/lib/themeUtils.ts`)
- Adicionar regra específica forçando `--radius: 4px` também nos componentes Radix (Popover, Dropdown, Dialog) e em `.app-card.kpi` para manter coerência visual entre KPIs e tabelas.

### Resultado esperado
- A tabela de Pedidos no tema Clean ficará com cantos de 4px, sem o "card dentro de card" arredondado destacado na imagem.
- Trocar de tema (Premium/Clássico/Clean) ajustará automaticamente o raio de cards, tabelas e chips em todo o sistema.
- Nenhuma mudança de lógica/negócio — apenas presentation.