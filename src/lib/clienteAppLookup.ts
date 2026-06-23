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
