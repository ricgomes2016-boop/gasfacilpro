## Problema 1 — Erro ao cadastrar parceiro

**Causa:** Em `ValeGasParceiros.tsx` (linha 147) o código faz `addParceiro({ ...formData, ... })`. O `formData` inclui `login_email` e `login_password`, que são espalhados no payload e enviados ao Supabase. Como essas colunas não existem em `vale_gas_parceiros`, o PostgREST retorna: *"Could not find the 'login_email' column…"*.

**Correção em `src/pages/financeiro/ValeGasParceiros.tsx`:**
- Antes de chamar `addParceiro`, extrair só os campos válidos (`nome, cnpj, telefone, email, endereco, tipo, latitude, longitude`) — não usar `...formData`.
- Mesmo tratamento já está OK no `update` (linha 135) que monta payload explícito.

## Problema 2 — Novo tipo de parceiro "Empenho"

A coluna `tipo` é `text` livre (sem enum no banco), então não precisa de migration.

**Mudanças:**
- `src/contexts/ValeGasContext.tsx`: ampliar `TipoParceiro` para `"prepago" | "consignado" | "empenho"`.
- `src/pages/financeiro/ValeGasParceiros.tsx`:
  - Adicionar opção "Empenho (Órgão Público / Licitação)" no Select de tipo.
  - Texto auxiliar: "Parceiro vinculado a empenhos de licitações — recebe vales conforme NF-e emitida."
  - Atualizar estatísticas (card já existente) e badge da lista para reconhecer o novo tipo.
  - Lógica de validação/sequência segue idêntica à do consignado (acerto posterior).
- `NovoEmpenhoModal.tsx` (filtro de parceiros): manter `.eq("ativo", true)` — opcionalmente priorizar/filtrar `tipo IN ('empenho','consignado')`, mas sem quebrar o que já funciona.

## Problema 3 — Empenho com múltiplos produtos

Hoje cada linha em `empenhos` representa 1 produto. Para suportar empenhos multi-produto sem alterar schema/RLS/lógica de vales:

**Abordagem (mínimo invasiva, sem migration):**
- Em `NovoEmpenhoModal.tsx`, transformar a seção "Produto/Quantidade/Valor unitário" em uma **lista dinâmica de itens** (botão "+ Adicionar item" e botão remover por linha).
- Ao salvar, gerar **N inserts em `empenhos`** — um por item — todos compartilhando: `numero_empenho`, `data_empenho`, `parceiro_id`, `licitacao_id`, `unidade_id`, `observacoes`.
- Validar pelo menos 1 item com `produto_id`, `quantidade > 0`, `valor_unitario >= 0`.
- Total geral = soma de (qtd × valor) de todos os itens.

**Em `EmpenhosPanel.tsx` (visualização):**
- Manter listagem por linha (cada produto é uma linha), pois o nº do empenho repete e fica claro.
- Opcional (fora deste plano): agrupar visualmente por `numero_empenho`.

**Em `ImportarEmpenhoDialog` / edge function `extrair-empenho-ia`:**
- Atualizar prompt/schema da IA para retornar um array `itens: [{ produto_id_sugerido, quantidade, valor_unitario }, …]` em vez de um único produto.
- O painel popula a lista dinâmica do modal com todos os itens detectados.

## Fora do escopo
- Não alterar `App.tsx`, rotas, providers.
- Não migrar schema do banco.
- Não mexer em RLS nem em `vale_gas`.

## Arquivos afetados
- `src/pages/financeiro/ValeGasParceiros.tsx`
- `src/contexts/ValeGasContext.tsx`
- `src/components/licitacoes/NovoEmpenhoModal.tsx`
- `src/components/licitacoes/ImportarEmpenhoDialog.tsx`
- `supabase/functions/extrair-empenho-ia/index.ts`
