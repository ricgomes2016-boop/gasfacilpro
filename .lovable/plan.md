## Objetivo

Em **Estoque → Compras**, o botão "Importar XML" já existe, mas hoje extrai apenas o básico (nº NF, chave, data, frete, descrição/qtd/preço dos itens). Vamos torná-lo um importador fiscal completo:

- Lê **todas** as informações fiscais do XML (emitente, destinatário, totais, impostos, transporte, duplicatas, dados por item).
- Se o **fornecedor não existir**, cadastra automaticamente em `fornecedores` **e** espelha o registro em `clientes` com `tipo = 'fornecedor'` (para aparecer no Cadastro de Clientes).
- Se o **produto não existir**, cadastra com NCM, CEST, CFOP, código ANP, unidade tributável e CSTs já preenchidos a partir do XML (aproveita as 20 colunas fiscais já existentes em `produtos`).
- Salva os dados fiscais da nota e de cada item em `compras` / `compra_itens`.

## Mudanças

### 1. Banco — migration

`compras` (adicionar colunas):
- `serie`, `modelo`, `natureza_operacao`, `cfop_predominante`
- `valor_produtos`, `valor_desconto`, `valor_seguro`, `valor_outros`
- `valor_icms`, `valor_icms_st`, `valor_ipi`, `valor_pis`, `valor_cofins`, `base_icms`, `base_icms_st`
- `transportadora_nome`, `transportadora_cnpj`, `placa_veiculo`, `modalidade_frete`
- `xml_content` (text) — guarda o XML bruto para reimpressão/auditoria

`compra_itens` (adicionar colunas):
- `descricao_xml`, `codigo_produto_fornecedor`, `unidade_xml`
- `ncm`, `cest`, `cfop`, `codigo_anp`
- `cst_icms`, `csosn_icms`, `cst_pis`, `cst_cofins`
- `aliquota_icms`, `aliquota_pis`, `aliquota_cofins`
- `valor_icms`, `valor_pis`, `valor_cofins`, `valor_desconto`

`clientes` (adicionar, opcional p/ fornecedor cadastrado via cliente):
- `cnpj`, `razao_social`, `nome_fantasia`, `inscricao_estadual` (se ainda não houver — verificar no apply)

### 2. `src/pages/estoque/Compras.tsx` — `handleImportXML`

Reescrever o parser para extrair:
- **Emitente**: CNPJ, razão social, nome fantasia, IE, endereço, município, UF, telefone.
- **Identificação NF**: nNF, serie, mod, natOp, dhEmi, dhSaiEnt, chave.
- **Totais (`ICMSTot`)**: vProd, vNF, vFrete, vSeg, vDesc, vOutro, vICMS, vST, vIPI, vPIS, vCOFINS, vBC, vBCST.
- **Transporte**: modFrete, transporta/xNome+CNPJ, veicTransp/placa.
- **Duplicatas (`cobr/dup`)**: usa `dVenc` da 1ª duplicata como `data_pagamento`.
- **Por item (`det`)**: cProd, xProd, NCM, CEST, CFOP, uCom, qCom, vUnCom, vProd, vDesc, comb/cProdANP, ICMS (CST/CSOSN, vBC, pICMS, vICMS), PIS (CST, pPIS, vPIS), COFINS.

Fluxo após parse:
1. **Fornecedor**:
   - Busca em `fornecedores` por CNPJ exato.
   - Se não achar → cria em `fornecedores` com todos os dados do emitente; também faz `upsert` em `clientes` com `tipo='fornecedor'` e mesmos dados (para listar em Cadastros/Clientes filtrando por Fornecedor).
2. **Produtos**:
   - Tenta casar por nome; se não achar, marca `is_new=true` carregando NCM, CEST, CFOP, ANP, CSTs do próprio item.
   - Ao salvar, `produtos` é criado com esses campos fiscais já preenchidos (e `monofasico=true` quando CST PIS/COFINS = 04 ou cProdANP iniciado por 21).
3. **Compra**: grava todos os totais e dados de transporte; `compra_itens` recebe os campos fiscais por item; `xml_content` guarda o XML bruto.
4. Toast detalhado: "NF 12345 importada · Fornecedor X · 5 itens (2 novos) · R$ 1.234,56".

### 3. Cadastro de Clientes — exibir Fornecedores

Em `src/pages/Clientes.tsx`, adicionar:
- Filtro/aba "Fornecedor" que lista clientes com `tipo='fornecedor'`.
- No formulário de cliente, opção de tipo "Fornecedor" (já que `clientes.tipo` é text).

### 4. Detalhes técnicos

- Parsing 100% client-side com `DOMParser` (já usado hoje), sem precisar de edge function.
- Anti-duplicidade: antes de salvar, checar `compras.chave_nfe` — se já existir, avisar e não duplicar.
- Validar tamanho do XML (até ~5MB).
- Mensagens de erro específicas por etapa (parse / fornecedor / produtos / compra).

### Arquivos afetados

- `supabase/migrations/<timestamp>_compras_xml_fiscal.sql` (novo)
- `src/pages/estoque/Compras.tsx` (reescreve `handleImportXML`, ajusta `handleSave` para persistir novos campos)
- `src/pages/Clientes.tsx` (filtro/opção tipo Fornecedor)
