## Problema

Erro ao salvar produto:
> Could not find the 'cfop_saida' column of 'produtos' in the schema cache

A coluna real no banco é `cfop_saida_padrao`, mas o código em `src/pages/cadastros/Produtos.tsx` envia `cfop_saida`. Isso quebra o `update`/`insert` do PostgREST.

## Correção

Em `src/pages/cadastros/Produtos.tsx`, renomear todas as 8 referências de `cfop_saida` para `cfop_saida_padrao` (interface, estado do form, defaults, payload de save, carregamento do produto, autopreenchimento por categoria e o `<Input>` do campo "CFOP Saída").

Nenhuma migração necessária — a coluna já existe no banco com o nome correto.

## Validação

Abrir um produto, alterar o CFOP Saída e clicar em "Salvar Alterações" — deve persistir sem erro.