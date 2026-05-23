import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

/**
 * Edge Function: marcar-vencidos
 *
 * Chama a função SQL `marcar_contas_vencidas()` para atualizar o status
 * de contas a pagar e a receber que passaram da data de vencimento.
 *
 * Deve ser configurada como cron no Supabase:
 *   Schedule: "0 6 * * *"  ← todo dia às 06:00 (Brasília = UTC-3 → 09:00 UTC)
 */
Deno.serve(async (req: Request) => {
  try {
    const auth = await requireAuth(req, { "Content-Type": "application/json" });
    if (!auth.ok) return auth.response;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.rpc("marcar_contas_vencidas");

    if (error) {
      console.error("[marcar-vencidos] Erro ao executar RPC:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[marcar-vencidos] Resultado:", data);

    return new Response(
      JSON.stringify({ success: true, resultado: data }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[marcar-vencidos] Erro inesperado:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
