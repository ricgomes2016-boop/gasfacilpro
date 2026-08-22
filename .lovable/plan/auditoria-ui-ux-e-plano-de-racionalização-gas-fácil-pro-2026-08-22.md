# Auditoria UI/UX e Plano de Racionalização — Gas Fácil Pro

Auditoria somente de leitura. Nenhum arquivo de código foi alterado.

## 1. Inventário quantificado

Números medidos no repositório atual:

| Métrica | Valor |
|---|---|
| Páginas (`src/pages/**/*.tsx`) | 294 |
| Componentes (`src/components/**/*.tsx`) | 310 |
| Rotas declaradas (21 arquivos em `src/routes`) | ~256 |
| Itens de menu folha em `menuItems.ts` | 138 |
| Grupos de 1º nível na sidebar | 15 |
| Páginas cujo nome é "Dashboard/Cockpit/Central" | 21 |
| Arquivos que importam `MainLayout` | 169 |
| Arquivos que importam `layout/Header` | 161 |
| Arquivos que importam algo de `components/shared` | 14 |
| Páginas que montam header próprio com `<h1>` | 70 |
| Páginas que usam `components/ui/card` diretamente | 247 |
| Arquivos com cor hardcoded (`text-white`, `bg-[#...]`) | 100 |

### Duplicações concretas

**Cards de KPI — 5 implementações paralelas**
`shared/KpiCard.tsx`, `dashboard/StatCard.tsx` (0 imports — morto), `dashboard/premium/PremiumKpiCard.tsx` (10 usos), `estoque/EstoqueKpiCard.tsx` (9 usos), `transportadora/compras/CompraisKpiToneladas.tsx`.

**Cabeçalho de página — 3 caminhos**
`shared/PageHeader.tsx` é apenas um re-export de `estoque/EstoquePageHeader` (10 usos); 70 páginas montam `<h1>` manualmente; `layout/Header` é usado em 161 páginas com props livres.

**Dashboards sobrepostos (mesma audiência, métricas repetidas)**
`/dashboard`, `operacional/DashboardExecutivo`, `operacional/CockpitGestor`, `operacional/CentralIndicadores`, `operacional/DashboardAvancado`, `operacional/DashboardLogistico` — 6 telas de visão gerencial.
Resultado x DRE x Relatório: `AnaliseResultados`, `ResultadoOperacional`, `DRE`, `RelatorioGerencial`, `vendas/lucratividade`, `PontoEquilibrio` — 6 telas de rentabilidade.
Planejamento: `Planejamento`, `PlanejamentoAnual`, `PlanejamentoMensal`, `MetasDesafios` — 4 telas.
Mapa: `MapaOperacional` e `MapaEntregadores` — 2 telas.

**Financeiro — 32 rotas em um único menu**
Fluxo de caixa em 4 variantes (`FluxoCaixa`, `FluxoCaixaConsolidado`, `FluxoCaixaProjetado`, `PrevisaoCaixa`). Cartões em 5 telas (`GestaoCartoes`, `PagamentosCartao`, `TerminaisCartao`, `Conciliacao`, `OperadoraCartaoDetalhe`). Vale Gás em 6 telas.

**Navegação com defeitos de higiene**
`/marketing/redes-sociais` aparece 2x no mesmo submenu. Rótulo "Dashboard" repetido em 6 grupos, "Fornecedores" em 2 grupos apontando para rotas diferentes (`/operacional/fornecedores` e `/cadastros/fornecedores`), "Campanhas" em 2 grupos (marketing e WhatsApp). "WhatsApp" existe como grupo próprio e também dentro de Atendimento e de Configurações (4 entradas de WhatsApp em Configurações). Um item do RH é um link externo direto para um APK no GitHub.

**Custo cognitivo**: para chegar a uma tela típica o usuário abre 1 de 15 grupos e escolhe entre até 19 itens; o financeiro sozinho tem 19 itens visíveis e 32 rotas.

## 2. Arquitetura de informação por jornadas

Reduzir de 15 grupos / 138 itens para **7 áreas / ~45 itens de 1º nível**, com o resto acessível por abas dentro da tela e por busca global (Cmd+K).

```text
1. Início            visão do dia (KPIs, alertas, atalhos)
2. Vender            PDV · Nova venda · Pedidos (lista+kanban) · Devoluções · Clientes
3. Entregar          Rotas · Mapa · Entregadores · SLA · Frota
4. Estocar           Estoque do dia · Conferência · Compras · Produtos · Transferências
5. Receber & Pagar   Contas a receber · Contas a pagar · Caixa do dia · Cartões · Bancos · Vale Gás
6. Analisar          Resultado (DRE + lucratividade + ponto de equilíbrio) · Vendas · Metas · Relatórios
7. Configurar        Empresa/Unidades · Usuários & Permissões · Integrações · Fiscal · RH · Marketing
```

