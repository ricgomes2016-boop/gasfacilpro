

## Diagnóstico
A tela `/vendas/nova` no ERP tem três fontes principais de overflow horizontal em viewport de 384px:

1. **`ProductSearch.tsx`** — A tabela (`<Table>`) tem 6 colunas com inputs (Qtd: 3 botões + input w-16, Unit: input w-24) + paddings. Largura mínima > 480px → causa scroll horizontal forçado e empurra todo o conteúdo da página.
2. **`PaymentSection.tsx`** (linha de adicionar pagamento) — `Select flex-1` + `Input w-32` + Botão num único `flex` sem wrap. Em 384px, o select fica espremido.
3. **`CustomerSearch.tsx`** (linha CEP/Bairro/Complemento) — Já está bem; só `endereco` em `md:grid-cols-4` precisa garantir colapso perfeito em mobile.

O `MainLayout` já tem `overflow-x-hidden`, mas a tabela interna ignora isso e empurra o `<Card>` pai → o card vaza. Para o usuário, parece "tela maior que o celular" porque o conteúdo do card de produtos escapa visualmente.

## Solução

### 1. `src/components/vendas/ProductSearch.tsx`
- Envolver a `<Table>` em `<div className="overflow-x-auto">` para que o scroll seja **interno ao card**, não da página.
- Ocultar a coluna "Cód." em mobile (`hidden sm:table-cell`).
- Ocultar a coluna "Total" em mobile (mostrar o subtotal junto com Unit.) ou reduzir paddings.
- Reduzir `w-24` da coluna Unit. para `w-20` no mobile e `w-16` para Qtd input → garantir scroll horizontal só dentro do card.
- Adicionar `min-w-0` nos containers principais.

### 2. `src/components/vendas/PaymentSection.tsx`
- Mudar a linha `<div className="flex gap-2">` (Select + Valor + Botão) para `flex-wrap` com larguras responsivas:
  - Select: `flex-1 min-w-[140px]`
  - Valor: `w-28 sm:w-32`
  - Botão: shrink-0
- Garantir que o item da lista de pagamentos use `flex-wrap` para múltiplas formas longas.

### 3. `src/pages/vendas/NovaVenda.tsx`
- Garantir que o container raiz `vendaContent` esteja envolto em wrapper com `min-w-0 w-full` para impedir filhos de "esticar" o pai.
- Verificar barra de IA: já tem `flex-wrap` + `min-w-0` — apenas confirmar.

### 4. `src/components/vendas/CustomerSearch.tsx`
- A linha do `endereco` (`md:col-span-3` + `grid-cols-4`) com input + botão de mapa pode ficar apertada em 384px. Reduzir: garantir que o input tenha `min-w-0` para o flex não estourar.

## Arquivos modificados
- `src/components/vendas/ProductSearch.tsx` (principal — overflow da tabela)
- `src/components/vendas/PaymentSection.tsx` (linha de adicionar pagamento)
- `src/components/vendas/CustomerSearch.tsx` (input de endereço)
- `src/pages/vendas/NovaVenda.tsx` (wrapper min-w-0, se necessário)

## Validação
Após implementar, vou usar o navegador para abrir `/vendas/nova` em viewport 375x812 (iPhone) e tirar um screenshot para confirmar que **nenhum elemento vaza horizontalmente** e que a tabela de produtos rola **internamente** ao card.

