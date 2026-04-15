

## Plano: Atualizar `quantidade_transferida` no carregamento ao fazer transferência pelo ERP

### Problema
Quando uma transferência de estoque é feita pelo ERP (página Estoque > Transferência), o sistema **não atualiza** o campo `quantidade_transferida` na tabela `carregamento_rota_itens`. Isso faz com que:
- O app do entregador continue mostrando 672 (sem descontar a transferência)
- A aba Carregamento em Gestão Operacional também não reflita a saída

Apenas transferências feitas pelo **app do entregador** atualizam corretamente esse campo.

### Solução
Adicionar a mesma lógica de atualização de `carregamento_rota_itens.quantidade_transferida` na página de transferência do ERP (`TransferenciaEstoque.tsx`), similar ao que já existe no `EntregadorTransferencia.tsx`.

### Alterações

**1. `src/pages/estoque/TransferenciaEstoque.tsx`**
- Após criar a transferência com sucesso (status `pendente` ou `em_transito`), verificar se a `unidade_origem_id` tem algum carregamento ativo (`status = "em_rota"`)
- Se existir, para cada item transferido, buscar o `carregamento_rota_itens` correspondente (mesmo `produto_id`) e somar a quantidade ao `quantidade_transferida`
- Usar a mesma lógica já existente no `EntregadorTransferencia.tsx` (linhas 167-195)

**2. `src/pages/operacional/GestaoRotas.tsx`**
- Na aba Carregamento, ao exibir cada item, mostrar o saldo real: `quantidade_saida - quantidade_vendida - quantidade_transferida`
- Adicionar coluna ou badge de "Transferido" quando `quantidade_transferida > 0`
- O badge na listagem deve mostrar o saldo restante, não apenas `quantidade_saida`

### Detalhes técnicos
- A busca do carregamento ativo usa: `carregamentos_rota` filtrado por `unidade_id` (da unidade de origem) e `status = "em_rota"`, ou alternativamente pelo `entregador_id` vinculado à unidade
- Se houver múltiplos entregadores/carregamentos na mesma unidade, o match é feito por `produto_id` no `carregamento_rota_itens`
- Não requer migration: o campo `quantidade_transferida` já existe na tabela

### Arquivos
- `src/pages/estoque/TransferenciaEstoque.tsx`
- `src/pages/operacional/GestaoRotas.tsx`

