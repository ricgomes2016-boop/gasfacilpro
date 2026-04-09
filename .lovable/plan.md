

## Plano: Correção de Responsividade Mobile em Todo o Sistema

### Problema
O sistema ERP possui dezenas de páginas e modais que não estão otimizados para telas de celular (384px viewport). Os principais problemas são:
- Tabelas sem versão mobile (cards) em muitas páginas
- Dialogs/modais que excedem a tela do celular
- Botões e filtros que transbordam horizontalmente
- Grids que não colapsam em telas pequenas
- Textos truncados ou cortados

### Escopo da Correção

Dado o tamanho do projeto (72+ arquivos com dialogs, 16+ com tabelas), a correção será feita em fases priorizadas:

---

**Fase 1 — Páginas mais usadas (críticas)**

1. **Dialogs globais** — Garantir que todos os `DialogContent` com `max-w-2xl`, `max-w-xl`, `max-w-lg` tenham `w-[95vw]` ou `sm:max-w-*` para não cortar em mobile
2. **Pedidos (Pedidos.tsx)** — Converter tabela para cards mobile (já tem `hidden md:table-cell` mas falta card view completa como em CadastroClientes)
3. **Nova Venda (NovaVenda.tsx)** — Ajustar barra de IA, botões de ação, e stepper para mobile
4. **Contas a Pagar/Receber** — Adicionar mobile cards para as tabelas
5. **Dashboard** — Ajustar grid de stats de 7 colunas para 2 em mobile
6. **Estoque pages** — Mobile cards para tabelas

**Fase 2 — Dialogs e Formulários**

7. **Todos os formulários em Dialog** — Garantir `max-h-[90vh] overflow-y-auto` e grids `grid-cols-1 sm:grid-cols-2`
8. **NovaVendaModal** — Já ocupa tela cheia, OK
9. **Filtros em todas as páginas** — Garantir collapse em coluna no mobile

**Fase 3 — Páginas secundárias**

10. **Financeiro (DRE, Fluxo de Caixa, Balanço)** — Scroll horizontal com indicador
11. **Frota, RH, Fiscal** — Mobile cards para tabelas
12. **Configurações e Integrações** — Ajustar layouts de cards

---

### Detalhes Técnicos

**Padrão de Dialog responsivo:**
```tsx
// Antes
<DialogContent className="max-w-2xl">
// Depois
<DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
```

**Padrão de tabela com mobile cards:**
```tsx
{/* Mobile cards */}
<div className="space-y-3 md:hidden">
  {items.map(item => <MobileCard key={item.id} />)}
</div>
{/* Desktop table */}
<div className="hidden md:block overflow-x-auto">
  <Table>...</Table>
</div>
```

**Padrão de grid responsivo:**
```tsx
// Antes
<div className="grid grid-cols-4 gap-4">
// Depois  
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
```

### Arquivos Principais a Editar (~25-30 arquivos)
- `src/pages/vendas/Pedidos.tsx` — adicionar mobile cards
- `src/pages/financeiro/ContasPagar.tsx` — mobile cards + dialog fix
- `src/pages/financeiro/ContasReceber.tsx` — mobile cards + dialog fix  
- `src/pages/caixa/Despesas.tsx` — mobile cards
- `src/pages/caixa/CaixaDia.tsx` — mobile cards
- `src/pages/estoque/HistoricoMovimentacoes.tsx` — mobile cards
- `src/pages/estoque/Comodatos.tsx` — mobile cards
- `src/pages/vendas/Devolucoes.tsx` — mobile cards
- `src/pages/vendas/RelatorioVendas.tsx` — mobile cards
- `src/pages/frota/Manutencao.tsx` — dialog fix
- `src/pages/frota/Combustivel.tsx` — dialog fix
- `src/pages/rh/FolhaPagamento.tsx` — mobile cards + dialog fix
- `src/pages/rh/AvaliacaoDesempenho.tsx` — dialog fix
- `src/pages/Integracoes.tsx` — dialog fixes
- `src/pages/Dashboard.tsx` — grid ajustes
- `src/pages/operacional/DRE.tsx` — scroll indicator
- + outros conforme necessário

### Estimativa
Devido ao volume (30+ arquivos), a implementação será feita em 2-3 rodadas, priorizando as telas que o usuário mais usa: Pedidos, Nova Venda, Clientes (já OK), Financeiro e Dashboard.

