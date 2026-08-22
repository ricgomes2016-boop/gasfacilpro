# Auditoria de UX e arquitetura — Gas Fácil Pro

Diagnóstico do estado atual (medido no código hoje) e plano de simplificação sem quebrar rotas nem regras de negócio.

## 1. Inventário quantificado

Números verificados agora no projeto:

| Item | Quantidade |
| --- | --- |
| Páginas (`src/pages/**.tsx`) | 294 |
| Componentes (`src/components/**.tsx`) | 320 |
| Rotas declaradas em `src/routes/` | 245 |
| Itens de menu com link direto | 133 |
| Grupos de primeiro nível na Sidebar | 16 |

### Duplicações confirmadas

**Dois "kits canônicos" concorrentes.** Existem hoje `src/components/shared/` (KpiCard, PageHeader, SectionCard, FilterBar, EmptyState) e `src/components/ui-kit/` (os mesmos cinco, mais AppPage, DataTable, StatusPill, MoneyText, LoadingState). O `shared` é usado por 14 arquivos; o `ui-kit` não é usado por nenhuma página ainda. Manter os dois é a maior fonte de inconsistência atual.

**Cartões de KPI — 5 implementações paralelas:**
`components/shared/KpiCard.tsx`, `components/ui-kit/KpiCard.tsx`, `components/dashboard/StatCard.tsx`, `components/dashboard/premium/PremiumKpiCard.tsx`, `components/estoque/EstoqueKpiCard.tsx`.

**Cabeçalhos de página — 3 padrões:** `shared/PageHeader` (que apenas re-exporta `estoque/EstoquePageHeader`), `ui-kit/PageHeader` e blocos `<h1>/<h2>` montados manualmente na maioria das telas.

**Dashboards gerenciais sobrepostos — 6 telas** em `pages/operacional/`: `DashboardExecutivo`, `DashboardAvancado`, `DashboardLogistico`, `DashboardTrabalhista`, `CockpitGestor`, `CentralIndicadores`. Todas respondem à mesma pergunta ("como vai a operação?") com recortes diferentes.

**Análise de resultado sobreposta — 5 telas:** `DRE`, `AnaliseResultados`, `ResultadoOperacional`, `RelatorioGerencial`, `PontoEquilibrio`.

**Fluxo de caixa em 4 telas:** `FluxoCaixa`, `FluxoCaixaConsolidado`, `FluxoCaixaProjetado`, `PrevisaoCaixa`.

**Vale Gás espalhado em 6 telas de Financeiro:** `ValeGas`, `ValeGasAcerto`, `ValeGasControle`, `ValeGasEmissao`, `ValeGasParceiros`, `ValeGasRelatorio`.

**Planejamento em 3 telas:** `Planejamento`, `PlanejamentoAnual`, `PlanejamentoMensal`.

**Mapas em 2 telas:** `MapaEntregadores` e `MapaOperacional`.

Efeito prático: o usuário precisa decorar em qual das seis telas de gestão está o número que procura, e cada uma apresenta o mesmo dado com visual diferente.

## 2. Arquitetura de informação por jornadas

Reduzir os 16 grupos de menu para 7 áreas que correspondem ao dia do revendedor:

```text
Início          Dashboard · Assistente IA · Alertas
Vender          PDV · Nova Venda · Pedidos · Clientes · Atendimento/WhatsApp · Marketing
Entregar        Rotas · Mapa · Entregadores · Frota · SLA
Estocar         Estoque do dia · Movimentações · Compras · Fornecedores · Produtos
Receber & Pagar Caixa · Contas a Receber · Contas a Pagar · Cartões · Bancos · Vale Gás
Analisar        Resultado (DRE) · Vendas · Operação · Relatórios
Configurar      Empresa · Unidades · Usuários · Integrações · Fiscal · RH
```

Regra de consolidação: telas sobrepostas viram **abas de uma tela canônica**, nunca itens separados de menu.

- `Analisar > Resultado` = abas DRE | Lucratividade | Ponto de equilíbrio | Relatório gerencial
- `Analisar > Operação` = abas Executivo | Logístico | Trabalhista (conteúdos já existem em `operacional/dashboards/`)
- `Receber & Pagar > Fluxo de caixa` = abas Realizado | Consolidado | Projetado
- `Receber & Pagar > Vale Gás` = abas Emissão | Controle | Parceiros | Acerto | Relatório
- `Entregar > Mapa` = um mapa com filtro de camadas, no lugar de duas telas

