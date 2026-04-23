

## Edição inline de Fornecedor, Valor e Filial em /contador/despesas

### O que será entregue

Na tabela de `src/pages/contador/ContadorDespesas.tsx`, tornar **editáveis** as colunas **Fornecedor**, **Valor** e adicionar uma nova coluna **Filial** (também editável). Edição direto na linha — sem abrir modal — com salvamento automático ao sair do campo (`onBlur`).

### Mudanças

**1. Nova coluna "Filial" no cabeçalho**
- Adicionar `<th>Filial</th>` entre "Descrição" e "Valor".

**2. Célula Fornecedor — input inline**
- Substituir o texto puro por um `<Input>` discreto (sem borda visível, ganha borda no hover/focus) com o valor de `d.fornecedor`.
- Ao `onBlur`, se o valor mudou, salvar via `supabase.from("despesas_contabeis").update({ fornecedor }).eq("id", d.id)`.
- Atualizar estado local otimista para refletir imediatamente.

**3. Célula Valor — input numérico inline**
- `<Input type="number" step="0.01">` alinhado à direita, prefixo "R$".
- Ao `onBlur`, validar que é número ≥ 0; salvar `valor` no banco.
- Mostrar erro toast se inválido e reverter para o valor anterior.

**4. Nova célula Filial — Select inline**
- `<Select>` (Radix) populado a partir de `unidades` do `useContador()`.
- Valor atual = `d.unidade_id`. Opção "Sem filial" usa value `"nenhum"` (regra do projeto: nunca string vazia em SelectItem).
- Ao mudar, salvar `unidade_id` (ou `null` se "nenhum") imediatamente.

**5. Estado local + persistência**
- Criar helper `updateDespesa(id, patch)` que:
  - Atualiza `setDespesas` otimista.
  - Chama Supabase update.
  - Em erro, reverte e mostra `toast.error`.
  - Em sucesso, mostra `toast.success("Despesa atualizada")`.

**6. Coluna Loja na exportação**
- A exportação já mostra `_loja_nome` resolvido por `unidades.find(...)` — passa a refletir a filial editada automaticamente sem mudanças adicionais.

### Arquivos
- **Editar**: `src/pages/contador/ContadorDespesas.tsx`

### Critérios de aceite
- Em `/contador/despesas`, campos Fornecedor e Valor podem ser clicados e editados direto na tabela.
- Nova coluna **Filial** aparece com Select das unidades da empresa ativa.
- Salvamento ocorre ao sair do campo (Fornecedor/Valor) ou ao trocar (Filial), com toast de confirmação.
- Em erro de rede, valor antigo é restaurado e toast de erro aparece.
- Nenhuma outra coluna ou funcionalidade (upload, OCR, baixa, exportação) é alterada.

