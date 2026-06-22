## Gestão de Cartões — redesign no padrão "portal da operadora"

Espelhar a experiência de **Contas Bancárias → Conta Detalhe** para o módulo de cartões. Hoje `GestaoCartoes.tsx` mostra abas globais (Recebíveis, Relatório, Operadoras) misturando dados de todas as operadoras. Vamos transformar em uma **lista de cards bonitos por operadora** + uma **página de detalhe da operadora** com abas internas, como se fosse o portal da PagBank / Stone / Cielo.

### 1. Página principal `/financeiro/cartoes` (GestaoCartoes.tsx — reescrita)

Estrutura igual a `ContasBancarias.tsx`:

- Header: "Gestão de Cartões" / "Clique em uma operadora para abrir o portal".
- Linha de ações:
  - Botão primário **+ Operadora** (abre dialog de cadastro — reaproveita o form que hoje vive dentro de `ConferenciaCartao.tsx`: nome, bandeira, taxas débito/crédito à vista/parcelado/pix, prazos, unidade).
  - Botão secundário **Importar extrato (CSV/OFX)** — opcional, abre seletor de operadora.
- **Grid de cards de operadora** (filtrados por `unidade_id = unidadeAtual`), 1/2/3 colunas:
  - Header colorido com gradiente da marca (novo `cardOperatorThemes.ts` espelhando `bankThemes.ts`): PagBank, PagSeguro, Stone, Cielo, Rede, GetNet, SafraPay, Mercado Pago, SumUp, Ton, InfinitePay + fallback.
  - Avatar com iniciais, nome da operadora, bandeira.
  - Métricas em destaque calculadas em paralelo (1 query agregada via `pagamentos_cartao` da operadora): **A receber (pendentes)** e **Recebido no mês**.
  - Rodapé com badges (taxa débito / crédito / prazo D+) e ícone de editar (mesmo padrão do card de banco).
  - Clique no card → `navigate('/financeiro/cartoes/:id')`.
- Empty state com CTA "Nova operadora".

### 2. Nova rota `/financeiro/cartoes/:id` — `OperadoraCartaoDetalhe.tsx`

Header em gradiente da marca + abas internas (`Tabs`) reaproveitando os componentes existentes filtrados pela operadora:

| Aba | Componente | Origem |
|---|---|---|
| Visão geral | novo `OperadoraVisaoGeralPanel` | KPIs: a receber hoje, D+1, D+30, recebido mês, taxa efetiva |
| Recebíveis | `<RecebiveisPipeline operadoraId={id} />` | hoje existe sem filtro — adicionar prop opcional |
| Conferência | `<ConferenciaCartao operadoraId={id} hideOperadoraSelector />` | esconder o seletor de operadora interno |
| Relatório | `<PagamentosCartaoRelatorio operadoraId={id} />` | filtrar por operadora |
| Registrar | reaproveita o dialog "Novo lançamento" do `ConferenciaCartao` em modo embutido | pré-seleciona a operadora |
| Importar | novo `ImportarCartaoPanel` (CSV/OFX da operadora — análogo ao `OfxPanel` dos bancos) com checkboxes para vincular em massa a `pagamentos_cartao` pendentes |
| Configurações | form de edição da operadora (taxas, prazos, bandeira) | extraído do dialog atual |

Padrão de "quick shortcuts" (mesmos cards-atalho do detalhe de banco) no topo: Visão, Recebíveis, Conferência, Importar.

### 3. Pesquisa — convenções dos portais das operadoras

Modelando após PagBank Conta PJ, Stone Portal, Cielo LIO, Rede Admin e GetNet:

- **Home** = saldo a receber + próximos recebíveis + alertas.
- **Recebíveis** = pipeline por data com filtros bandeira/forma/terminal.
- **Extratos / Conciliação** = importar arquivo (CNAB / OFX / CSV) e bater contra vendas.
- **Relatórios** = vendas, taxas pagas, antecipações.
- **Maquininhas/Terminais** = link p/ `TerminaisCartao` filtrado.
- **Configurações** = taxas, contas de liquidação, antecipação.

A nossa adaptação cobre Home (Visão), Recebíveis, Conferência (conciliação), Importar (extrato), Relatório, Registrar e Configurações — mantendo paridade com o que esses portais oferecem, sem inventar features que dependeriam de integração real com a operadora.

### Detalhes técnicos

- Novo arquivo `src/lib/cartoes/operatorThemes.ts` com `getOperatorTheme(nome)` e `operatorGradient`, mesmas APIs do `bankThemes`.
- Nova rota em `src/routes/financeiroRoutes.ts`: `cartoes/:id` → `OperadoraCartaoDetalhe`.
- Novo diretório `src/components/financeiro/operadora-detalhe/` com `QuickShortcuts.tsx`, `VisaoGeralPanel.tsx`, `ImportarCartaoPanel.tsx`, `OperadoraConfigPanel.tsx`.
- Refatorar `RecebiveisPipeline`, `ConferenciaCartao`, `PagamentosCartao` para aceitar prop opcional `operadoraId` (filtro `.eq('operadora_id', id)`); quando ausente, comportamento atual preservado — sem mudar a lógica de negócio.
- `GestaoCartoes.tsx` reescrita seguindo 1:1 o layout de `ContasBancarias.tsx` (form + grid + dialogs).
- Cards de métricas removidos do topo (lançamentos / conciliados / pendentes / saldo) — viram filtros/abas dentro do detalhe da operadora, mesmo princípio aplicado ao OFX dos bancos.
- Saldo "a receber" do card é calculado client-side a partir de `pagamentos_cartao` (status pendente) para evitar nova coluna.

### Fora de escopo

- Integração real com APIs das operadoras (PagBank/Stone/Cielo). O painel imita o portal mas continua operando sobre nossos próprios dados.
- Mudanças em `terminais_cartao`, `conferencia_cartao` schema, ou novas migrations.
