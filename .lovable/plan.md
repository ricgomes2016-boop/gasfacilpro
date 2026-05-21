# Importar Empenho com IA

Adicionar na aba **Empenhos** um botão **"Importar Empenho"** que aceita PDF ou imagem (foto) da Nota de Empenho. A IA (Lovable AI / Gemini) lê o arquivo, extrai os dados e abre o modal **Novo Empenho** já preenchido para o usuário revisar e salvar.

## Fluxo do usuário

1. Aba Empenhos → botão **"Importar Empenho"** (ao lado de "Novo Empenho").
2. Abre um diálogo simples com dropzone: aceita `.pdf`, `.png`, `.jpg`.
3. Após selecionar o arquivo: spinner "Analisando documento com IA..." (3–10s).
4. IA retorna os campos extraídos. O modal **NovoEmpenhoModal** abre já pré-preenchido com:
   - Nº do Empenho
   - Data
   - Órgão (texto reconhecido → tenta casar com Parceiro existente; se não achar, deixa vazio com aviso)
   - Produto (tenta casar pelo nome com produtos da unidade; ex.: "Gás P13" / "Botijão 13kg")
   - Quantidade
   - Valor unitário
   - Observações (resumo do que a IA leu)
5. Usuário revisa, ajusta o que faltar (parceiro/produto), e clica **Salvar** normalmente.

## Detalhes técnicos

### 1. Edge function `extrair-empenho-ia` (nova)
- Recebe `{ fileBase64, mimeType, parceiros: [{id,nome}], produtos: [{id,nome}] }`.
- Chama Lovable AI Gateway com `google/gemini-2.5-flash` (multimodal, lê PDF e imagem direto via `image_url` / `file`).
- Usa **tool calling** para retornar JSON estruturado:
  ```
  { numero_empenho, data_empenho (YYYY-MM-DD),
    orgao_nome, parceiro_id_sugerido,
    produto_descricao, produto_id_sugerido,
    quantidade, valor_unitario,
    observacoes }
  ```
- Match de parceiro/produto: normaliza (lowercase, sem acento) e procura por inclusão; se não bater, retorna `null` e a UI deixa o campo vazio.
- Sempre retorna `200 OK` com `{ ok: true, dados }` ou `{ ok: false, erro }` (regra do projeto — sem 500).
- Trata 429/402 do Gateway com mensagem amigável.

### 2. Componente novo `ImportarEmpenhoDialog.tsx`
- Dialog pequeno com `<input type="file" accept="application/pdf,image/*">`.
- Converte arquivo para base64, busca lista de parceiros + produtos da unidade, chama a edge function.
- No sucesso: fecha esse dialog e chama `onParsed(dadosExtraidos)`.

### 3. Ajuste em `NovoEmpenhoModal.tsx`
- Aceitar prop opcional `initialData?: Partial<...>` para vir pré-preenchido.
- Inicializar os `useState` a partir de `initialData` quando presente.
- Adicionar pequeno banner no topo: "Dados extraídos por IA — confira antes de salvar" quando `initialData` for fornecido.

### 4. Ajuste em `EmpenhosPanel.tsx`
- Novo botão **"Importar Empenho"** (ícone `Upload`) ao lado de "Novo Empenho".
- Estado `importOpen` e `dadosImportados`.
- Ao concluir importação → fecha import dialog → abre `NovoEmpenhoModal` com `initialData`.

## Fora de escopo
- OCR offline (sempre via IA do gateway).
- Importação em lote (apenas um empenho por vez nesta primeira versão).
- Salvamento automático sem revisão (o usuário sempre confirma).

## Segurança
- Edge function valida JWT, tamanho máximo do arquivo (5MB), tipos permitidos.
- Não persiste o arquivo — só processa em memória.
- Usa `LOVABLE_API_KEY` (já configurada).

## Teste manual
Carregar uma Nota de Empenho real (PDF de prefeitura) → verificar se número, data, quantidade, valor e produto são reconhecidos corretamente, e se o Parceiro é sugerido quando existe cadastro com nome parecido.
