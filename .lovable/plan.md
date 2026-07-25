## Objetivo
1. Na tela **Caixa → Despesas**, o modal "Nova Despesa" deve listar **todas as categorias** cadastradas (não só as 4 fixas).
2. Migrar as despesas de caixa que na verdade são **compras de mercadorias** para a tabela `compras`, evitando que o **R.O.** conte esses valores como despesa e distorça o resultado.

---

## 1. Nova Despesa — carregar categorias reais

**Arquivo:** `src/pages/caixa/Despesas.tsx`

- Buscar de `categorias_despesa` onde `ativo = true` e `(unidade_id = unidadeAtual.id OR unidade_id IS NULL)`.
- Renderizar as opções no `Select` do modal ordenadas por `tipo` (Fixo / Variável) e nome.
- Mantém a categoria digitada por foto (OCR) — se não existir na lista, aparece como item extra selecionável.
- Sem mudanças de layout, só troca do `SelectContent`.

---

## 2. Migração das compras registradas como despesa

**Situação atual (Forte Gás e outras unidades):**
- 21 lançamentos em `movimentacoes_caixa` com `categoria = "Compra de Mercadorias"` e `compra_id NULL`, somando **R$ 237.051,76**.
- Além destes, 11 já possuem `compra_id` (foram geradas pelo fluxo normal de Compras) — essas **não** serão tocadas.
- Descrição típica: `"Compra via transferência - <Fornecedor>"`.

**Ação (via migração SQL revisável):**

Para cada registro de `movimentacoes_caixa` com `tipo = 'saida'`, `compra_id IS NULL` e `categoria ILIKE '%mercador%' OR categoria ILIKE 'compra%'`:

1. Criar registro em `public.compras` com:
   - `unidade_id`, `valor_total = valor`, `data_compra = created_at::date`, `data_pagamento = created_at::date`
   - `pago = true`, `status = 'recebida'`, `forma_pagamento = 'dinheiro'` (origem caixa)
   - `tipo_produto = 'GLP'` (padrão; ajustável depois)
   - `observacoes = 'Migrado de Despesas em <data> — ' || descricao_original`
   - `numero_nota_fiscal = 'MIG-' || substring(id::text,1,8)`
2. Atualizar `movimentacoes_caixa.compra_id` para apontar para o novo `compras.id` e `categoria = 'compras'` (padroniza).
3. Registrar tudo numa mesma transação com log em `observacoes` para permitir auditoria/reversão.

**Efeito no R.O.:**
- O filtro atual de "Custos e despesas" já ignora movimentações de caixa com `compra_id` preenchido — portanto, após a migração, esses R$ 237 mil deixam de aparecer como despesa dupla.
- O CMV continua sendo apurado pelas vendas × custo médio (não muda).
- Não há duplicidade financeira: o dinheiro já saiu do caixa; a `compra` fica apenas como referência histórica para o RO.

---

## Fora de escopo
- Ajustes visuais na tela de Despesas.
- Reprocessamento de estoque (as compras migradas não terão itens — são só registros financeiros históricos).
- Alteração da lógica do R.O. (já está correta após os últimos ajustes).