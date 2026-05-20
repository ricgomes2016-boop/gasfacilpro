## Objetivo

Ao importar um XML em **Estoque → Compras**, quando um item da NF-e não tiver correspondência clara em `produtos`, o sistema deve:

1. Verificar inteligentemente se já existe (mesmo com nome diferente).
2. Perguntar ao usuário se deseja cadastrar.
3. Se sim, cadastrar automaticamente usando **todos** os dados fiscais do XML.

Hoje o fluxo (em `src/pages/estoque/Compras.tsx`, `handleImportXML`) faz apenas um match ingênuo por `nome.includes()` e, se não acha, marca o item como `is_new` e cadastra silenciosamente ao salvar a compra — sem confirmação e sem checagem mais forte.

---

## Mudanças

### 1. Detecção mais forte de "produto já cadastrado" (sem IA primeiro)

No loop dos `<det>` do XML, antes de marcar como `is_new`, casar contra `produtos` da unidade por, nesta ordem:

- `codigo_produto_fornecedor` salvo em algum produto (campo já existe na tabela)
- `codigo_anp` (quando combustível)
- `ncm` + similaridade alta no `nome` (normalizando acentos/caixa/“P-13”/“P 13”/“GLP 13kg”)
- Similaridade pura no nome (limiar alto, ex. ≥ 0.75) — usar normalização local (slugify) ou trigram via RPC `similarity()`

Se algum candidato passar, usa o produto existente (sem perguntar).

### 2. Match assistido por IA para casos duvidosos

Para os itens que sobraram **sem match forte**, fazer **uma única** chamada batch via Lovable AI Gateway (`google/gemini-3-flash-preview`, modo `--json`) passando:

- Lista de itens não-mapeados do XML (`xProd`, `cProd`, `ncm`, `cProdANP`, `uCom`).
- Lista resumida dos produtos da unidade (`id`, `nome`, `ncm`, `codigo_anp`).

A IA retorna, por item: `{ match_produto_id | null, confianca: 0–1, motivo }`.

- Confiança ≥ 0.85 → usa o produto existente.
- Caso contrário → entra na fila de "novos para confirmar".

Implementado como nova edge function `match-produtos-xml` (verify_jwt = false, valida JWT em código, CORS).

### 3. Modal de confirmação "Cadastrar novos produtos?"

Após o parse, se houver itens sem match, abrir um `Dialog` listando-os com:

- `xProd`, `NCM`, `unidade`, `preço unit.`, sugestão de **categoria** (gas/agua/outros) inferida do nome/cProdANP.
- Checkbox por item (todos marcados por padrão).
- Para cada item, dropdown opcional **"Vincular a produto existente"** (caso o usuário reconheça manualmente).
- Botões: **Cancelar importação** / **Importar sem esses itens** / **Cadastrar selecionados e continuar**.

### 4. Cadastro automático com dados completos do XML

Para cada item confirmado, criar produto com **todos** os campos fiscais já lidos do XML (igual ao que `reprocessar_itens_compras_outlook` já faz no servidor):

`nome, preco (vUnCom), categoria, ativo=true, unidade_id, ncm, cest, cfop_entrada_padrao, codigo_anp, cst_icms, csosn_icms, cst_pis, cst_cofins, aliquota_pis, aliquota_cofins, unidade_tributavel, monofasico (deduzido), codigo_produto_fornecedor`.

Após inserir, o item da compra passa a usar o `produto_id` real (deixa de ser `is_new`) e o restante do fluxo de salvar a compra segue inalterado.

### 5. Escopo

- **Somente** o import XML manual em `src/pages/estoque/Compras.tsx`.
- **Não** mexer no Outlook importer, no parse server-side de Outlook, na tela da transportadora nem em RLS/schema.
- Nenhuma alteração de banco — todos os campos usados já existem em `produtos` e `compra_itens`.

---

## Detalhes técnicos

**Arquivos a alterar/criar:**

- `src/pages/estoque/Compras.tsx`
  - Refatorar `handleImportXML`: extrair itens, rodar matcher local, chamar edge `match-produtos-xml` para os duvidosos, abrir modal de confirmação.
  - Antes de `setItens(...)`, persistir os produtos confirmados e mapear `produto_id` real.
- `src/components/estoque/ConfirmarNovosProdutosDialog.tsx` (novo) — modal com a lista editável.
- `supabase/functions/match-produtos-xml/index.ts` (nova edge function) — chama Lovable AI Gateway e retorna o match.
- `supabase/config.toml` — adicionar bloco `[functions.match-produtos-xml] verify_jwt = false`.

**Sem migration.** Sem mudança em RLS. Sem mexer no fluxo de salvamento da compra.

**Fora do escopo (pergunto se quiser depois):**
- Aplicar a mesma lógica no `reprocessar_itens_compras_outlook` (server-side).
- Backfill/normalização de `codigo_produto_fornecedor` em produtos antigos.