Regras de consolidação (sem excluir rotas):
- Telas sobrepostas viram **abas de uma tela canônica**; as rotas antigas passam a redirecionar para `/tela?tab=x`.
- Relatórios saem do menu principal e passam para uma **Central de Relatórios** com busca.
- Tudo que é setup deixa de ficar no fluxo operacional e vai para Configurar.
- Busca global (Cmd+K / botão no header) indexa as 256 rotas, então nada fica inacessível mesmo saindo do menu.

## 3. Design system canônico

**Tokens** (em `index.css`, sem cores hardcoded em componentes): superfícies (`--surface`, `--surface-raised`, `--surface-sunken`), texto (`--fg`, `--fg-muted`, `--fg-subtle`), semânticos financeiros (`--positive`, `--negative`, `--warning`, `--info`), bordas/raios (`--radius-card`, `--radius-control`), sombras em 3 níveis, escala de espaçamento 4/8/12/16/24/32, escala tipográfica de 6 tamanhos (Plus Jakarta Sans, mantida).

**Componentes canônicos** (um de cada, em `src/components/ui-kit/`):
`AppPage` (header + breadcrumb + ações + conteúdo), `PageHeader`, `KpiCard` (substitui as 5 variantes), `KpiRow`, `DataTable` (colunas, ordenação, paginação, estados vazio/carregando, render mobile em cards), `FilterBar`, `SectionCard`, `StatusPill`, `EmptyState`, `LoadingState`, `MoneyText`, `FormLayout`, `ResponsiveDialog` (já existente, adotado como padrão).

Regras: nenhum card dentro de card; um único nível de elevação por tela; toda tabela usa `DataTable`; toda tela usa `AppPage`; valores monetários sempre por `MoneyText` com token semântico.

## 4. Migração incremental sem quebra

- Nada de mexer em `App.tsx`, na composição de providers ou em rotas existentes (regra de estabilidade do projeto). O menu muda; as rotas permanecem.
- `menuItems.ts` ganha metadados (`area`, `journey`, `hidden`, `aliasOf`) — a nova IA é uma reordenação/derivação desse arquivo, não uma reescrita de rotas.
- Componentes antigos (`EstoqueKpiCard`, `PremiumKpiCard`) viram wrappers finos sobre os canônicos, então as 19 telas que os usam continuam funcionando sem edição.
- Consolidação de telas sempre por abas + redirect, nunca por remoção de rota.
- Ordem de risco: shell e componentes primeiro, telas de listagem depois, telas financeiras por último.
- Verificação a cada fase: build + typecheck, e conferência visual de Dashboard, Pedidos, Estoque do Dia, Contas a Receber em desktop e mobile.

## 5. Fase 1 — escopo exato

**Objetivo**: App Shell + Dashboard + padrão de lista, sem tocar em lógica de negócio.

1. **Tokens**: bloco de tokens novos em `index.css` e mapeamento no `tailwind.config.ts` (adição, sem remover token existente).
2. **Higiene de navegação** em `menuItems.ts`: remover a entrada duplicada de Redes Sociais, unificar os dois "Fornecedores", tirar as 4 entradas de WhatsApp de Configurações para uma só, mover o link do APK para dentro da tela de RH. Adicionar campo `area` a cada grupo agrupando os 15 grupos nas 7 áreas.
3. **Sidebar**: renderizar por área com os grupos colapsáveis, item ativo destacado, largura 260px mantida, sem alterar contrato do `SidebarContext`.
4. **Header**: título/subtítulo/breadcrumb padronizados + campo de busca global (Cmd+K) navegando entre as rotas existentes.
5. **MobileBottomBar**: manter os 5 destinos atuais; alinhar ícones e área de toque ao novo token de espaçamento.
6. **Novos componentes canônicos** criados em `src/components/ui-kit/`: `AppPage`, `PageHeader`, `KpiCard`, `KpiRow`, `DataTable`, `FilterBar`, `SectionCard`, `StatusPill`, `EmptyState`, `MoneyText`. `EstoqueKpiCard` e `PremiumKpiCard` passam a reexportar `KpiCard`.
7. **Dashboard (`/dashboard`)**: reconstruir usando `AppPage` + `KpiRow`, hierarquia financeira clara, um só nível de card, sem alterar hooks/queries de dados.
8. **Listas piloto** migradas para `DataTable`: `vendas/Pedidos`, `clientes/CadastroClientes`, `financeiro/ContasReceber`.

**Fora da Fase 1**: consolidação dos 6 dashboards gerenciais, reorganização do financeiro em abas, Central de Relatórios, RH/Fiscal/Marketing — ficam para as fases 2 a 4.

**Critério de aceite**: build e typecheck limpos; Dashboard, Pedidos, Clientes e Contas a Receber com mesmo cabeçalho, mesmo card de KPI e mesma tabela; nenhuma rota removida; nenhum número financeiro alterado.
