# Exibir subtipo de produto na coluna "Tipo"

Espelhar o comportamento da tabela de Histórico de Compras da Transportadora na tabela de Pedidos de Compra (Estoque), mostrando o subtipo do gás/água (P13, P20, P45, Água) ao lado do tipo base.

## Arquivo alterado
- `src/components/estoque/ComprasListaTableEstoque.tsx`

## Mudanças

1. **Heurística ampliada `detectarSubtipos(compra)`**
   - Fonte: concatena `observacoes` + nomes dos itens (`compra_itens[].produtos?.nome` ou `descricao`) em uma única string lowercase.
   - Regex tolerantes:
     - P13: `/\bp[\s\-\.]*13\b|13\s*kg|glp\s*13|botij[aã]o\s*13/`
     - P20: `/\bp[\s\-\.]*20\b|20\s*kg|glp\s*20/`
     - P45: `/\bp[\s\-\.]*45\b|45\s*kg|glp\s*45/`
     - Água: `/[áa]gua|gal[aã]o\s*20\s*l|20\s*litros/`
   - Retorna array (uma NF pode conter mais de um subtipo).

2. **Renderização da coluna "Tipo"**
   - Se houver subtipo(s) detectado(s): mostrar apenas os badges P13/P20/P45/Água (sem o badge base "Cheio/Vasilhame/Outros" redundante).
   - Se nenhum subtipo: mostrar o badge base atual.
   - Manter as mesmas classes de cor (`SUBTIPO_CLS`) usadas no `ComprasListaTable.tsx` da transportadora para consistência visual.

## Fora de escopo
- Migração ou backfill de `tipo_produto`.
- Mudanças no importador XML, na tabela da transportadora, ou nos filtros (chips de Cheio/Vasilhame/Outros continuam funcionando como hoje).
