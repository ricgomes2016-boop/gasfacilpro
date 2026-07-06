## Objetivo

Corrigir a aba **Movimentações** do Caixa do Dia — tabela "Movimentações do Dia" e cards **Entradas / Saídas / Saldo do Dia** — para que toda movimentação de dinheiro apareça uma única vez e o total bata com a realidade.

---

## Diagnóstico (dados reais checados na base)

Checagem no banco na unidade atual (Central Gás), dia 06/07/2026:

- **15** movimentações de caixa deveriam aparecer (13 "Venda Dinheiro" + 2 "Vale Ultragaz/Central"), somando **R$ 2.206** de entradas em dinheiro.
- Existe **duplicidade real**: o pedido `290baa1f-…` gerou 2 registros em `movimentacoes_caixa`. Vários "Venda #187", "Venda #116", "Venda #113"… aparecem 2× no mesmo dia com o mesmo `pedido_id` e mesmo valor. Isso infla o total e polui a tabela.
- Existem `movimentacoes_caixa` de venda em dinheiro sem `pedido` correspondente na tabela `pedidos` do dia — sinal de reprocessamento (`rotearPagamentosVenda` sendo chamado mais de uma vez para o mesmo pedido: PDV + finalização + acerto).

Além disso, três bugs no `CaixaDia.tsx` fazem o painel divergir do que existe no banco:

1. **Filtro `.neq("categoria","Vale Gás")`** (linha 197). No PostgREST, `neq` **também exclui linhas com `categoria = NULL`**. Toda sangria/entrada manual salva sem categoria some da tabela — e some do card "Saldo do Dia".
2. **Coluna "Total" da tabela** (`movimentacoesExtrato`, linha 509) começa em 0, ignorando `sessao.valor_abertura`. O saldo acumulado exibido nunca fecha com o valor real do caixa.
3. As descrições "Vale Ultragaz / Vale Central gas" **contam como entrada de dinheiro** nos cards, misturando voucher com caixa físico. O filtro atual só pega o literal "Vale Gás", que ninguém mais usa.

---

## Correções

### 1. `src/services/paymentRoutingService.ts` — parar de duplicar `movimentacoes_caixa`

No `rotearPagamentosVenda`, antes de inserir linha de **dinheiro** ou **cheque** referente a um `pedidoId`, verificar se já existe:

```ts
const jaExiste = await supabase
  .from("movimentacoes_caixa")
  .select("id")
  .eq("pedido_id", pedidoId)
  .eq("categoria", "Venda Dinheiro")   // ou "Venda Cheque"
  .maybeSingle();
if (jaExiste.data) continue;           // idempotente — não insere de novo
```

Aplicar a mesma proteção para PIX (`movimentacoes_bancarias` pela mesma chave `pedido_id + categoria='venda'`) para evitar duplicar PIX se a finalização for reexecutada.

Escopo: apenas `rotearPagamentosVenda` — sem alterar contas a receber nem operadoras.

### 2. Limpar duplicatas já gravadas (uma vez só, via SQL)

Migration que remove `movimentacoes_caixa` duplicadas mantendo o registro mais antigo por (`pedido_id`, `categoria`) quando `pedido_id` não é nulo. Mesma coisa para `movimentacoes_bancarias` categoria `venda`. Sem tocar em lançamentos manuais (pedido_id null).

Depois adicionar índice único parcial:

```
CREATE UNIQUE INDEX movimentacoes_caixa_pedido_categoria_uniq
  ON movimentacoes_caixa(pedido_id, categoria)
  WHERE pedido_id IS NOT NULL;
```

para o banco reforçar a idempotência da correção 1.

### 3. `src/pages/caixa/CaixaDia.tsx` — filtro que preserva NULL

Trocar em `fetchData` (linha 197) e em `fetchTesouraria` (linhas 361 e 377):

```ts
.neq("categoria", "Vale Gás")
```

por:

```ts
.or("categoria.is.null,categoria.not.in.(Vale Gás)")
```

Assim entrada/saída manual sem categoria volta a aparecer na tabela e a compor o "Saldo do Dia" e o "Total em Caixa".

### 4. `CaixaDia.tsx` — coluna "Total" com saldo real

Em `movimentacoesExtrato` (linha 509), iniciar o acumulador com o saldo de abertura da sessão do dia:

```ts
let total = Number(sessao?.valor_abertura || 0);
```

e adicionar `sessao` às dependências do `useMemo`. O footer "TOTAL GERAL" continua exibindo `totalEntradas / totalSaidas / saldo` (saldo puro do dia, sem abertura) — só a coluna running muda.

### 5. `CaixaDia.tsx` — separar vouchers de vale-gás dos cards de caixa

Nos cálculos de `totalEntradas`, `totalSaidas`, `saldo` e no gráfico de tesouraria, excluir também categorias que começam com `Vale ` (ex.: "Vale Ultragaz", "Vale Central gas") do somatório de **caixa físico**. Elas continuam listadas na tabela (para rastreio) mas com badge "voucher" e sem entrar no total do dia. Regra:

```ts
const isVoucherVale = (c?: string | null) =>
  !!c && /^vale\s/i.test(c);
```

Usada para excluir em `totalEntradas`/`totalSaidas`, em `saldoTotalCaixa` (fetchTesouraria) e no `chartMovs`.

---

## Validação

- Recarregar `caixa/dia` → tabela "Movimentações do Dia" mostra 1 linha por venda em dinheiro (sem duplicata).
- Card **Saldo do Dia** = `valor_abertura + entradas_caixa − saídas_caixa` (sem vales, sem duplicatas).
- Sangria manual sem categoria volta a aparecer na tabela.
- Reprocessar a mesma venda (ex.: reabrir e finalizar de novo no PDV) não cria nova linha em `movimentacoes_caixa`.
- Índice único no banco impede regressão silenciosa.

## Fora de escopo

- Aba Produtos, Pagamentos, Tesouraria (só o filtro de categoria e o gráfico entram, para consistência) e Acerto Diário.
- Nova Venda / Kanban / Contas a Receber / conciliação cartão.
