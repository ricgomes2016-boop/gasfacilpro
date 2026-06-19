## Criar card "Resumo Financeiro" abaixo de Produtos Vendidos

Em `src/pages/vendas/Pedidos.tsx`:

1. **Remover** o bloco atual de badges de pagamento (linhas 915-928) — `{pagamentoContadores.length > 0 && <div className="flex flex-wrap gap-2">...</div>}`.

2. **Inserir** um novo `<Card>` "Resumo Financeiro" logo após o card "Produtos Vendidos" (após o fechamento do bloco em ~linha 1220), seguindo o mesmo estilo visual (`modern-panel`, `CardHeader` com `CardTitle` `text-base flex items-center gap-2` + ícone `CreditCard`, `CardContent` em grid).

3. **Conteúdo do card:**
   - Título: "Resumo Financeiro" com ícone `CreditCard`.
   - Grid responsivo (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3`) listando cada forma de pagamento de `pagamentoContadores`:
     - Nome da forma (capitalizado)
     - Valor: `R$ X,XX`
     - Percentual sobre o total
   - Linha final destacada com **Total Geral** (`contadores.total`).
   - Renderizar somente quando `pagamentoContadores.length > 0`.

Sem alterações em lógica de negócio — apenas reorganização visual dos dados já calculados em `pagamentoContadores` e `contadores.total`.