
# Auditoria de UI/UX — Oportunidades para deixar o app "premium"

Análise apenas — nada será alterado agora. Baseada nos tokens em `src/index.css`, `tailwind.config.ts`, componentes base (`Card`, `Button`, `Table`, `Input`), layouts principais e páginas de referência (Dashboard, AdminDashboard, Pedidos, módulos operacionais/financeiros).

Legenda de impacto: 🔴 alto · 🟡 médio · 🟢 baixo

---

## 1. Hierarquia visual, profundidade e sombras

- 🔴 **Cards muito "planos" e uniformes.** Quase todos os `Card` usam a mesma sombra padrão do shadcn (`shadow-sm`). Você já tem `--shadow-sm/md/lg/glow` definidos no `:root`, mas eles quase não são usados. Falta uma escala de elevação clara: KPI hero > card de conteúdo > card secundário > list item.
- 🔴 **Falta de "primeira classe" visual em KPIs.** No `Dashboard` e `AdminDashboard` os KPI cards são retangulares planos. Premium normalmente traz: gradiente sutil no fundo, ícone com halo/glow, número em display font, delta com micro-sparkline.
- 🟡 **Sem hairline borders diferenciadas.** Todos os `border-border` usam a mesma opacidade. Cards importantes deveriam ter `border-border/40` + shadow-md; secundários `border-border/60` sem sombra.
- 🟡 **Header e sidebar sem separação clara do conteúdo.** O `MainLayout` cola o conteúdo direto no fundo. Falta um "canvas" com leve gradiente radial ou uma casca de card contendo a página.
- 🟢 **Popovers/Dropdowns/Dialogs sem sombra dramática.** Ficam com a mesma sombra dos cards — em premium eles "flutuam" bem mais (shadow-2xl + backdrop blur).

## 2. Micro-interações e transições

- 🔴 **Hover states genéricos.** Botões e cards apenas escurecem/clareiam. Faltam: leve `translate-y-[-1px]`, sombra crescente, brilho no ícone. Rows de tabela só mudam bg.
- 🔴 **Sem transições entre rotas.** Trocar de página é "corte seco". Um fade/slide curto (150–200ms) muda a percepção imediatamente.
- 🟡 **Loading states inconsistentes.** Mistura de `animate-pulse` cru, spinners e nada. Não há um `<Spinner>`/`<LoadingOverlay>` padronizado com a identidade do produto.
- 🟡 **Feedback de ação fraco.** Botões primários não têm estado `loading` visível com spinner interno + texto substituído; toasts são padrão shadcn sem ícone colorido por tipo.
- 🟡 **Chevrons/expansões sem rotação suave.** Alguns expanders (ex.: ResumoFinanceiro em Pedidos) já rotacionam, mas o padrão não está aplicado em accordions, menus e sidebar.
- 🟢 **Falta de "press effect"** em botões (scale 0.98 no active).

## 3. Empty states e skeletons

- 🔴 **Empty states genéricos.** `EmptyState` compartilhado é reexport do estoque. A maioria dos módulos mostra apenas "Nenhum registro encontrado". Premium tem: ilustração/ícone grande, título com voz do produto, subtítulo explicando o porquê, CTA primária.
- 🔴 **Skeletons quase inexistentes.** O padrão é `<div className="h-14 bg-muted/40 animate-pulse" />` repetido inline. Faltam skeletons dedicados por componente (KpiSkeleton, TableSkeleton, CardSkeleton) que respeitem a forma real do conteúdo — evita layout shift e transmite qualidade.
- 🟡 **Sem shimmer.** `animate-pulse` cru é o "cheiro" mais denunciante de app básico. Shimmer diagonal com gradiente muda a percepção instantaneamente.

## 4. Iconografia

- 🟡 **Tamanhos misturados.** Auditando amostras: `h-3 w-3`, `h-3.5`, `h-4`, `h-5`, `h-6` aparecem sem regra clara. Deveria haver 3 tamanhos canônicos (xs 14, sm 16, md 20) com uso definido (inline em texto, botão, header de card).
- 🟡 **Peso do stroke inconsistente.** lucide-react com `strokeWidth` default (2) fica robusto demais em ícones pequenos e leve demais em headers. Padronizar 1.75 global e 2.25 em ícones de destaque dá acabamento.
- 🟢 **Ícones sem "container".** Em SaaS premium ícones de header de card vivem em um quadrado arredondado com bg tokenizado por categoria (financeiro/estoque/marketing). Você já faz isso no `AdminDashboard` — falta espalhar.

## 5. Escala tipográfica e ritmo vertical

- 🔴 **Muitas fontes carregadas.** `index.css` importa IBM Plex, Inter, Manrope, Outfit e Plus Jakarta Sans juntas. Isso pesa no LCP e sinaliza indecisão. Premium = 1 display + 1 texto, tabular-nums para números.
- 🔴 **Sem escala tipográfica formalizada.** Títulos usam `text-2xl`/`text-3xl` inline, cards misturam `text-sm`/`text-base` sem sistema. Faltam classes utilitárias (`text-display`, `text-h1`, `text-h2`, `text-body`, `text-caption`, `text-metric`).
- 🟡 **Números financeiros sem `tabular-nums`.** KPIs "pulam" ao atualizar. Fácil de resolver e transmite qualidade imediata.
- 🟡 **Line-height apertado em corpo.** Textos usam leading padrão do Tailwind; corpo deveria ter `leading-relaxed` (1.6).
- 🟢 **Letter-spacing** ausente em títulos grandes (deveria ser `-0.02em`).

