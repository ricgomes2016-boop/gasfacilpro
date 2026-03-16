-- Adiciona o campo km_atual à tabela de manutenções
ALTER TABLE manutencoes ADD COLUMN IF NOT EXISTS km_atual NUMERIC;

COMMENT ON COLUMN manutencoes.km_atual IS 'Quilometragem do veículo no momento da manutenção';
