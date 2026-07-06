## Problema

O card **💰 Total em Caixa** está zerado porque o filtro de data foi construído de forma inválida.

Em `src/pages/caixa/CaixaDia.tsx` linha 351:

```ts
const fimDoDiaSelecionado = `${dataSelecionada}T23:59:59-03:00`;
```

`dataSelecionada` é um objeto `Date`, não uma string. A interpolação gera algo como `Mon Jul 06 2026 00:00:00 GMT-0300 (...)T23:59:59-03:00`, que **não é um ISO válido**. O PostgREST então:
- ou rejeita silenciosamente (query volta vazia → soma = 0)
- ou compara string por string e ignora tudo

Resultado: `saldoTotalCaixa` fica em 0 em qualquer dia selecionado.

## Correção (mínima, focada, sem efeito colateral)

Arquivo único: `src/pages/caixa/CaixaDia.tsx`, função `fetchTesouraria` (linhas 349–382).

1. Trocar a construção do limite superior por **`getBrasiliaEndOfDay(dataSelecionada)`** — helper já usado em `fetchData` (linha 191) que devolve ISO string correto no fuso de Brasília. Garante consistência entre o card "Saldo do Dia" e o "Total em Caixa".

2. Adicionar guarda: se o `.select()` retornar `error`, logar e **não zerar** o estado (hoje ele nem checa o erro; se o Supabase falhar, o card também vira 0 silenciosamente).

3. Mesma proteção para as outras queries dentro de `fetchTesouraria` (contas bancárias, chart 30 dias, movimentações bancárias): logar erros em vez de engolir.

4. Confirmar que o `useEffect` da linha 385 continua com `[unidadeAtual, dataSelecionada]` — já está correto, só documentar.

## Validação depois do fix

- Selecionar 01/07 → card mostra soma de entradas − saídas do dia 01/07 (mesmo valor que "Saldo do Dia" quando só existir movimentação nesse dia).
- Selecionar hoje → card mostra acumulado desde 01/07 até 23:59:59 de hoje.
- Selecionar data futura → mostra o acumulado atual (nada muda depois de hoje).
- Console sem erros vermelhos vindos de `movimentacoes_caixa`.

## Fora do escopo

- Nenhuma alteração em `fetchData`, "Saldo do Dia", conferência de fechamento, DRE, Fluxo de Caixa, contas bancárias ou regras de bloqueio de caixa.
- Nenhuma migration — o problema é 100% frontend (montagem incorreta do filtro).
