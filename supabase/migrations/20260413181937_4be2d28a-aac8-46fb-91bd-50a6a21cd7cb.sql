
-- Migrate ALL foreign key references from duplicate to correct entregador
UPDATE public.pedidos SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.rotas SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.gamificacao_ranking SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.escalas_entregador SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.horarios_funcionario SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.movimentacoes_caixa SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.veiculos SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.carregamentos_rota SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.vale_gas SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.abastecimentos SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.terminais_cartao SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.transferencias_estoque SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.multas_frota SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.checklist_saida_veiculo SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.entregador_conquistas SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.avaliacoes_entrega SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
UPDATE public.pagamentos_cartao SET entregador_id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' WHERE entregador_id = '12c6af39-21f1-452d-97cd-594c9a0c9826';

-- Copy phone to correct record
UPDATE public.entregadores SET telefone = '(62) 99856-1234' WHERE id = '6610ccc4-0f61-458a-ab59-4254e87a6b84' AND (telefone IS NULL OR telefone = '');

-- Delete the duplicate
DELETE FROM public.entregadores WHERE id = '12c6af39-21f1-452d-97cd-594c9a0c9826';