Isso leva os 133 links de menu para aproximadamente 70, sem remover nenhuma funcionalidade.

## 3. Design system

**Tokens** (já criados em `src/index.css` e mapeados no Tailwind): superfícies `surface`, `surface-raised`, `surface-sunken`; texto `fg`, `fg-muted`, `fg-subtle`; semântica financeira `positive`/`negative`; raios `rounded-card` e `rounded-control`; elevação `--elev-1`.

**Componentes canônicos** em `src/components/ui-kit/` — fonte única, `shared/` passa a apenas reexportar deles:

| Componente | Papel |
| --- | --- |
| `AppPage` | Container de página: largura, padding, espaçamento vertical |
| `PageHeader` | Título, descrição, ações |
| `KpiCard` / `KpiRow` | Único cartão de indicador do sistema |
| `SectionCard` | Bloco de conteúdo, um só nível de elevação |
| `DataTable` | Tabela com ordenação, paginação, cards no mobile |
| `FilterBar` | Busca + filtros + ações |
| `StatusPill` | Badge de status |
| `MoneyText` | Valores em BRL, sempre tabular |
| `EmptyState` / `LoadingState` | Vazio e carregando |

**Regras invioláveis:** nunca card dentro de card; nenhuma cor fixa em componente (só tokens); controles com altura mínima 44px no mobile; toda tabela tem versão em card no mobile.

## 4. Migração incremental sem quebrar nada

Nenhuma rota é removida em nenhuma fase. Telas consolidadas viram abas, e as rotas antigas passam a redirecionar para a aba correspondente (`/operacional/cockpit` → `/operacional/analise?tab=executivo`). Links salvos, favoritos e atalhos continuam funcionando.

- **Fase 1** — App Shell + Dashboard + listas padrão (detalhada abaixo)
- **Fase 2** — Consolidação de Analisar (Resultado e Operação em abas) + redirects
- **Fase 3** — Consolidação de Receber & Pagar (Fluxo de caixa e Vale Gás)
- **Fase 4** — Vender e Estocar migrados para os componentes canônicos
- **Fase 5** — Remoção dos componentes duplicados (`StatCard`, `EstoqueKpiCard`, `PremiumKpiCard`) após zero usos

Cada fase termina com verificação de tipos e teste manual das telas tocadas.

## 5. Escopo exato da Fase 1

**Já concluído:** tokens no CSS e no Tailwind, criação do `ui-kit`, remoção de itens duplicados do menu, agrupamento da Sidebar pelas 7 jornadas, busca global (⌘K) disponível também no mobile.

**Pendente nesta fase:**

1. **Unificar os kits.** `src/components/shared/*` passa a reexportar do `ui-kit`, mantendo as mesmas assinaturas para não quebrar os 14 arquivos que já o usam. `shared/PageHeader` deixa de apontar para `EstoquePageHeader`.
2. **Dashboard canônico.** `src/pages/Dashboard.tsx` migra para `AppPage` + `KpiRow`/`KpiCard` + `SectionCard`, com esqueletos de carregamento em todos os widgets e correção dos cortes de texto no mobile.
3. **Listas piloto** migradas para `AppPage` + `FilterBar` + `DataTable` + `StatusPill` + `MoneyText`:
   - `src/pages/vendas/Pedidos.tsx`
   - `src/pages/clientes/CadastroClientes.tsx`
   - `src/pages/financeiro/ContasReceber.tsx`
4. **App Shell.** Ajuste fino de espaçamentos entre Header, conteúdo e barra inferior no mobile, garantindo que nenhuma tela role horizontalmente.

**Fora do escopo da Fase 1:** consolidar dashboards em abas, mexer em cálculos financeiros, alterar regras de negócio ou remover rotas.

**Como validar:** Dashboard, Pedidos, Clientes e Contas a Receber abrem sem erro no desktop e no celular; os números exibidos são idênticos aos de hoje; verificação de tipos passa limpa.

## 6. Observação de segurança

Fora do escopo desta auditoria, permanece 1 alerta de nível *warning* no banco (`ro_ajustes_mensais`: política ampla que depende só da camada restritiva para separar empresas). Posso tratar quando você quiser.
