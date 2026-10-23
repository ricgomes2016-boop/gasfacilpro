import { describe, expect, it } from 'vitest';
import { isMaster, validateCounts } from '../../../supabase/functions/estoque-conferencia-portal/security';

describe('permissões do portal de conferência', () => {
  it('somente Master cadastra e libera acessos', () => {
    expect(isMaster(['admin'])).toBe(true);
    expect(isMaster(['super_admin'])).toBe(true);
    expect(isMaster(['gestor', 'operacional'])).toBe(false);
  });
  it('conferente só salva nas lojas autorizadas', () => {
    const count = { unidade_id: 'loja-1', produto_grupo: 'P13', tipo_estoque: 'cheio', quantidade: 186 };
    expect(validateCounts([count], ['loja-1'])).toBe(true);
    expect(validateCounts([count], ['loja-2'])).toBe(false);
  });
  it('conferente não altera saldo inicial', () => {
    expect(validateCounts([{ unidade_id: 'loja-1', produto_grupo: 'P13', tipo_estoque: 'saldo_inicial', quantidade: 200 }], ['loja-1'])).toBe(false);
  });
});