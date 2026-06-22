## Objetivo

Refatorar a aba **OFX** dentro do detalhe da conta bancária para ficar visualmente igual à aba **Extrato Bancário**, escopada na conta aberta, com importação de OFX e ações em lote por checkbox.

## O que muda

### 1. Novo componente `OfxPanel.tsx`
Criar `src/components/financeiro/conta-detalhe/OfxPanel.tsx` (substitui o uso de `Conciliacao` na aba OFX do `ContaBancariaDetalhe.tsx`). Não mexer no `Conciliacao.tsx` (continua sendo usado em outros lugares).

### 2. Escopo
- Sempre vinculado à `conta_bancaria_id` da conta atual (recebida por prop).
- Remover seletor "Conta para Importação" — usa a conta atual automaticamente.
- Remover filtro "Filtrar Extrato por Conta" — não faz sentido aqui.
- Query do extrato filtra por `conta_bancaria_id = conta atual` (e `unidade_id`).

### 3. Topo (cabeçalho compacto)
- Botão **Importar OFX** (e CSV opcional).
- Botão **Reconciliar Automaticamente**.
- **Filtro de status** em segmented control (chips): `Todos · Conciliados · Pendentes`. Substitui os 4 cards (Lançamentos / Conciliados / Pendentes / Saldo), que serão removidos para não ocupar espaço. Ao lado dos chips, mostra contador discreto em texto pequeno (ex: `12 lançamentos · R$ 3.450,00`).

### 4. Tabela no padrão do Extrato Bancário
Colunas:
| ☐ | Data | Descrição | Entrada | Saída | Total (acumulado) | Status | Ações |

- Checkbox por linha + checkbox "selecionar todos" no header.
- Entrada/Saída = `valor` positivo/negativo.
- Total = saldo acumulado no estilo de `ExtratoTabela`.
- Status: badge "Conciliado" / "Pendente" + nome do pedido vinculado, se houver.
- Ações por linha: `Vincular` (abre dialog de pedido) e `Conciliar` (marca conciliado sem pedido) — mantém o dialog atual.

### 5. Ações em lote (quando há linhas marcadas)
Barra fina aparece acima da tabela quando `selected.size > 0`:
- `N selecionados`
- Botão **Conciliar selecionados** → marca `conciliado=true` em todos.
- Botão **Desfazer vínculo** → seta `pedido_id=null, conciliado=false` nos selecionados.
- Botão **Limpar seleção**.

Vinculação a pedido permanece individual (1 lançamento → 1 pedido), via dialog já existente.

### 6. `ContaBancariaDetalhe.tsx`
- Substituir `<Conciliacao embedded contas=[...]/>` da `TabsContent value="ofx"` por `<OfxPanel contaId={conta.id} unidadeId={conta.unidade_id} accentColor={theme.primary} />`.

## Detalhes técnicos

- Reaproveitar lógica de parse OFX/CSV copiando de `Conciliacao.tsx` (apenas as funções `parseOFX` e `parseCSV`).
- Tabela `extrato_bancario` já tem `conta_bancaria_id` — usar.
- Mutations: `conciliarLote(ids[])`, `desvincularLote(ids[])`, `vincularPedido` (individual). Usar `.in('id', ids)` em update.
- React Query: `["extrato_ofx_conta", contaId, statusFilter]`.
- Nenhuma alteração de banco de dados.
- A aba OFX só aparece para contas que NÃO são Caixa (regra já existente da última iteração).