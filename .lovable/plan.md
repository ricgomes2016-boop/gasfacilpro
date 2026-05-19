## Objetivo

Substituir a tabela "Pedidos de Compra" em `/estoque/compras` por uma versão visualmente e funcionalmente equivalente à do transportador (`ComprasListaTable`), incluindo conferência, controle de pagamento e vencimento, filtros por tipo (Cheio/Vasilhame/Outros) e por status (Conferidas/Não conferidas), busca, alerta de NF duplicada e linha de totais.

## 1. Migration — novos campos na tabela `compras`

Adicionar colunas para suportar os novos controles:

- `conferida` boolean default false
- `conferida_em` timestamptz
- `conferida_por` uuid (referência ao usuário que conferiu)
- `pago` boolean default false  *(sem mexer em `data_pagamento`, que já existe)*
- `data_vencimento` date
- `tipo_produto` text default 'outros'  *(cheio / vasilhame / outros — derivado da NF; usado para os filtros)*
- `cfop_predominante` já existe e será exibido como CFOP

Sem alteração de RLS — herda as policies já existentes da tabela `compras`.

## 2. Novo componente `ComprasListaTableEstoque`

Local: `src/components/estoque/ComprasListaTableEstoque.tsx`

Espelha 1-para-1 o visual do `ComprasListaTable` do transportador, adaptado ao schema de `compras`:

| Coluna transportador | Origem em `compras` |
|---|---|
| Conferida ✓ | `conferida` |
| Data | `data_compra` (fallback `created_at`) |
| Loja | nome via `unidade_id` (já no contexto) |
| Fornecedor | `fornecedores.razao_social` |
| NF | `numero_nota_fiscal` |
| Tipo + Subtipo (P13/P20/P45/Água) | `tipo_produto` + heurística por `observacoes`/itens |
| CFOP | `cfop_predominante` |
| Qtd | soma de `compra_itens.quantidade` (já vem na query) ou fallback `0` |
| Preço Unit. | `valor_produtos / qtd` |
| Desconto | `valor_desconto` |
| Total | `valor_total` |
| Vencimento (editável) | `data_vencimento` |
| Pago ✓ | `pago` (preenche `data_pagamento` quando marcado) |

Inclui:
- Header com contagem (filtradas / total)
- Busca por fornecedor, NF, CFOP, observações
- Chips de tipo: Todos / Cheio / Vasilhame / Outros (com contagem)
- Chips de status: Todas / ✓ Conferidas / Não conferidas
- Detecção de duplicidade (mesma NF + fornecedor + valor) com banner de aviso
- Toggle inline de Conferida e Pago via `update` na tabela `compras`
- Edição inline de Vencimento (input `type="date"` on blur/enter)
- Footer com totais (Qtd, Desconto, Total)
- "Ver mais" quando > 30 itens

## 3. Integração em `src/pages/estoque/Compras.tsx`

- Substituir o bloco `<Card>` "Pedidos de Compra" (linhas 1216-1271) pelo novo `<ComprasListaTableEstoque compras={compras} unidadesMap={unidadesMap} onChanged={loadCompras} />`
- Ajustar a query `loadCompras` para trazer também `conferida, conferida_em, pago, data_vencimento, tipo_produto, valor_desconto, cfop_predominante, valor_produtos, compra_itens(quantidade)`
- Manter `handleDeleteCompra`, status (`updateStatus`) e ação de excluir disponíveis em um menu de 3 pontos na coluna "Ações" (não no transportador, mas necessário aqui — adicionado como kebab opcional para preservar funcionalidade existente)
- Sem mudanças em `OutlookImportButton`, no fluxo de XML, ou em outras seções da tela

## 4. Tipos

Atualizar a interface `Compra` no topo do arquivo `Compras.tsx` para incluir os novos campos.

## Fora de escopo

- Tabela `transp_compras` ou tela do transportador
- Importação de XML (já feita anteriormente)
- Tela de compras do app transportador (`/transportadora/compras`)
- Mudanças em `Estoque.tsx`, `HistoricoMovimentacoes.tsx`