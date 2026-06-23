import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "app_cliente_id";

export const normalizePhone = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
};

export const setCachedClienteId = (id: string | null) => {
  try {
    if (id) localStorage.setItem(CACHE_KEY, id);
    else localStorage.removeItem(CACHE_KEY);
  } catch {}
};

export const getCachedClienteId = (): string | null => {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
};

/**
 * Resolve o cliente_id do usuário logado tentando, nessa ordem:
 * 1) cache local (gravado no checkout)
 * 2) match por empresa + telefone (normalizado, busca por dígitos)
 * 3) match por empresa + email
 * Retorna { id, source } ou null.
 */
export async function resolveClienteIdForUser(params: {
  userId: string;
  empresaId: string;
  email?: string | null;
  phone?: string | null;
}): Promise<string | null> {
  const { empresaId, email, phone } = params;

  // 1) cache
  const cached = getCachedClienteId();
  if (cached) {
    const { data } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", cached)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (data?.id) return data.id;
    // cache inválido p/ esta empresa
    setCachedClienteId(null);
  }

  const phoneDigits = normalizePhone(phone);

  // 2) telefone (dígitos)
  if (phoneDigits) {
    const { data } = await supabase
      .from("clientes")
      .select("id, telefone")
      .eq("empresa_id", empresaId)
      .not("telefone", "is", null)
      .limit(50);
    const hit = (data || []).find(
      (c: any) => normalizePhone(c.telefone) === phoneDigits
    );
    if (hit) {
      setCachedClienteId(hit.id);
      return hit.id;
    }
  }

  // 3) email
  if (email) {
    const { data } = await supabase
      .from("clientes")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("email", email)
      .maybeSingle();
    if (data?.id) {
      setCachedClienteId(data.id);
      return data.id;
    }
  }

  return null;
}

/**
 * Retorna TODOS os cliente_id da empresa que casam com o usuário (cache + telefone + email).
 * Útil quando o operador do ERP cadastrou o cliente em um registro paralelo (telefone com
 * outra formatação, e-mail diferente, etc.) — evita que pedidos do ERP fiquem invisíveis
 * no app.
 */
export async function resolveAllClienteIdsForUser(params: {
  userId: string;
  empresaId: string;
  email?: string | null;
  phone?: string | null;
}): Promise<string[]> {
  const { empresaId, email, phone } = params;
  const ids = new Set<string>();

  const cached = getCachedClienteId();
  if (cached) ids.add(cached);

  const phoneDigits = normalizePhone(phone);
  if (phoneDigits) {
    const { data } = await supabase
      .from("clientes")
      .select("id, telefone")
      .eq("empresa_id", empresaId)
      .not("telefone", "is", null)
      .limit(500);
    (data || []).forEach((c: any) => {
      if (normalizePhone(c.telefone) === phoneDigits) ids.add(c.id);
    });
  }

  if (email) {
    const { data } = await supabase
      .from("clientes")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("email", email);
    (data || []).forEach((c: any) => ids.add(c.id));
  }

  // Valida cache contra empresa atual
  if (cached && ids.has(cached)) {
    const { data } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", cached)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!data) ids.delete(cached);
  }

  return Array.from(ids);
}

