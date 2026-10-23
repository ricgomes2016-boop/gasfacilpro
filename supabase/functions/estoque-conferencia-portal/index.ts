import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isMaster, validateCounts, validCountDate, validMovement } from './security.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Content-Type': 'application/json' };
const reply = (body: unknown) => new Response(JSON.stringify(body), { headers });
const fail = (error: string) => reply({ ok: false, error });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return fail('Serviço indisponível.');
    const db = createClient(url, key, { auth: { persistSession: false } });
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return fail('Entre para continuar.');
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return fail('Sessão inválida. Entre novamente.');
    const body = await req.json();
    const { action } = body;
    const check = (result: { error: unknown }) => { if (result.error) { console.error('db', JSON.stringify(result.error)); } if (result.error) throw new Error('Não foi possível concluir a operação.'); };

    if (['list', 'create', 'update_access'].includes(action)) {
      const { data: roles, error } = await db.from('user_roles').select('role').eq('user_id', user.id);
      if (error || !isMaster((roles || []).map((r) => r.role))) return fail('Somente Master pode gerenciar conferentes.');
      const { data: profile } = await db.from('profiles').select('empresa_id').eq('user_id', user.id).single();
      const empresaId = profile?.empresa_id;
      if (!empresaId) return fail('Selecione uma empresa vinculada ao seu acesso.');
      if (action === 'list') {
        const result = await db.from('estoque_conferente_acessos').select('user_id, ativo').eq('empresa_id', empresaId);
        check(result);
        const users = await Promise.all((result.data || []).map(async (access) => {
          const [p, units] = await Promise.all([
            db.from('profiles').select('full_name, email').eq('user_id', access.user_id).single(),
            db.from('estoque_conferente_unidades').select('unidade_id').eq('user_id', access.user_id).eq('empresa_id', empresaId),
          ]);
          check(p); check(units);
          return { ...access, ...p.data, unidade_ids: (units.data || []).map((u) => u.unidade_id) };
        }));
        return reply({ ok: true, users });
      }
      if (action === 'update_access') {
        if (typeof body.ativo !== 'boolean') return fail('Situação inválida.');
        const result = await db.from('estoque_conferente_acessos').update({ ativo: body.ativo }).eq('user_id', body.user_id).eq('empresa_id', empresaId).select('user_id').single();
        check(result);
        return reply({ ok: true });
      }
      const ids = Array.isArray(body.unidade_ids) ? [...new Set(body.unidade_ids)] : [];
      if (!ids.length || ids.some((id) => typeof id !== 'string') || typeof body.full_name !== 'string' || body.full_name.trim().length < 2
        || typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
        || typeof body.password !== 'string' || body.password.length < 8) return fail('Informe nome, e-mail, senha de pelo menos 8 caracteres e lojas.');
      const units = await db.from('unidades').select('id').eq('empresa_id', empresaId).eq('ativo', true).in('id', ids);
      if (units.error || units.data?.length !== ids.length) return fail('Uma das lojas não está autorizada.');
      // Never reuse an existing account or replace its ERP privileges.
      const created = await db.auth.admin.createUser({ email: body.email.trim().toLowerCase(), password: body.password, email_confirm: true, user_metadata: { full_name: body.full_name.trim() } });
      if (created.error || !created.data.user) { console.error('create_user', created.error?.message); const m = created.error?.message || ''; if (/weak|pwned|guess/i.test(m)) return fail('Senha fraca ou muito conhecida. Use uma senha mais forte, misturando letras, números e símbolos (ex.: Patio@Usa2026).'); if (/already|registered|exists/i.test(m)) return fail('Este e-mail já tem cadastro. Use outro e-mail.'); return fail('Não foi possível criar o acesso. Confira o e-mail e a senha; use um e-mail sem cadastro existente.'); }
      const newId = created.data.user.id;
      try {
        // Native lifecycle creates a profile and cliente role. Dedicated accounts keep no ERP role or tenant membership.
        check(await db.from('user_roles').delete().eq('user_id', newId));
        check(await db.from('profiles').update({ empresa_id: null }).eq('user_id', newId));
        check(await db.from('estoque_conferente_acessos').insert({ user_id: newId, empresa_id: empresaId, criado_por: user.id, role: 'conferente' }));
        check(await db.from('estoque_conferente_unidades').insert(ids.map((id) => ({ user_id: newId, empresa_id: empresaId, unidade_id: id }))));
      } catch (e) {
        console.error('grant_units', e);
        await db.from('estoque_conferente_acessos').delete().eq('user_id', newId);
        await db.auth.admin.deleteUser(newId);
        return fail('Não foi possível liberar as lojas. O acesso não foi criado.');
      }
      return reply({ ok: true });
    }

    const access = await db.from('estoque_conferente_acessos').select('empresa_id, ativo').eq('user_id', user.id).single();
    if (access.error || !access.data?.ativo) return fail('Acesso não liberado para a conferência.');
    const empresaId = access.data.empresa_id;
    const assigned = await db.from('estoque_conferente_unidades').select('unidade_id').eq('user_id', user.id).eq('empresa_id', empresaId);
    check(assigned);
    const ids = (assigned.data || []).map((u) => u.unidade_id);
    if (!ids.length) return fail('Nenhuma loja autorizada.');
    const units = await db.from('unidades').select('id, nome, tipo, ativo').eq('empresa_id', empresaId).eq('ativo', true).in('id', ids);
    check(units);
    const activeIds = (units.data || []).map((u) => u.id);
    if (!activeIds.length) return fail('Nenhuma loja ativa autorizada.');
    if (action === 'session') {
      const p = await db.from('profiles').select('full_name').eq('user_id', user.id).single();
      check(p);
      const destinations = await db.from('unidades').select('id, nome, tipo, ativo').eq('empresa_id', empresaId).eq('ativo', true);
      check(destinations);
      return reply({ ok: true, unidades: units.data, destinos: destinations.data, name: p.data?.full_name, user_id: user.id });
    }
    if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Number.isFinite(Date.parse(`${body.date}T12:00:00Z`))) return fail('Data inválida.');
    if (['entry', 'transfer', 'delete_transfer'].includes(action)) {
      if (!validCountDate(body.date, body.count_date, body.moment)) return fail('Datas inválidas.');
      if (action === 'delete_transfer') {
        const result = await db.from('estoque_conferencia_movimentos').delete().eq('id', body.id).eq('empresa_id', empresaId).eq('data_conferencia', body.date).eq('tipo', 'transferencia').in('unidade_id', activeIds).select('id').single();
        check(result);
        return reply({ ok: true });
      }
      const destinations = action === 'transfer' ? await db.from('unidades').select('id').eq('empresa_id', empresaId).eq('ativo', true).eq('id', body.unidade_destino_id) : { data: [], error: null };
      check(destinations);
      if (!validMovement(body, activeIds, (destinations.data || []).map((u) => u.id))) return fail('Movimento inválido ou loja não autorizada.');
      const payload = { empresa_id: empresaId, unidade_id: body.unidade_id, produto_grupo: body.produto_grupo, quantidade: body.quantidade, data_conferencia: body.date, criado_por: user.id };
      if (action === 'entry') {
        // Partial unique index: replace the day's manual entry without touching received transfers.
        const existing = await db.from('estoque_conferencia_movimentos').select('id').eq('empresa_id', empresaId).eq('unidade_id', body.unidade_id).eq('produto_grupo', body.produto_grupo).eq('data_conferencia', body.date).eq('tipo', 'entrada_manual').maybeSingle();
        check(existing);
        check(existing.data ? await db.from('estoque_conferencia_movimentos').update(payload).eq('id', existing.data.id) : await db.from('estoque_conferencia_movimentos').insert({ ...payload, tipo: 'entrada_manual' }));
        return reply({ ok: true });
      }
      const result = await db.from('estoque_conferencia_movimentos').insert({ ...payload, tipo: 'transferencia', unidade_destino_id: body.unidade_destino_id }).select('id, unidade_id, unidade_destino_id, produto_grupo, quantidade').single();
      check(result);
      return reply({ ok: true, movement: result.data });
    }
    if (action === 'save') {
      if (!validateCounts(body.records, activeIds)) return fail('Contagem inválida ou loja não autorizada.');
      if (body.count_date === undefined && body.moment === undefined) {
        // Compatibility for the previously published frontend; legacy rows stay untouched.
        check(await db.rpc('salvar_contagem_portal', { _user_id: user.id, _empresa_id: empresaId, _data: body.date, _registros: body.records }));
      } else {
        if (!validCountDate(body.date, body.count_date, body.moment)) return fail('Data da contagem não corresponde ao dia da venda.');
        check(await db.rpc('salvar_fechamento_conferencia_portal', { _user_id: user.id, _empresa_id: empresaId, _data: body.date, _data_contagem: body.count_date, _momento: body.moment, _registros: body.records }));
      }
      return reply({ ok: true });
    }
    if (action !== 'load') return fail('Operação não permitida.');
    if (body.count_date !== undefined || body.moment !== undefined) {
      if (!validCountDate(body.date, body.count_date, body.moment)) return fail('Datas inválidas.');
      const previous = new Date(`${body.date}T12:00:00Z`);
      previous.setUTCDate(previous.getUTCDate() - 1);
      const next = new Date(`${body.date}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      const columns = 'unidade_id, produto_grupo, tipo_estoque, quantidade';
      const [legacyCurrent, legacyPrev, current, prev, movements, adjustments] = await Promise.all([
        db.from('estoque_conferencias').select(columns).eq('data_conferencia', next.toISOString().slice(0, 10)).in('unidade_id', activeIds),
        db.from('estoque_conferencias').select(columns).eq('data_conferencia', body.date).in('unidade_id', activeIds),
        db.from('estoque_conferencia_fechamentos').select(columns).eq('empresa_id', empresaId).eq('data_conferencia', body.date).in('unidade_id', activeIds),
        db.from('estoque_conferencia_fechamentos').select(columns).eq('empresa_id', empresaId).eq('data_conferencia', previous.toISOString().slice(0, 10)).in('unidade_id', activeIds),
        db.from('estoque_conferencia_movimentos').select('id, unidade_id, unidade_destino_id, produto_grupo, quantidade, tipo').eq('data_conferencia', body.date).or(`unidade_id.in.(${activeIds.join(',')}),unidade_destino_id.in.(${activeIds.join(',')})`),
        db.from('estoque_conferencia_saldo_ajustes').select('unidade_id, produto_grupo, cheio, vazio').eq('data_conferencia', body.date).in('unidade_id', activeIds),
      ]);
      [legacyCurrent, legacyPrev, current, prev, movements, adjustments].forEach(check);
      const combine = (oldRows: any[], newRows: any[]) => {
        const rows = new Map();
        for (const row of [...oldRows, ...newRows]) rows.set(`${row.unidade_id}:${row.produto_grupo}:${row.tipo_estoque}`, row);
        return [...rows.values()];
      };
      return reply({ ok: true, current: combine(legacyCurrent.data || [], current.data || []), prev: combine(legacyPrev.data || [], prev.data || []), movs: movements.data, ajs: adjustments.data });
    }
    const previous = new Date(`${body.date}T12:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    const [current, prev, movements, adjustments] = await Promise.all([
      db.from('estoque_conferencias').select('unidade_id, produto_grupo, tipo_estoque, quantidade').eq('data_conferencia', body.date).in('unidade_id', activeIds),
      db.from('estoque_conferencias').select('unidade_id, produto_grupo, tipo_estoque, quantidade').eq('data_conferencia', previous.toISOString().slice(0, 10)).in('unidade_id', activeIds),
      db.from('estoque_conferencia_movimentos').select('id, unidade_id, unidade_destino_id, produto_grupo, quantidade, tipo').eq('data_conferencia', body.date).or(`unidade_id.in.(${activeIds.join(',')}),unidade_destino_id.in.(${activeIds.join(',')})`),
      db.from('estoque_conferencia_saldo_ajustes').select('unidade_id, produto_grupo, cheio, vazio').eq('data_conferencia', body.date).in('unidade_id', activeIds),
    ]);
    [current, prev, movements, adjustments].forEach(check);
    return reply({ ok: true, current: current.data, prev: prev.data, movs: movements.data, ajs: adjustments.data });
  } catch (e) {
    console.error('fatal', e);
    return fail('Não foi possível concluir a operação. Tente novamente.');
  }
});