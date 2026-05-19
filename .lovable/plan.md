## Diagnóstico do que foi importado

Verifiquei as 25+ NF-e importadas do Outlook em `compras` + `compra_itens` e os logs da edge function.

### Cabeçalho (`compras`) — OK na maior parte
Preenchidos: `chave_nfe`, `numero_nota_fiscal`, `serie`, `modelo`, `natureza_operacao`, `cfop_predominante`, `valor_total`, `valor_produtos`, `transportadora_nome`, `transportadora_cnpj`, `modalidade_frete`, `xml_content`, `fornecedor_id`, `unidade_id`, `data_compra`, `data_pagamento` (quando há dVenc).

Vieram zerados: `valor_icms`, `valor_icms_st`, `valor_ipi`, `valor_pis`, `valor_cofins`, `base_icms`, `base_icms_st`, `valor_frete`, `valor_seguro`, `valor_desconto`, `valor_outros`, `placa_veiculo`. **Isso é coerente** com as NF-e que vieram (RETORNO DE VASILHAME e VENDA DE GÁS PARA REVENDEDOR são tipicamente monofásicas com tributos zerados na origem), mas vale revalidar com 1-2 XMLs reais.

### Itens (`compra_itens`) — **FALHA: zero itens inseridos**
Nenhuma das compras importadas tem itens. Causa nos logs da edge function:

```
WARNING Erro criando produto: Could not find the 'aliquota_cofins' column
of 'produtos' in the schema cache
```

A tabela `produtos` **não tem** as colunas fiscais que a função tenta gravar: `ncm`, `cest`, `cfop_entrada_padrao`, `codigo_anp`, `cst_icms`, `csosn_icms`, `cst_pis`, `cst_cofins`, `aliquota_pis`, `aliquota_cofins`, `unidade_tributavel`, `monofasico`. Só existe `categoria`.

Resultado: o insert do produto falha → `produto_id` fica null → o item é descartado silenciosamente (warning, não erro) → `compra_itens` fica vazio para todas as 25 compras.

## Correções

### 1. Migration — adicionar colunas fiscais em `produtos`
```sql
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS cfop_entrada_padrao text,
  ADD COLUMN IF NOT EXISTS cfop_saida_padrao text,
  ADD COLUMN IF NOT EXISTS codigo_anp text,
  ADD COLUMN IF NOT EXISTS cst_icms text,
  ADD COLUMN IF NOT EXISTS csosn_icms text,
  ADD COLUMN IF NOT EXISTS cst_pis text,
  ADD COLUMN IF NOT EXISTS cst_cofins text,
  ADD COLUMN IF NOT EXISTS aliquota_icms numeric,
  ADD COLUMN IF NOT EXISTS aliquota_pis numeric,
  ADD COLUMN IF NOT EXISTS aliquota_cofins numeric,
  ADD COLUMN IF NOT EXISTS unidade_tributavel text,
  ADD COLUMN IF NOT EXISTS monofasico boolean DEFAULT false;
```
Esses campos são exigidos para emitir NF-e depois.

### 2. Edge function `importar_xml_outlook_compras` — robustez
- Se o insert do produto falhar mesmo com as colunas certas, **fallback** criando o produto só com os campos básicos (nome, preço, unidade_id, categoria) — o item não pode ser perdido por causa do produto.
- Contar e retornar `produtos_criados` e `itens_inseridos` no resumo final.
- Log do `cErr`/`pErr` deve elevar `erros` (hoje só faz `console.warn`).

### 3. Nova edge function `reprocessar_itens_compras_outlook`
Reprocessa as compras já importadas que estão sem itens:
- Filtra `compras` com `observacoes LIKE 'Importado do Outlook%'` e sem registros em `compra_itens`.
- Relê `xml_content` (já está salvo no cabeçalho), roda o mesmo parser e cria produtos + itens + movimentações de estoque.
- UI: adicionar botão **"Reprocessar itens das importações"** ao lado do botão de importar XML do Outlook em `Compras.tsx`, mostrando quantas compras precisam de reprocessamento e o resultado.

### 4. Validação pós-correção
- Conferir em 2-3 NF-e reais (uma de revenda e uma de retorno) se os totais fiscais zerados são mesmo do XML ou se há campos que estamos lendo errado (ex: `vICMS` dentro de `ICMSTot` em layouts diferentes).
- Conferir 1 produto criado com NCM, CFOP, ANP, CST etc.

## Fora do escopo
- Não mexer em `transp_compras`/transportadora.
- Não alterar `handleImportXML` (importação por arquivo do PC).
- Sem mudanças visuais em outras telas.
