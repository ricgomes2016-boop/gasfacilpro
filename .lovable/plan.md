## Objetivo
Adicionar a forma de pagamento **Gás do Povo** na tela Nova Venda, exatamente como já funciona no PDV: aparece só quando a unidade tem o programa habilitado, valida que o carrinho é 1× Gás P13 com valor fixo, gera recebível D+2 (taxa 0%) em Contas a Receber e aparece também na Gestão de Cartões com o badge azul "maquininha azulzinha".

## Mudanças

### 1. `src/components/vendas/PaymentSection.tsx` (frontend)
- Importar `useUnidade` e ler `gas_do_povo_habilitado` / `gas_do_povo_valor`.
- Adicionar opção `{ value: "gas_do_povo", label: "Gás do Povo", Icon: Flame, ... }` à lista `formasPagamento`, com paleta **azul (info/primary)** para o atalho rápido e o badge.
- A opção é exibida apenas quando `gas_do_povo_habilitado === true`.
- Adicionar `itens` (carrinho) às `PaymentSectionProps` para validar elegibilidade (1× Gás P13). Reutilizar a mesma checagem do `PDVPayment` (`/g[áa]s\s*p13/i`).
- Em `handleFormaChange("gas_do_povo")` e em `addPagamento()`:
  - Bloquear com toast se carrinho não for elegível.
  - Forçar valor = `gas_do_povo_valor` (default 101.08); rejeitar valor divergente.

### 2. `src/pages/vendas/NovaVenda.tsx` (frontend)
- Passar `itens` como prop ao `<PaymentSection ... itens={itens} />`.

### 3. `src/lib/financeiro/formaPagamento.ts` (frontend)
- Adicionar `"gas_do_povo"` ao tipo `FormaCategoria`.
- `getFormaCategoria`: mapear strings contendo "povo" para `gas_do_povo`.
- `getFormaGrupo`: `gas_do_povo → "a_prazo"`.
- `FORMA_LABELS.gas_do_povo = "Gás do Povo"`.

### 4. `src/pages/financeiro/ContasReceber.tsx` (frontend)
- Adicionar `{ value: "gas_do_povo", label: "Gás do Povo", grupo: "a_prazo" }` em `FORMA_FILTER_OPTIONS`.
- Renderizar badge azul para essa forma (ícone `Flame` + cor `bg-info`/`text-info`) onde os outros badges são desenhados.

### 5. `src/services/paymentRoutingService.ts` (frontend)
- No `case "gas_do_povo"`, **também** inserir uma linha em `conferencia_cartao` para que apareça em Gestão de Cartões:
  - `tipo: "gas_do_povo"` (string nova; conferencia_cartao.tipo é texto livre)
  - `operadora_id: null`, `bandeira: "Gás do Povo"`, `parcelas: 1`
  - `valor_bruto = pag.valor`, `taxa_percentual = 0`, `valor_taxa = 0`, `valor_liquido_esperado = pag.valor`
  - `data_venda = hoje`, `data_prevista_deposito = hoje + 2` (D+2)
  - `status: "pendente"`, `pedido_id`, `unidade_id`
- Manter o insert atual em `contas_receber` (já existe).

### 6. `src/components/financeiro/ConferenciaCartao.tsx` (frontend)
- Onde os badges são renderizados (Créd/Déb), adicionar variante para `tipo === "gas_do_povo"`: texto "Gás do Povo" em badge **azul** (`bg-info/15 text-info`) com ícone `Flame`, mantendo o visual da "maquininha azulzinha".
- Filtros/selects de tipo permanecem como estão (linhas só de leitura; usuário não cria Gás do Povo manualmente daqui).

## Fora do escopo
- Sem mudança de schema (`conferencia_cartao.tipo` é text livre, aceita o novo valor).
- Sem mudança de RLS.
- Sem alteração na tela do entregador, PDV, Acerto, etc — esses já tratam Gás do Povo.