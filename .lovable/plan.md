## Plano: Cards coloridos, tipografia nítida, sem aninhamento

### 1. Paleta de tiles (Acesso Rápido style)
Adicionar 6 tokens semânticos em `src/index.css` (HSL) replicando a imagem:
- `--tile-green: 142 71% 45%`
- `--tile-blue: 217 39% 60%`
- `--tile-violet: 248 95% 68%`
- `--tile-amber: 28 75% 52%`
- `--tile-red: 0 84% 60%`
- `--tile-sky: 220 60% 95%` (texto escuro)

Para cada um: `--tile-*-fg` (branco ou foreground escuro no sky), `--tile-*-shadow`.

### 2. Aplicação dos cards coloridos (escopo controlado)
Para evitar poluir telas densas, aplicar apenas onde faz sentido visual:

**KPI cards do Dashboard e dashboards setoriais** (Financeiro, Vendas, Estoque, Operacional, Marketing, Frota, Vendedor): variante `kpi` do `Card` ganha rotação automática de cor via `data-tile-index` ou classe utilitária `.app-card.kpi[data-color="green|blue|violet|amber|red|sky"]`.

**Tiles de atalho** (Acesso Rápido, AcoesRapidas, atalhos em dashboards): já são coloridos — padronizar para usar os mesmos tokens.

**Cards de conteúdo** (listas, formulários, tabelas, modais): permanecem neutros (surface branca/dark) — não viram coloridos.

Edição em `src/components/ui/card.tsx`:
- Estender `cardVariants` com `variant: "kpi"` aceitando `tone: "green"|"blue"|"violet"|"amber"|"red"|"sky"|"auto"`.
- `auto` calcula tom pelo índice do irmão via CSS `:nth-child` em `src/styles/brand-themes.css`.
- Texto, ícone e delta usam `text-[hsl(var(--tile-*-fg))]`.

Atualizar consumidores principais de KPI para passar `variant="kpi"` (Dashboard, DashboardFinanceiro, DashboardVendas, DashboardMarketing, DashboardFiscal, VendedorDashboard, ParceiroDashboard). Cards comuns não mudam.

### 3. Remover "card dentro de card"
Em `src/index.css` (já existe regra parcial) endurecer:
```css
.app-card .app-card,
[data-card] [data-card],
.app-card [class*="rounded-"][class*="border"][class*="bg-card"] {
  background: transparent;
  border: 0;
  box-shadow: none;
  padding: 0;
}
.app-card .app-card > * { padding: 0; }
```
Aplica globalmente em todas as telas (Dashboard, Financeiro, Estoque, Vendas, Config, etc.) sem precisar tocar componente por componente.

Em tabelas: remover wrappers `Card` redundantes quando o pai já é `Card` — via mesma regra CSS (tabela dentro de card vira flush, sem segunda borda).

### 4. Tipografia nítida (fino, sem quebrar layouts)
Em `src/index.css` `@layer base`:
```css
html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
body { font-feature-settings: "cv02","cv03","cv04","ss01"; letter-spacing: -0.005em; line-height: 1.55; }
h1,h2,h3,h4 { letter-spacing: -0.02em; line-height: 1.2; font-weight: 600; }
.tabular-nums, table td, table th { font-variant-numeric: tabular-nums; }
input, select, textarea, button { -webkit-font-smoothing: antialiased; }
```
Tamanhos base preservados (sem subir px para não deslocar tabelas densas). Mobile mantém inputs em 16px.

### 5. Arquivos a editar
- `src/index.css` — tokens `--tile-*`, font-smoothing global, regra anti card-in-card endurecida.
- `src/components/ui/card.tsx` — variant `kpi` com prop `tone`, default `auto`.
- `src/styles/brand-themes.css` — rotação `nth-child` para `data-tone="auto"`.
- `src/pages/Dashboard.tsx` e dashboards setoriais — adicionar `variant="kpi"` nos KPIs principais (mudanças mínimas, sem refatorar layout).
- `src/components/ui/table.tsx` — herdar font-smoothing e `tabular-nums` nas células numéricas.

### Fora de escopo
- App.tsx, providers, rotas, lógica de negócio, edge functions, schema.
- Cards de conteúdo continuam neutros (decisão para não poluir telas densas).
- Sem subir tamanho base de fonte.
