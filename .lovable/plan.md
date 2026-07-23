## Escopo

Refino visual e de navegação do shell do ERP (rotas do ERP autenticado). Não altera lógica, dados, queries, hooks, rotas ou portais externos (cliente, entregador, contador, parceiro, transportadora — que já usam layouts próprios).

## Diagnóstico

- Existem dois modos de shell: **legado** (sidebar `hidden xl:flex` + `MobileNav` drawer no header + `MobileBottomBar` flutuante com Chat/IA/Calc) e **operacional-clean** (sidebar off-canvas com overlay + header 56px). A queixa "sidebar aparece antes do conteúdo no mobile" acontece quando o tema `operacional-clean` está ativo: a `.clean-sidebar` é `flex` em todas as larguras e só é escondida por transform, o que em alguns viewports/toggles renderiza atrás do overlay mas empurra layout no primeiro paint.
- Header legado reserva `min-h-[4.5rem]` no mobile e ainda mostra `UnidadeSelector` desktop competindo com título.
- Menu desktop tem 14 grupos com pesos visuais equivalentes; itens redundantes (ex: Pedidos + Pedidos Kanban) aparecem lado a lado.
- Bottom bar mobile atual só tem Chat / IA / Calc — não há navegação primária (Dashboard, PDV, Nova Venda, Pedidos).

## Mudanças

### 1. Shell mobile (`MainLayout.tsx`, `Sidebar.tsx`)
- Forçar sidebar off-canvas real em `<768px` em ambos os temas (legado e clean): `translate-x-[-100%]` + `pointer-events-none` quando fechada, sem ocupar fluxo. Overlay clicável para fechar. Sem alterar o comportamento xl+.
- Padding inferior do `<main>` aumentado para acomodar bottom nav (`pb-28 md:pb-10`).

### 2. Bottom navigation mobile (`MobileBottomBar.tsx`)
- Reestruturar para 5 slots primários: **Dashboard, PDV, Nova Venda, Pedidos, Menu** (Menu abre o drawer da sidebar via evento).
- Mover Chat / IA / Calc para um botão flutuante único (FAB "+") acima da bottom bar, expandindo em cluster — não compete mais com navegação.
- Safe-area bottom preservado.

### 3. Header (`Header.tsx`)
- Legado mobile: reduzir para **~56px** (uma linha), título + botão menu + ações essenciais (notificações, avatar). Empresa/unidade movidos para subtítulo colapsável.
- Desktop: unificar altura em 64px, `bg-card/85 backdrop-blur`, borda inferior mais sutil (`border-border/60`), ações com `h-10 rounded-xl`.
- Botão de menu (hambúrguer) sempre visível em `<xl`, não apenas no clean.

### 4. Sidebar desktop (`Sidebar.tsx`)
- Largura 264px, `bg-sidebar` neutro, `border-r border-sidebar-border/60`, sem `shadow-2xl` nem `rounded-r-2xl`.
- Item ativo: `bg-primary/10 text-primary` + `ring-1 ring-primary/20` (remover `shadow-lg` e gradiente).
- Ícones 18px consistentes; labels `text-[13px] font-medium`.
- Headers de grupo (Principal, Vendas, Operação, Clientes, Estoque, Financeiro, Gestão, Configurações) em `text-[10px] uppercase tracking-wider text-sidebar-foreground/50` — apenas visual, sem reordenar `menuItems.ts`.
- Grupo "Favoritos" pinado no topo: Dashboard, PDV, Nova Venda, Pedidos, Clientes, Estoque, Financeiro (links diretos, não altera rotas).
- Footer sidebar compactado (`h-14`).

### 5. Tokens globais (`src/index.css`)
- `--background: 210 20% 98%` (slate-50) para superfície geral.
- `--card` mantém branco puro; `--border` levemente mais claro; `--radius` mantém.
- Sombra de card reduzida (`--elev-1`).
- Não altera paletas de tema (gasmais, contador, brand themes).

## Fora de escopo

- `App.tsx`, providers, rotas, `menuItems.ts` (só leitura).
- Conteúdo interno de Dashboard, Pedidos, Nova Venda, PDV (só herdam padding/container).
- Portais externos (`ClienteLayout`, entregador, parceiro, contador).
- Backend, RLS, edge functions, dados.
- Publicação.

## Arquivos previstos

- `src/components/layout/MainLayout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/MobileBottomBar.tsx`
- `src/index.css` (tokens globais leves)

## Validação

- `tsgo` typecheck.
- Playwright em 390px em `/dashboard`, `/vendas/nova`, `/vendas/pedidos`, `/vendas/pdv`: sidebar não aparece no fluxo, bottom nav visível, sem scroll horizontal.
- Playwright em 1440px: sidebar 264px, header 64px, item ativo destacado.

## Detalhes técnicos

- Bottom nav usa `NavLink` + `useLocation` para active state.
- Botão "Menu" da bottom nav dispara `sidebar:open` via evento; `Sidebar` escuta e usa `setCollapsed(false)`.
- Em `<xl`, sidebar é sempre off-canvas mesmo no tema legado (não só clean), com overlay `bg-black/40` fechável.
- Preserva `useSidebarContext`, `useDashboardTheme`, `isCleanTheme` — sem mudar API pública.

Confirma para eu executar?