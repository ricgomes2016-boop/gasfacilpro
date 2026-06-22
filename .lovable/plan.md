## Portal da Operadora de Cartão — Layout estilo PagBank/Stone

Reformular `OperadoraCartaoDetalhe.tsx` para que ao abrir uma operadora, o usuário veja uma **home da operadora** com cards de acesso rápido (estilo portal real), e cada card abra sua respectiva seção operacional.

### 1. Home da operadora (nova aba "Início")

Logo abaixo do header branded da operadora, grid de **6 cards de acesso rápido** (2 col mobile / 3 col tablet / 6 col desktop), cada um com ícone, título e métrica resumo:

```text
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ Vendas  │Recebíve.│  Taxas  │Relatório│Conferên.│Maquinin.│
│ R$ X,XX │ R$ X,XX │ 2.99%   │   📊    │  ⚖️     │  2 ativ.│
│  hoje   │ a receb │ débito  │         │         │         │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

Cards usam `operatorGradient` suave + hover lift. Cada card é um botão que muda a aba ativa do `Tabs`.

### 2. Abas reorganizadas

Substitui as 3 abas atuais (Recebíveis/Conferência/Relatório) por **7 abas**:

- **Início** — grid de cards de acesso rápido + KPIs do mês (vendido, recebido, a receber, taxas pagas).
- **Vendas** — *novo* `VendasOperadoraTab`. Tabela `pagamentos_cartao` filtrada por `operadora_id`, colunas: **Data | Descrição (pedido/cliente/bandeira/parcelas) | Valor da venda (`valor_bruto`) | Valor líquido (`valor_liquido`)**. Filtros por período, busca, export CSV, paginação client-side, ordem desc por `created_at`.
- **Recebíveis** — *novo* `RecebiveisOperadoraTab` em 2 colunas:
  - **Recebido** (`liquidado = true`) — tabela: Data liquidação | Descrição | Bruto | Taxa | Líquido | Conta destino.
  - **A receber** (`liquidado = false`) — tabela: Previsão | Descrição | Bruto | Taxa | Líquido | Status. Totais no topo de cada coluna. Mantém `RecebiveisPipeline` como subview opcional.
- **Taxas** — *novo* `TaxasOperadoraTab`. Exibe e permite editar as taxas (`taxa_debito`, `taxa_credito_vista`, `taxa_credito_parcelado`, `taxa_pix`) e prazos (`prazo_debito`, `prazo_credito`, `prazo_pix`) da operadora — formulário direto sem dialog.
- **Relatórios** — *novo* `RelatoriosOperadoraTab` com 3 sub-relatórios em segmented control:
  1. **O que vendi** — agregação por período (dia/semana/mês), gráfico + tabela, export.
  2. **O que vou receber** — projeção por data de liquidação futura.
  3. **Recebido** — histórico de liquidações por período.
  Reaproveita `PagamentosCartaoRelatorio` filtrado por `operadoraId`.
- **Conferência** — `ConferenciaCartao` existente + reforço do fluxo de import:
  - Botão destaque "Importar relatório PDF" (PagBank/Stone/Cielo) usando edge function `parse-extrato-pdf`.
  - Após import, view de **comparação lado a lado**: linhas do PDF × linhas de `pagamentos_cartao` no mesmo período, com status `conferido / divergente / faltante`. Ações de match manual e marcar como conferido.
- **Maquininhas** — *novo* `MaquininhasOperadoraTab`. Lista `terminais_cartao` filtrada por `operadora_id`: serial, modelo, loja/unidade, status, última transação. CRUD básico.

### 3. Detalhes técnicos

- Tabs controladas (`useState` para `activeTab`) para que os quick cards naveguem entre seções.
- Novos componentes em `src/components/financeiro/operadora-detalhe/`:
  - `QuickAccessGrid.tsx`
  - `VendasOperadoraTab.tsx`
  - `RecebiveisOperadoraTab.tsx`
  - `TaxasOperadoraTab.tsx`
  - `RelatoriosOperadoraTab.tsx`
  - `MaquininhasOperadoraTab.tsx`
- Queries `react-query` por aba (lazy: só roda quando a aba ativa) com `keyQuery` incluindo `operadoraId` + filtro de período.
- Ordenação default: **data desc** (mais recente no topo) em todas as tabelas, com toggle.
- Sem alterações de schema. Sem alterações em RLS. Sem mexer em `App.tsx` nem rotas.
- Mantém isolamento por unidade já existente em `pagamentos_cartao` (RLS).
- Formatação de data via split de string `YYYY-MM-DD` para evitar shift de timezone (mesmo padrão aplicado no extrato bancário).

### 4. Fora de escopo

- Integração real-time com APIs PagBank/Stone/Cielo (mantém import manual via PDF).
- Alteração em `pagamentos_cartao`, `terminais_cartao`, `conferencia_cartao` ou migrações de banco.
- Mudanças no card da operadora em `GestaoCartoes.tsx`.
