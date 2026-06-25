## Objetivo
Corrigir 3 pontos visuais do tema **Operacional Clean Premium** sem mexer em regras de negócio, rotas, hooks ou componentes funcionais.

## 1. Seletor de loja só na sidebar (imagem 3)
O `UnidadeSelector` já está renderizado na sidebar quando o tema é clean (`src/components/layout/Sidebar.tsx` linha 287). Atualmente o `Header.tsx` também renderiza ele incondicionalmente, gerando o "Forte Gás" duplicado no topo (imagem 1).

**Edição:** em `src/components/layout/Header.tsx` (linha 166), envolver `<UnidadeSelector />` com `{!isCleanTheme && ...}` para que apareça apenas na sidebar no tema clean e permaneça no header nos demais temas.

## 2. Remover card hero verde do Dashboard (tema clean)
O bloco `.dashboard-hero` (gradiente verde com "Boa noite!" e chamas decorativas) deve sumir **apenas no tema Operacional Clean**.

**Edição em `src/styles/brand-themes.css`** (sem tocar no JSX do Dashboard):
- Seletor `[data-brand-preset="operacional-clean"] .dashboard-hero`:
  - `background: transparent;`
  - `box-shadow: none;`
  - `padding: 0;`
  - `border-radius: 0;`
- Ocultar elementos decorativos:
  - `[data-brand-preset="operacional-clean"] .dashboard-hero > .absolute { display: none; }`
  - `[data-brand-preset="operacional-clean"] .dashboard-hero > .relative:first-of-type { display: none; }` (esconde a saudação "Boa noite! Gás Fácil" e o VoiceAssistant duplicado — o VoiceAssistant continua acessível via FAB/sidebar)
- Resetar cor dos KPIs internos para o padrão clean (sem fundo translúcido):
  - `[data-brand-preset="operacional-clean"] .dashboard-hero .stat-card-on-hero` → herdar tokens dos cards padrão (fundo `--card`, texto `--card-foreground`, borda `--border`).

## 3. Padronizar raio dos cards aninhados (imagem 1)
Os `StatCard` com `onHero` estão muito arredondados. No tema clean, forçar o raio padrão dos cards:

**`src/styles/brand-themes.css`**:
- `[data-brand-preset="operacional-clean"] .stat-card-on-hero,
   [data-brand-preset="operacional-clean"] .dashboard-hero [class*="rounded-"] {
     border-radius: var(--radius) !important;
   }`
- Garantir que cards aninhados (Card dentro de Card) herdem `border-radius: var(--radius)` e `border: 1px solid hsl(var(--border))` no tema clean.

## Arquivos a alterar
- `src/components/layout/Header.tsx` — 1 linha (condicional `!isCleanTheme`).
- `src/styles/brand-themes.css` — adicionar bloco de overrides do `.dashboard-hero` e dos cards aninhados para `[data-brand-preset="operacional-clean"]`.

## Fora de escopo
- Nenhuma alteração em `App.tsx`, providers, rotas, hooks, serviços, edge functions ou schema.
- Demais temas (não-clean) permanecem visualmente inalterados.

## Validação
- Mobile <xl: sidebar abre via MobileNav e mostra o seletor "FORTE GAS" no topo (como imagem 3). Header não duplica.
- Dashboard no tema clean: sem card verde, KPIs em grid padrão com cantos no `--radius` global, sem cards azuis/coloridos.
- Outros temas: hero verde e seletor no header continuam como antes.