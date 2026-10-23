export function isMaster(roles: string[]) {
  return roles.some((role) => role === 'admin' || role === 'super_admin');
}

export function validCountDate(salesDate: string, countDate: unknown, moment: unknown) {
  if (typeof countDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(countDate) || !['inicio', 'fim'].includes(String(moment))) return false;
  const date = new Date(`${countDate}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== countDate) return false;
  if (moment === 'inicio') date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10) === salesDate;
}

export function validateCounts(records: unknown, ids: string[]) {
  if (!Array.isArray(records) || records.length === 0 || records.length > ids.length * 8) return false;
  const keys = new Set<string>();
  return records.every((r) => {
    if (!r || !ids.includes(r.unidade_id) || !['P13', 'P20', 'P45', 'Agua'].includes(r.produto_grupo)
      || !['cheio', 'vazio'].includes(r.tipo_estoque) || !Number.isSafeInteger(r.quantidade) || r.quantidade < 0 || r.quantidade > 2147483647) return false;
    const key = `${r.unidade_id}:${r.produto_grupo}:${r.tipo_estoque}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}