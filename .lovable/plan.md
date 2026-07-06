
## Objetivo

Apagar dados financeiros, de caixa e de vendas da empresa **Forte Gás** (`c94c210b-8dbd-4d91-914e-2db146b8cf94`) com data anterior a **01/07/2026**. Preservar clientes e orçamentos.

## Escopo confirmado pelo levantamento

Registros encontrados < 01/07/2026 na Forte Gás:

| Tabela | Qtd | Ação |
|---|---|---|
| pedidos (+ pedido_itens em cascata) | 98 | **Excluir** |
| contas_receber (fiados/vales/cartões/PIX/boleto) | 38 | **Excluir** |
| movimentacoes_caixa | 51 | **Excluir** |
| caixa_sessoes | 0 | — |
| movimentacoes_bancarias | 32 | **Excluir** |
| extrato_bancario | 139 | **Excluir** |
| pagamentos_cartao | 2 | **Excluir** |
| conferencia_cartao | 1 | **Excluir** |
| vale_gas | 4 | **Excluir** |
| vale_gas_lotes | 2 | **Excluir** |
| vale_gas_acertos | 0 | — |
| vendas_antecipadas (+ itens/vales) | 1 | **Excluir** |
| notas_fiscais (+ itens) | 1 | **Excluir** |
| devolucoes | 0 | — |
| cheques | 0 | — |
| boletos_emitidos | 0 | — |
| faturas_cartao | 0 | — |
| clientes | 14.877 | **Preservar** |
| orcamentos | 10 | **Preservar** |

## Fora do escopo (não mencionado — **não tocar**)

- `contas_pagar` (7 registros) — despesas a fornecedores, não é venda/caixa.
- `compras` (5 registros) — entradas de mercadoria, não é venda.
- `movimentacoes_estoque` (62 registros) — mexer aqui altera saldo de estoque atual; risco alto. Estoque atual em `produtos.estoque` fica como está.
- `clientes`, `orcamentos`, `produtos`, `fornecedores`, `entregadores`, `unidades`, `funcionarios`, `cliente_creditos`.

Se você quiser incluir algum destes, me avise antes de aprovar.

## Ajuste de saldos bancários

Como excluímos `movimentacoes_bancarias` e `extrato_bancario` de antes de 01/07, os saldos em `contas_bancarias.saldo_atual` ficam inconsistentes com o novo histórico. O plano **zera `saldo_atual = 0`** nas contas bancárias vinculadas às unidades da Forte Gás — você reinforma o saldo de abertura de 01/07 depois em Financeiro → Contas Bancárias.

## Ordem de execução (uma migration única, transacional)

Executada em ordem para respeitar FKs:

1. `DELETE FROM vale_gas_acerto_vales` cujos `acerto_id` sejam de acertos da Forte Gás < 01/07.
2. `DELETE FROM vendas_antecipadas_vales` e `vendas_antecipadas_itens` das vendas antecipadas da Forte Gás < 01/07.
3. `DELETE FROM vendas_antecipadas` das unidades da Forte Gás < 01/07.
4. `DELETE FROM vale_gas` (< 01/07) e depois `vale_gas_lotes` (< 01/07).
5. `DELETE FROM nota_fiscal_itens` cujos `nota_fiscal_id` sejam da Forte Gás < 01/07; depois `notas_fiscais`.
6. `DELETE FROM conferencia_cartao` e `pagamentos_cartao` das unidades da Forte Gás < 01/07.
7. `DELETE FROM contas_receber` das unidades da Forte Gás < 01/07.
8. `DELETE FROM movimentacoes_caixa` das unidades da Forte Gás < 01/07.
9. `DELETE FROM movimentacoes_bancarias` e `extrato_bancario` das unidades da Forte Gás < 01/07.
10. `DELETE FROM pedido_itens` cujos `pedido_id` sejam da Forte Gás < 01/07; depois `pedidos`.
11. `UPDATE contas_bancarias SET saldo_atual = 0` para contas cuja `unidade_id` pertence à Forte Gás.

Tudo dentro de `BEGIN … COMMIT`; se qualquer passo falhar, nada é aplicado.

## Riscos e cuidados

- **Irreversível.** Recomendo você abrir Cloud → Advanced settings → Export data e baixar um backup antes de aprovar.
- Estoque atual não é recalculado — se algum pedido antigo tinha saída de estoque não regularizada, o saldo continua o mesmo de hoje.
- Numeração sequencial de pedidos (`pedido_sequencias_unidade`) não é resetada — pedidos novos continuam do próximo número.

Se aprovar, entro no modo build e aplico a migration.
