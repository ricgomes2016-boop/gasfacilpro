
# Padronização Visual Global — ERP Premium

Objetivo: deixar todo o sistema com aparência consistente de ERP premium — cards mais limpos, tabelas profissionais, tipografia nítida, e eliminar o efeito "card dentro de card".

## 1. Tokens e tipografia (nitidez)

Em `src/index.css`:
- Adicionar suavização de fonte global: `-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`, `text-rendering: optimizeLegibility`, `font-feature-settings: "cv11","ss01","ss03"`.
- Fixar Plus Jakarta Sans como `--font-sans` (já é regra do projeto) e subir o peso base de corpo para `font-weight: 450` em `body` para ganhar nitidez sem ficar bold.
- Escurecer `--foreground` no light (de `222 22% 13%` → `222 30% 11%`) e clarear `--muted-foreground` o suficiente para AA (`225 14% 38%`) — mais contraste = letras mais nítidas.
- Adicionar tokens novos:
  - `--surface` (fundo de página), `--surface-elevated` (card), `--surface-sunken` (interior de card, sem borda dupla).
  - `--border-subtle` (linhas de tabela) e `--border-strong` (separadores estruturais).
  - `--shadow-card` único e discreto (1px hairline + sombra suave), substituindo `shadow-md/lg` empilhados.

## 2. Card padrão (eliminar card-dentro-de-card)

Em `src/components/ui/card.tsx`:
- Remover `shadow-md ... hover:shadow-lg` do `Card` base. Premium ERP usa **borda hairline + 1 sombra muito suave**, sem hover lift.
- Reduzir `rounded-2xl` → `rounded-xl` (12px) — visual mais corporativo.
- `CardHeader`: remover `bg-card` e `border-b` por padrão; criar variante `bordered` opcional. Padding padrão `px-5 py-4`.
- `CardContent`: padding consistente `p-5` (remover escala `p-3 sm:p-4 md:p-5`).
- Adicionar variantes via `cva`:
  - `variant: "default" | "flat" | "sunken" | "interactive"`
    - `flat`: sem sombra, só borda — para usar **dentro** de outro card.
    - `sunken`: `bg-surface-sunken`, sem borda — para blocos internos sem virar "card aninhado".
- Criar utilitário `.app-card-nested` global no `index.css` que neutraliza sombra/borda quando um `Card` está dentro de outro `Card` (`.app-card .app-card { @apply shadow-none border-transparent bg-transparent p-0; }`) — corrige o problema sem reescrever cada tela.

## 3. Tabela padrão

Em `src/components/ui/table.tsx` (ler e ajustar):
- `Table`: `text-sm`, `font-medium` no `thead`, `text-foreground` nas células (não muted).
- `TableHeader`: fundo `bg-muted/40`, `uppercase tracking-wide text-xs font-semibold text-muted-foreground`, borda inferior `border-strong`.
- `TableRow`: altura mínima 44px, hover `bg-muted/30`, separador `border-subtle`, **zebra removida** (premium é uniforme com hairlines).
- `TableCell`: `py-3 px-4`, números tabulares `tabular-nums` automático em colunas numéricas via classe utilitária `.num`.
- Adicionar wrapper `DataTableShell` (novo, em `src/components/ui/data-table-shell.tsx`) que envolve a tabela com:
  - Toolbar (busca + filtros + ações) padronizada
  - Estados vazio/loading/erro consistentes
  - Paginação e footer com contagem
  - Borda externa única, sem `Card` envolvendo — para não duplicar moldura.
- Guideline: **tabela nunca vai dentro de `Card`** — usa o `DataTableShell` direto.

## 4. Cores modernas

Manter teal `174 61% 47%` como primary (identidade), mas:
- Trocar `--background` para tom mais neutro/frio: `220 20% 98%` (light) — sai do bege e fica mais "fintech".
- `--secondary` atual `243 100% 69%` (roxo vibrante) → mover para uso só de accent. Secondary vira neutro escuro `222 25% 18%` (botões secundários ERP).
- Paleta de status mais sóbria: success `158 64% 40%`, warning `38 92% 50%`, info `217 91% 55%`, destructive `0 72% 51%`.
- Dark mode: subir `--card` para `220 18% 9%` (separa melhor de `--background 220 25% 5%`), `--border` `220 18% 18%`.

## 5. Migração / aplicação

A maioria das telas usa os componentes `Card` e `Table` shadcn — então **as mudanças em `card.tsx`, `table.tsx` e tokens propagam automaticamente** sem tocar cada página.

Ajustes manuais pontuais (apenas onde há aninhamento explícito ou estilos hardcoded):
- Dashboards (`AdminDashboard`, `Dashboard`, dashboards de vendedor/entregador/contador): remover `Card` interno onde só serve de divisor — trocar por `<div className="rounded-lg bg-sunken p-4">` ou variante `flat`.
- Páginas com tabelas dentro de Card (CRM, Clientes, Pedidos, Financeiro, Estoque, Frota, RH): trocar por `DataTableShell`.

A regra `.app-card .app-card { ... }` em CSS cobre o resto automaticamente como rede de segurança.

## 6. Não-mexer

- `App.tsx`, providers, rotas — intocados (regra de estabilidade).
- App do cliente (`src/pages/cliente/*`) — já foi redesenhado premium recentemente; manter como está.
- Themes `theme-gasmais.css`, `theme-contador.css`, `brand-themes.css` — só ajustar se quebrarem contraste.

## Detalhes técnicos

Arquivos editados:
- `src/index.css` — tokens, font smoothing, regra `.app-card .app-card`.
- `tailwind.config.ts` — adicionar `surface`, `surface-elevated`, `surface-sunken`, `border-subtle`, `border-strong`.
- `src/components/ui/card.tsx` — `cva` com variantes, padding/radius/sombra revistos.
- `src/components/ui/table.tsx` — header uppercase, hairlines, tabular-nums, sem zebra.
- `src/components/ui/data-table-shell.tsx` — novo wrapper.
- 6-10 dashboards/listagens de alto tráfego: trocar Card-em-Card por variante `flat`/`sunken` e adotar `DataTableShell` nas tabelas principais.

## Entregável visual

- Cards: 1 nível de elevação, hairline border, sombra única e suave, sem hover lift dramático.
- Tabelas: cabeçalho uppercase tracking-wide, linhas com hairline, hover sutil, números alinhados.
- Texto: foreground mais escuro, antialiased, Plus Jakarta 450 — sensação de "mais nítido" imediata.
- Paleta: fundo neutro frio, primary teal preservado, status sóbrios, sem roxo vibrante competindo por atenção.
