export function isMaster(roles: string[]) {
  return roles.some((role) => role === 'admin' || role === 'super_admin');
}

export function validMovement(body: Record<string, unknown>, origins: string[], destinations: string[]) {
  return origins.includes(String(body.unidade_id)) && ['P13', 'P20', 'P45', 'Agua'].includes(String(body.produto_grupo))
    && Number.isSafeInteger(body.quantidade) && Number(body.quantidade) >= (body.action === 'entry' ? 0 : 1)
    && Number(body.quantidade) <= 2147483647
    && (body.action === 'entry' || (body.action === 'transfer' && destinations.includes(String(body.unidade_destino_id)) && body.unidade_id !== body.unidade_destino_id));
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