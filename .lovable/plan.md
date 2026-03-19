

# Corrigir Despesas na Análise de Resultados

## Problema Principal

O gráfico de **Evolução 6 meses** (linhas 156-176) busca despesas **apenas** de `movimentacoes_caixa`, ignorando completamente a tabela `contas_pagar` (que e a fonte primaria de despesas do sistema). Os KPIs do mes atual usam ambas as fontes corretamente, mas o grafico historico nao.

Isso significa que o grafico mostra despesas muito menores do que a realidade, e possivelmente zero se a empresa registra despesas apenas via contas a pagar.

## Correcoes

### 1. Incluir `contas_pagar` no grafico de evolucao
Na funcao `fetchOverview`, no loop dos 6 meses (linhas 156-176), adicionar uma query paralela a `contas_pagar` com `status = 'pago'` e filtro por `vencimento` no intervalo do mes, somando o valor ao total de despesas de cada mes.

### 2. Incluir `contas_pagar` no mes anterior (despesas comparativas)
Linha 132: `despesasMesAnterior` usa apenas `movimentacoes_caixa`. Adicionar tambem query de `contas_pagar` do mes anterior para comparacao correta.

### Detalhes Tecnicos

- No loop de evolucao, adicionar query: `supabase.from("contas_pagar").select("valor").eq("status", "pago").gte("vencimento", inicioDate).lte("vencimento", fimDate)` com filtro de `unidade_id`
- Somar resultado ao `desp` existente
- Para mes anterior, adicionar query paralela de `contas_pagar` com mesmo padrao do mes atual (linha 106-107)
- Total de queries adicionais: 1 para mes anterior + 6 para evolucao = 7 queries extras (todas em paralelo)

