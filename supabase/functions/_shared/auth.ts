// Shared auth helpers for edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Require a valid JWT (user or service_role) in the Authorization header.
 * Returns { ok: true, userId, role } on success, or a Response on failure
 * that the caller should return directly.
 */
export async function requireAuth(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<
  | { ok: true; userId: string | null; role: string | null; isServiceRole: boolean }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  const token = authHeader.replace("Bearer ", "");

  // Allow service role key (used by internal crons / function-to-function calls)
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return { ok: true, userId: null, role: "service_role", isServiceRole: true };
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  return {
    ok: true,
    userId: (data.claims.sub as string) ?? null,
    role: (data.claims.role as string) ?? null,
    isServiceRole: false,
  };
}
