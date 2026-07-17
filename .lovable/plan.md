
# Ajuste Fino Profissional — Todo o ERP

**Objetivo:** elevar o padrão visual de todas as páginas internas ao nível "premium" do Dashboard principal, sem tocar em nenhuma lógica de negócio, query, RLS ou mutation.

**Referência-ouro:** Dashboard principal + páginas de Estoque já refatoradas (`EstoqueKpiCard`, `EstoquePageHeader`, `EstoqueEmptyState`).

---

## 1. Diagnóstico dos 4 problemas priorizados

| Problema | Sintoma atual | Solução |
|---|---|---|
| Card dentro de Card | `<Card><CardContent><Card>...</Card></CardContent></Card>` cria bordas duplicadas e sombras somadas | Achatar: só o container externo é `Card`; blocos internos viram `<div>` com `space-y-*` ou grid |
| Espaçamento inconsistente | Páginas usam `p-2`, `p-4`, `p-6`, `space-y-3`, `space-y-6` misturados | Padrão único: página `p-4 md:p-6 space-y-6`, card `p-4`, seções internas `space-y-4` |
| Tipografia sem hierarquia | Títulos, subtítulos e labels com pesos/tamanhos aleatórios | Escala fixa: H1 `text-xl font-semibold`, H2 `text-lg font-semibold`, label `text-sm text-muted-foreground`, KPI `text-2xl font-bold` |
| Cores/badges/ícones fora do padrão | `bg-chart-2/10`, `text-green-600`, cores hex hardcoded | Só tokens semânticos: `primary`, `success`, `warning`, `destructive`, `info`, `muted` (via `EstoqueKpiCard` tone) |

---

## 2. Componentes compartilhados a promover (globais)

Renomear e mover para uso global (fora de `/estoque`):

```text
src/components/shared/
  ├─ KpiCard.tsx          (ex-EstoqueKpiCard)
  ├─ PageHeader.tsx       (ex-EstoquePageHeader)
  ├─ EmptyState.tsx       (ex-EstoqueEmptyState)
  ├─ SectionCard.tsx      (novo: Card + CardHeader padrão, sem aninhar)
  └─ FilterBar.tsx        (novo: barra de filtros flex-col sm:flex-row)
```

Os componentes atuais em `/estoque` viram re-exports para não quebrar imports.

---

## 3. Padrão de layout de página (aplicado em TODAS)

```text
<MainLayout>
  <Header title=… subtitle=… />
  <div className="p-4 md:p-6 space-y-6">
    <PageHeader title=… description=… actions={…} />   ← seção contextual
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KpiCard … />  <KpiCard … />  …                  ← KPIs (nunca Card>Card)
    </div>
    <FilterBar>…</FilterBar>                            ← filtros (opcional)
    <SectionCard title=… icon=…>                        ← conteúdo principal
      <Table … />                                        (direto, sem Card interno)
    </SectionCard>
  </div>
</MainLayout>
```

---

## 4. Escopo — módulos a varrer

Ordem de execução (do mais usado ao menos usado):

1. **Vendas** — PedidosKanban, Devolucoes, VendedorNovaVenda, CelulaMesEditavel
2. **Financeiro** — Todas as páginas em `src/pages/financeiro/`
3. **Clientes** — CRM, Campanhas, ContratosRecorrentes, Fidelidade, GestaoCredito, RankingClientes
4. **Operacional** — dashboards (TrabalhistaContent, etc.) e demais telas
5. **Fiscal** — DashboardFiscal, EmitirCTe, EmitirMDFe, RelatoriosNotas
6. **Frota** — AnaliseFrotaIA, ChecklistSaida, DocumentosFrota, Gamificacao, RelatoriosFrota
7. **RH** — todas em `src/pages/rh/`
8. **Marketing** — DashboardMarketing, AtendimentoIA, CampanhasWhatsApp
9. **Integrações + Config** — páginas em `src/pages/integracoes/` e `src/pages/config/`
10. **Admin** — AdminDashboard, AdminAdmins, AdminBiaVoz, etc.
11. **Contador** — ContadorHome, ContadorEmpresas, ContadorCalendario, etc.
12. **Cadastros** — via `cadastrosRoutes`

**Fora de escopo:** telas públicas (`/centralgascp`, landing), portais externos (cliente/entregador/vendedor/transportadora/parceiro), fluxos de auth. Se sobrar tempo, faço passada leve neles.

---

## 5. Regras invioláveis

- ❌ NÃO mexer em queries, mutations, RLS, edge functions, `unidade_id`/`empresa_id`
- ❌ NÃO trocar libs, rotas, providers, `App.tsx`, `MainLayout`
- ❌ NÃO renomear props de componentes de negócio (Dialogs, formulários)
- ❌ NÃO alterar comportamento de botões, filtros, submits
- ✅ SÓ visual: JSX estrutural, className, extração de subcomponentes visuais

---

## 6. Verificação por lote

A cada 3-4 páginas refatoradas:
- `tsgo` (typecheck) tem que passar
- Grep para garantir: nenhum `Card` dentro de `CardContent`; nenhum `text-green-600`/`bg-chart-*` hardcoded; nenhum `p-2`/`p-3` solto em página
- Playwright headless: abrir a rota, printar, comparar hierarquia visual com Dashboard

---

## 7. Entrega

- 1 commit por módulo (Vendas, Financeiro, Clientes, …) para facilitar reversão
- Ao final: changelog resumido dos módulos tocados e nenhum arquivo de lógica alterado

---

## Detalhe técnico (para referência)

- **Cores semânticas** já definidas em `index.css`: `--primary`, `--success`, `--warning`, `--destructive`, `--info`, `--muted-foreground`, `--card`, `--border`. Usar sempre via classes Tailwind (`bg-success/10 text-success`), nunca hex.
- **Grid responsivo**: `grid-cols-2 md:grid-cols-4` para KPIs; `grid-cols-1 lg:grid-cols-3` para conteúdo largo. Sempre com `min-w-0` conforme `.lovable/responsive-rules.md`.
- **Tabelas**: header `text-xs uppercase text-muted-foreground`, linhas `hover:bg-muted/50`, badges de status usando tones semânticos.
- **Botões de ação**: no slot `actions` do `PageHeader`, `size="sm"` para secundários, default para primário.
