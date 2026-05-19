## Objetivo

Adicionar em **Gestão de Estoque → Compras** o mesmo botão "Importar XML do Outlook" que já existe em `transporte.gasfacilpro.com.br/compras`, gravando na tabela operacional `compras` + `compra_itens` (não em `transp_compras`) e preenchendo toda a parte fiscal exigida (NCM, CEST, CFOP, CST, alíquotas, ANP, transportadora, duplicatas etc.) — exatamente como já acontece quando se importa o XML manualmente do PC.

A importação manual por arquivo (`handleImportXML`) já cadastra tudo isso e não será mexida.

## O que será feito

### 1. Nova Edge Function `importar_xml_outlook_compras`
Espelha a função `importar_xml_outlook` da transportadora, mas:

- Lê e-mails do Outlook (via gateway `microsoft_outlook`) com anexos `.xml` dos últimos N dias, opcionalmente filtrando por remetente.
- Extrai o XML da NF-e e faz parse **completo** (mesmos campos que o `handleImportXML` do front):
  - Cabeçalho: chave, número, série, modelo, natOp, dhEmi, dVenc (1ª duplicata).
  - Emitente: CNPJ, razão, fantasia, endereço, cidade, UF, telefone.
  - Totais: vNF, vProd, vFrete, vSeg, vDesc, vOutro, vICMS, vST, vIPI, vPIS, vCOFINS, vBC, vBCST.
  - Transporte: modFrete, transportadora, CNPJ, placa.
  - Itens: xProd, cProd, NCM, CEST, CFOP, uCom, qCom, vUnCom, vDesc, cProdANP, CST/CSOSN ICMS, alíq/valor ICMS, CST/alíq/valor PIS e COFINS.
- Antiduplicidade: ignora se já existe `compras.chave_nfe`.
- Resolve `unidade_id` pelo CNPJ do destinatário ⇒ tabela `unidades` da empresa do usuário.
- Resolve / cria `fornecedor` em `fornecedores` (busca por CNPJ; cria com razão, fantasia, endereço, cidade, UF, telefone, `tipo='fornecedor'`).
- Para cada item: localiza produto por nome (match exato → contém) na `produtos` da unidade; se não existir, cria com NCM/CEST/CFOP entrada/ANP/CST/CSOSN/CST PIS/COFINS/alíq PIS-COFINS/unidade tributável e flag `monofasico` (quando CST PIS/COFINS = 04 ou ANP começa com 21), `categoria='gas'` se o nome indicar GLP.
- Insere em `compras` todos os campos fiscais (serie, modelo, natureza_operacao, cfop_predominante, vProd/vDesc/vSeg/vOutro/vICMS/vST/vIPI/vPIS/vCOFINS/vBC/vBCST, transportadora, placa, modalidade_frete, xml_content).
- Insere em `compra_itens` os campos fiscais por item (descricao_xml, codigo_produto_fornecedor, unidade_xml, ncm, cest, cfop, codigo_anp, cst/csosn, cst pis/cofins, alíq, valores e desconto).
- Atualiza estoque dos itens via mesma lógica do front (chamada à RPC equivalente a `atualizarEstoqueCompra` ou repetindo o SQL).
- Se houver `dVenc`, cria `contas_pagar` correspondente.
- Retorna: `total_emails`, `total_xmls`, `total_importados`, `ja_existentes`, `erros`, `detalhes[]`.

Config: adicionar bloco `[functions.importar_xml_outlook_compras] verify_jwt = false` em `supabase/config.toml` (mesmo padrão da função existente).

### 2. UI em `src/pages/estoque/Compras.tsx`
No header do card de Compras, ao lado dos botões existentes (Importar XML / Nova Compra), adicionar:

- Botão **"Importar XML do Outlook"** que abre um pequeno popover/diálogo com:
  - Input opcional **Remetente** (e-mail) — persistido em `localStorage` (`estoque_xml_remetente`).
  - Select **Período de busca** (7, 15, 30, 60, 90 dias) — persistido (`estoque_xml_dias`, default 30).
  - Botão **Importar agora** chamando `supabase.functions.invoke("importar_xml_outlook_compras", { body: {...} })`.
  - Exibição de "Última importação" e resumo do último resultado (importados / já existentes / erros).
- Após o sucesso: `fetchCompras()` + `fetchProdutos()` + `fetchFornecedores()` + toast.

### 3. Pré-requisito de conexão
A função reusa o connector **Microsoft Outlook** já configurado para a transportadora (mesma chave `MICROSOFT_OUTLOOK_API_KEY`). Se a conexão não estiver linkada ao projeto, a função retorna mensagem clara e a UI orienta o usuário a conectar em Conectores → Outlook.

## Fora do escopo

- Não altera `transp_compras` nem a tela da transportadora.
- Não altera `handleImportXML` (importação por arquivo do PC já cadastra a parte fiscal).
- Não cria nova tabela; usa `compras`, `compra_itens`, `fornecedores`, `produtos`, `contas_pagar` existentes.