## 6. Componentes de dados (KPIs, gráficos, badges)

- 🔴 **KPI cards sem storytelling.** Só valor + label + trend em texto. Falta: comparação vs período anterior com seta colorida, mini sparkline (recharts já está no projeto), meta % preenchida.
- 🔴 **Gráficos com paleta hardcoded.** `GraficoEvolucaoPrecos` usa `#ef4444`, `#8b5cf6`, etc. Fugindo dos tokens. Também não há tooltip customizado com a mesma tipografia/sombra do sistema, nem `<CartesianGrid>` sutil (opacidade baixa).
- 🟡 **Badges de status pobres.** Usam `variant` padrão shadcn. Premium: dot colorido + texto + fundo com opacidade da mesma cor (ex.: `bg-success/10 text-success` com `●`).
- 🟡 **Tabelas sem "hierarquia de coluna".** Todas colunas com mesmo peso. Primeira coluna (identificador) deveria ser semibold; valores numéricos alinhados à direita com `tabular-nums`; ações com ícone-only.
- 🟢 **Falta de agrupamento visual em listas longas** (sticky group headers por data/categoria).

## 7. Polish

- 🟡 **Raio de borda inconsistente.** `--radius: 1rem` (16px, generoso), mas botões usam `rounded-md` (calc(radius)-2px = 14px), inputs também, e vários componentes usam `rounded-xl`/`rounded-2xl` livremente. Falta regra: inputs/botões `rounded-lg`, cards `rounded-2xl`, chips `rounded-full`.
- 🟡 **Gradientes só na sidebar.** `--gradient-primary` existe mas é usado só em 1–2 lugares. Poderia aparecer em: hero do dashboard (já usa), botão primário de CTA principal, header de card destacado, badge de plano.
- 🟡 **Dark mode desalinhado.** A sidebar mantém o mesmo gradiente teal→índigo no dark, o que cria contraste estranho com `background 220 25% 4%`. Popovers no dark ficam apagados (`--popover 220 22% 7%` quase igual ao bg). Faltam elevações por camada (bg → surface → elevated).
- 🟡 **Focus rings** usam `--ring` mas em muitos componentes o ring some ou aparece com offset padrão. Premium define ring 2px + offset 2px + cor com opacidade consistente.
- 🟢 **Scrollbars** default do SO. Um scrollbar fino customizado (webkit) transmite cuidado.
- 🟢 **Selection color** (`::selection`) não definido.

## 8. Onboarding e primeira impressão

- 🟡 **Dashboard "raso" no primeiro load.** Só saudação + KPIs + QuickActions. Falta: card "próximas ações" (pendências), timeline recente, "insight do dia" da Bia — sinais de app inteligente.
- 🟡 **AdminDashboard já é mais rico** (hero com gradiente + noise SVG, cards com ícones coloridos). Serve de referência para replicar o padrão nos dashboards operacionais.
- 🟡 **Sem tour/highlight na primeira visita.** Não precisa ser guided tour completo — apenas 3 tooltips destacando sidebar, seletor de unidade e Bia já elevam.
- 🟢 **Favicon/OG image** — verificar se estão à altura da marca (não coberto nesta análise, checar antes de publish).

---

## Ranking consolidado (top 10 para atacar primeiro)

1. 🔴 Padronizar **elevação de cards** (3 níveis) + reformular KPI cards com gradiente sutil, ícone com halo, tabular-nums e mini-trend.
2. 🔴 Reduzir para **1 display + 1 body font** e criar classes tipográficas semânticas.
3. 🔴 Criar biblioteca de **skeletons dedicados** (KPI, Table, Card, List) com shimmer — substituir `animate-pulse` inline.
4. 🔴 Redesenhar **empty states** genéricos com ícone grande + copy + CTA.
5. 🔴 Alinhar **paleta dos gráficos** aos tokens + tooltip customizado.
6. 🟡 Adicionar **transição de rotas** (fade curto) e padronizar hover (translate-y + shadow crescente).
7. 🟡 Padronizar **iconografia** (3 tamanhos, strokeWidth único, ícone em "chip" nos headers de card).
8. 🟡 Revisar **dark mode** (elevação por camada, sidebar adaptada, popovers com contraste).
9. 🟡 Refinar **badges de status** (dot + bg com opacidade da cor).
10. 🟡 Melhorar **feedback de ação** (botão com estado loading, toasts com ícone colorido).

Baixo impacto (fazer depois, agrupado num "polish pass"): press effect nos botões, scrollbar custom, `::selection`, letter-spacing em títulos, sticky group headers em listas.

---

## Próximo passo sugerido

Escolha **um dos três caminhos** para eu montar plano de implementação:

- **A. Fundação primeiro** — tokens (tipografia, elevação, radius), Card/Button/Skeleton/Badge/EmptyState base. Impacto visual médio-alto em todo o app com pouco código.
- **B. Dashboards primeiro** — reformular KPIs, gráficos, hero do Dashboard/AdminDashboard/dashboards operacionais. Impacto máximo na "primeira impressão".
- **C. Top 5 do ranking** — atacar os 5 itens 🔴 juntos em um único passe global.

Diga qual (ou combine) e eu abro o plano detalhado de implementação.
