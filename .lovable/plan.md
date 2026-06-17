## Problema
Em `Venda > Nova Venda`, na aba **Entregador**, a lista aparece vazia ("Nenhum entregador disponível"), mesmo havendo entregadores ativos cadastrados na unidade.

## Causa provável
`DeliveryPersonSelect.tsx` carrega entregadores com um **embed PostgREST** em `funcionarios`:

```ts
.select("id, nome, status, foto_url, funcionario_id, funcionarios:funcionario_id(is_vendedor, user_id)")
```

A tabela `funcionarios` tem RLS restritiva e, dependendo do papel do usuário logado, o embed pode falhar silenciosamente (PostgREST retorna erro no nível da query, e como o código faz `if (!error && data)`, a lista fica vazia sem aviso). Também não há tratamento de erro visível — qualquer falha some sem feedback.

## Correção (apenas frontend, em `src/components/vendas/DeliveryPersonSelect.tsx`)

1. **Separar as duas queries** em vez de usar embed:
   - Query 1: `entregadores` filtrado por `unidade_id` + `ativo=true`.
   - Query 2 (opcional, em paralelo): `funcionarios` pelos `funcionario_id` coletados, trazendo `id, is_vendedor, user_id`. Se falhar (RLS), seguir sem dados de vendedor (entregador continua aparecendo, apenas sem o badge "Vendedor"/auto-seleção).
2. **Logar e exibir o erro** real da query de entregadores via `toast` + `console.error`, em vez de engolir silenciosamente, para facilitar diagnóstico futuro.
3. **Manter** toda a UI, ordenação, dedup por nome e callback `onVendedorAuto` exatamente como estão.

## Fora do escopo
- Nenhuma alteração em RLS, schema, edge functions ou no fluxo de `NovaVenda.tsx`.
- Nenhuma mudança visual além da mensagem de erro quando a query falhar.