
## Plano: Auditoria e correção de responsividade mobile no ERP

### Escopo
Revisar sistematicamente as principais telas do ERP em viewport mobile (375px) e corrigir quebras de layout, overflow horizontal, elementos desalinhados e tabelas que vazam.

### Áreas a auditar (prioridade)

**1. Telas de Vendas/Pedidos** (já parcialmente corrigidas)
- `/vendas` (lista) — verificar tabela de pedidos
- `/vendas/nova` — confirmar correções anteriores
- `/vendas/editar/:id` — confirmar correções anteriores
- Modais relacionados (NovaVendaModal, detalhes de pedido)

**2. Telas de Cadastros**
- `/clientes` — tabela, busca, modal de cadastro
- `/produtos` — tabela, modal de cadastro
- `/fornecedores`, `/funcionarios`

**3. Telas Financeiras**
- `/financeiro/contas-receber`, `/financeiro/contas-pagar` — tabelas longas
- `/financeiro/caixa` — fechamento, lançamentos
- `/financeiro/dre` — relatórios com muitas colunas

**4. Operacional**
- `/operacional/rotas` — cards de carregamento
- `/operacional/mapa` — Leaflet em mobile
- `/estoque` — tabela de estoque por unidade

**5. Dashboard e widgets**
- `/` (Dashboard) — grids de widgets, gráficos Recharts

**6. Componentes globais**
- `Header` (título + ações)
- `Sidebar` mobile (já tem MobileBottomBar)
- Dialogs/Drawers (ResponsiveDialog já implementado)

### Padrões de correção a aplicar

1. **Tabelas largas**: envolver em `<div className="overflow-x-auto">` para scroll interno; ocultar colunas secundárias com `hidden sm:table-cell`.
2. **Grids com muitas colunas**: trocar `grid-cols-N` por `grid-cols-1 sm:grid-cols-2 md:grid-cols-N`.
3. **Flex rows com inputs/botões**: adicionar `flex-wrap` + `min-w-0` nos filhos + `shrink-0` em botões.
4. **Headers com título + ações**: usar `flex-col sm:flex-row gap-2`.
5. **Cards de KPI**: garantir `min-w-0` e truncar valores longos.
6. **Gráficos Recharts**: usar `ResponsiveContainer` com altura fixa e largura 100%.
7. **Inputs de busca/filtro**: container com `flex-wrap` e larguras mínimas explícitas.
8. **Padding consistente**: `p-3 sm:p-4 md:p-6` em containers de página.
9. **Overflow global**: garantir `overflow-x-hidden` no `<main>` (já presente no `MainLayout`).

### Metodologia de execução

1. **Auditoria visual com browser** em viewport 375x812:
   - Navegar pelas rotas principais autenticado
   - Tirar screenshots
   - Identificar elementos que vazam ou quebram
2. **Correções incrementais** por arquivo, priorizando telas mais usadas
3. **Re-validação** com novo screenshot após cada fix
4. **Documentar padrões** em `mem://ui/mobile-responsiveness-standard-erp` se surgirem novas convenções

### Arquivos prováveis (não exaustivo)
- `src/pages/vendas/Vendas.tsx`
- `src/pages/clientes/Clientes.tsx`, `Cadastro.tsx`
- `src/pages/produtos/Produtos.tsx`
- `src/pages/financeiro/ContasReceber.tsx`, `ContasPagar.tsx`, `Caixa.tsx`, `DRE.tsx`
- `src/pages/operacional/GestaoRotas.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/layout/Header.tsx`
- Componentes de tabela e cards reutilizados

### Entregável
Telas principais do ERP funcionando em viewport mobile (≥360px) sem overflow horizontal, com elementos alinhados e legíveis. Após implementar, validarei com screenshots em 375px de cada rota corrigida.

### Observação importante
Como o escopo é amplo, vou priorizar as **telas mais críticas/usadas** primeiro (Vendas, Clientes, Financeiro, Dashboard). Telas administrativas raramente acessadas no mobile (configurações avançadas) ficam em segunda prioridade. Se preferir focar em telas específicas, me avise antes de aprovar.
