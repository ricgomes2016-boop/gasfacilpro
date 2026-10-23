import { describe, expect, it } from 'vitest';
import { isMaster, validateCounts, validCountDate } from '../../../supabase/functions/estoque-conferencia-portal/security';

describe('permissões do portal de conferência', () => {
  it('servidor aceita início de 23/10 para vendas de 22/10, mas não 23/10', () => {
    expect(validCountDate('2026-10-22', '2026-10-23', 'inicio')).toBe(true);
    expect(validCountDate('2026-10-23', '2026-10-23', 'inicio')).toBe(false);
  });
  it('servidor aceita fim de 22/10 para vendas de 22/10', () => {
    expect(validCountDate('2026-10-22', '2026-10-22', 'fim')).toBe(true);
    expect(validCountDate('2026-10-21', '2026-10-22', 'fim')).toBe(false);
  });
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