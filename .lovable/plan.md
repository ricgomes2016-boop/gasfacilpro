## Plano

1. **Corrigir a regra ativa no banco**
   - Atualizar a função que atribui `numero_sequencial` em `pedidos` para usar exclusivamente `unidade_id`.
   - Manter compatibilidade para pedidos legados sem unidade.
   - Usar contador atômico por unidade para evitar números duplicados em vendas simultâneas.

2. **Reparar os pedidos já lançados na Japa Gás**
   - Renumerar os pedidos da unidade Japa Gás em ordem cronológica para começarem em `#1`.
   - Recalcular o contador da Japa Gás para que o próximo pedido continue após o último número local.
   - Preservar a matriz e as demais unidades, sem alterar regras de venda, permissões ou consultas.

3. **Adicionar proteção contra regressão**
   - Garantir índice único por `(unidade_id, numero_sequencial)` quando ambos existirem.
   - Confirmar no banco que a função ativa ficou com lógica por unidade e que a Japa Gás passou a ter sequência local.

## Detalhes técnicos

- A investigação mostrou que a função ativa `public.fn_assign_numero_pedido()` ainda calcula o próximo número por `empresa_id`, por isso a Japa Gás herdou a sequência da matriz.
- A unidade Japa Gás tem pedidos atuais com números `#417`, `#418`, `#483` a `#488`; esses serão renumerados para `#1` em diante na própria unidade.