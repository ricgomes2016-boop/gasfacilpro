
-- Table already exists in the schema (avaliacoes_entrega), no need to create it.
-- Just ensure the entregador_id column exists (it already does per types.ts)

-- Add nota column to avaliacoes_entrega if missing (rating 1-5 via WhatsApp)
-- The table already has nota_entregador and nota_produto columns, and comentario.
-- We'll use the existing table as-is.

-- No schema changes needed - avaliacoes_entrega already exists with:
-- id, pedido_id, cliente_id (user_id), entregador_id, nota_entregador, nota_produto, comentario, created_at

SELECT 1;
