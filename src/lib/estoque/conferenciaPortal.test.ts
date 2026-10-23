import { describe, expect, it } from 'vitest';
import { isMaster, validateCounts, validCountDate, validMovement } from '../../../supabase/functions/estoque-conferencia-portal/security';

describe('movimentos dos conferentes', () => {
  const transfer = { action: 'transfer', unidade_id: 'origem', unidade_destino_id: 'filial', produto_grupo: 'P13', quantidade: 100 };
  it('permite transferência de 100 somente com origem autorizada e filial válida', () => {
    expect(validMovement(transfer, ['origem'], ['filial'])).toBe(true);
    expect(validMovement(transfer, ['outra'], ['filial'])).toBe(false);
    expect(validMovement(transfer, ['origem'], ['outra-empresa'])).toBe(false);
  });
  it('não permite transferência para a própria loja', () => {
    expect(validMovement({ ...transfer, unidade_destino_id: 'origem' }, ['origem'], ['origem'])).toBe(false);
  });
  it('permite entrada de 100 e rejeita valores negativos e fracionados', () => {
    const entry = { action: 'entry', unidade_id: 'origem', produto_grupo: 'P13', quantidade: 100 };
    expect(validMovement(entry, ['origem'], [])).toBe(true);
    expect(validMovement({ ...entry, quantidade: -100 }, ['origem'], [])).toBe(false);
    expect(validMovement({ ...entry, quantidade: 1.5 }, ['origem'], [])).toBe(false);
  });
});

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