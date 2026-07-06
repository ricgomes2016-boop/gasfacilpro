## Objetivo

Alterar o card **💰 Total em Caixa** na tela `Caixa do Dia` para mostrar o **saldo acumulado até a data selecionada** (em vez do saldo histórico total de todos os tempos).

Assim, ao navegar entre os dias:
- Dia 01/07 → mostra só o que entrou/saiu no dia 01
- Dia 02/07 → mostra dia 01 + dia 02 (menos saídas)
- Dia 03/07 → mostra dia 01 + 02 + 03 (menos saídas)
- E assim por diante, acumulando

Como as vendas anteriores a 01/07 já foram zeradas, o card começa do zero e cresce dia a dia conforme as movimentações reais.

## O que muda

Arquivo: `src/pages/caixa/CaixaDia.tsx`

Na função `fetchTesouraria` (linhas 349–356), a consulta que calcula `saldoTotalCaixa` passa a filtrar por `created_at <= fim do dia selecionado` (23:59:59 no fuso de Brasília), em vez de somar tudo sem filtro de data.

```text
Antes:  Σ(entradas) − Σ(saídas) de TODA a base
Depois: Σ(entradas) − Σ(saídas) COM created_at ≤ fim do dia selecionado
```

Também adicionar `dataSelecionada` como dependência do `useEffect` que chama `fetchTesouraria` (hoje só depende de `unidadeAtual`), para que o card recalcule ao trocar a data.

Regras mantidas sem alteração:
- Continua ignorando a categoria `Vale Gás`
- Continua filtrando pela unidade atual (`unidade_id = atual OR NULL`)
- O card **Saldo do Dia** continua mostrando apenas as movimentações do dia selecionado
- Contas bancárias, gráfico dos últimos 30 dias e movimentações bancárias de hoje não mudam

## Resultado esperado

- 01/07 selecionado → Total em Caixa = movimentações do dia 01/07
- 02/07 selecionado → Total em Caixa = 01/07 + 02/07
- Hoje selecionado → Total em Caixa = tudo acumulado desde 01/07 (que é o novo "zero")
- Se selecionar uma data futura, mostra o acumulado até o fim daquele dia (na prática, igual ao total atual)

## Escopo fora deste plano

- Não altera nenhuma outra tela (Fluxo de Caixa, DRE, Contas Bancárias)
- Não mexe em movimentações, sessões nem em regras de fechamento
- Não muda o cálculo do card "Saldo do Dia" nem o "Valor Esperado" na conferência de fechamento
