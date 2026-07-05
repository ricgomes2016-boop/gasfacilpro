## Problema

Em `src/pages/vendas/RelatorioDetalhadoVendas.tsx` (rota `/vendas/relatorio`), o custo médio nas tabelas "Todos os produtos", "Canal" e "Entregador x Produto x Canal" está errado porque é calculado por uma função `custoPadrao(nomeDoProduto)` **hardcoded** (linhas 67-74) que retorna valores fixos:

- "água" → R$ 8,00
- "p13"/"13 kg" → R$ 78,84
- "p20" → R$ 135,03
- "p45" → R$ 315,10
- qualquer outro nome → **R$ 0,00** (por isso lucro/margem ficam totalmente errados)

Isso ignora o preço de custo real cadastrado em `produtos.preco_custo` e não funciona para nenhum outro produto (recargas, acessórios, etc.).

O **preço médio de venda** (`totalVenda / qtd`) já está correto — vem de `pedido_itens.preco_unitario` real.

## Correção

1. **Buscar o custo real do cadastro do produto**: alterar a query em `queryFn` para trazer `produto_id, preco_custo` junto no join:
   ```
   pedido_itens (quantidade, preco_unitario, produtos (id, nome, preco_custo))
   ```
2. **Substituir `custoPadrao(produto)`** pelo valor `Number(item.produtos?.preco_custo) || 0` dentro do agregador `linhas` (linhas 157-180).
3. **Remover a função `custoPadrao`** (linhas 67-74) — não usada em mais lugar nenhum.
4. **Indicador visual quando custo = 0**: se um produto não tem `preco_custo` cadastrado, exibir badge discreto "custo não cadastrado" na coluna Custo médio e excluir essa linha do cálculo de margem para não poluir o insight de "baixa margem".

## Melhorias pontuais (mesma tela, escopo mínimo)

- **Totais na tabela "Entregador x Produto x Canal"**: adicionar linha de total (Qt, Total Venda, Lucro, Margem consolidada) como já existe nas outras.
- **Alerta no topo** quando houver 1+ produtos sem `preco_custo` cadastrado: "N produto(s) sem preço de custo — lucro incompleto. [Ir para Produtos]".
- **Export Excel**: manter o mesmo custo real corrigido (já usa `l.custoMedio`, então herda o fix automaticamente).

## Fora de escopo

- Não alterar `RelatorioVendas.tsx` nem `RelatorioVendasSimplificado.tsx` (não são a página em uso na rota `/vendas/relatorio`).
- Não criar snapshot histórico de custo em `pedido_itens` (mudança de schema grande; usaria o custo cadastrado atual, que é o padrão do ERP hoje).
- Não mexer em RLS, edge functions, ou lógica de vendas/estoque.

## Arquivo alterado

- `src/pages/vendas/RelatorioDetalhadoVendas.tsx` (único)
