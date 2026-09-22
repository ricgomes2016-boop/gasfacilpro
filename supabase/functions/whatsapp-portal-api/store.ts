// Persistência anti-replay e idempotência do portal WhatsApp.
// Recebe um client tipo-Supabase por injeção para permitir testes unitários.

export interface ClienteTipoSupabase {
  from: (tabela: string) => any;
}

export const TABELA = "whatsapp_portal_requests";
export const TTL_MS = 24 * 60 * 60 * 1000; // idempotency key vale 24h

/**
 * Registra o nonce. Retorna false quando já existe (replay).
 */
export async function registrarNonce(
  db: ClienteTipoSupabase,
  nonce: string,
  action: string,
  agora = Date.now(),
): Promise<boolean> {
  const { error } = await db.from(TABELA).insert({
    nonce,
    action,
    expires_at: new Date(agora + TTL_MS).toISOString(),
  });
  if (error?.code === "23505") return false; // conflito de unicidade = replay
  if (error) {
    throw new Error(`Falha ao registrar nonce: ${error.code ?? "db_error"}`);
  }
  return true;
}

/**
 * Retorna a resposta já processada para a idempotency key, se houver.
 */
export async function buscarIdempotente(
  db: ClienteTipoSupabase,
  idempotencyKey: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await db
    .from(TABELA)
    .select("response")
    .eq("idempotency_key", idempotencyKey)
    .not("response", "is", null)
    .maybeSingle();
  return (data?.response as Record<string, unknown>) ?? null;
}

/** Grava o resultado final associado à idempotency key. */
export async function salvarIdempotente(
  db: ClienteTipoSupabase,
  params: { nonce: string; idempotencyKey: string; action: string; response: Record<string, unknown> },
  agora = Date.now(),
): Promise<void> {
  await db
    .from(TABELA)
    .update({
      idempotency_key: params.idempotencyKey,
      response: params.response,
      expires_at: new Date(agora + TTL_MS).toISOString(),
    })
    .eq("nonce", params.nonce);
}
