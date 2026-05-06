## Problema

Na tela `/transportadora/compras` o usuário relatou:

1. **Compras de 02/04/2026 não aparecem** — apesar de existirem 11 registros no banco para essa data (NACIONAL GAS, ~R$ 121k em P13/P20/P45 cheio + vasilhames).
2. **Card "Resumo por Loja"** está mostrando linhas de Cheio **e** Vasilhame, mas precisa mostrar apenas **Cheio**.

## Causa raiz

### 1. Compras "sumidas"
Em `src/pages/transportadora/TranspCompras.tsx` (linhas 153-160), a query carrega só as **100 compras mais recentes**:

```ts
.from("transp_compras").select("*").order("data", { ascending: false }).limit(100);
```

Como o sistema tem volume alto de XMLs importados, o dia 02/04/2026 já caiu fora do top 100, então nem entra no array `compras` que alimenta o filtro por mês/filial. Por isso o "Resumo por Loja" e a lista somem.

### 2. Vasilhame no Resumo por Loja
`src/components/transportadora/compras/ResumoPorLoja.tsx` agrupa por `tipo` (cheio/vasilhame) e renderiza ambos com badge colorida. Precisa filtrar para exibir só `cheio`.

## Plano de correção

### Ajuste 1 — Carregar compras pelo período selecionado (TranspCompras.tsx)
Trocar a query fixa por uma query parametrizada pelo `periodo` (mês YYYY-MM) e sem o limite de 100:

- Adicionar `periodo` na `queryKey` para refazer o fetch ao trocar de mês.
- Filtrar no servidor por `mes_referencia = periodo` (campo já existe na tabela).
- Subir o limite para 2000 (mais que suficiente para um mês inteiro de XMLs).
- Manter o restante do componente igual; o `useMemo` `comprasPeriodo` continua funcionando.

### Ajuste 2 — Resumo por Loja somente Cheio (ResumoPorLoja.tsx)
- Ignorar registros com `tipo_produto !== "cheio"` logo no início do `forEach`.
- Remover a coluna "Tipo" da tabela (não há mais necessidade de distinguir).
- Atualizar o título para "Resumo por Loja — GLP Cheio".
- Manter o detalhamento por produto (P13 / P20 / P45) já existente.

### Não muda
- Estrutura de rotas, layout, KPIs de toneladas, comparativo de fornecedores, gráficos e lista de compras (`ComprasListaTable`/`ComprasSimplesTable`) ficam intactos.
- Nada de refatorar `App.tsx` ou providers (regra de estabilidade).

## Resultado esperado
- Ao selecionar período `2026-04`, as 11 compras do dia 02/04 aparecem na lista, no Resumo por Loja e nos KPIs.
- Card "Resumo por Loja" mostra apenas linhas Cheias (P13/P20/P45), com o Total Geral recalculado só sobre Cheio.
- Trocar o seletor de mês passa a recarregar do banco automaticamente.
