import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Status = "connected" | "expiring" | "needs_reauth" | "not_oauth" | "unknown";

interface AccountResult {
  id: string;
  nome_conta: string;
  plataforma: string;
  status: Status;
  expires_at: string | null;
  expires_in_days: number | null;
  provider_ok: boolean;
  message: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAuth(req, corsHeaders);
  if (!auth.ok) return auth.response;
  if (!auth.userId && !auth.isServiceRole) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const accountId: string | undefined = body.account_id;
    const empresaId: string | undefined = body.empresa_id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Se for usuário, valida acesso à empresa
    if (!auth.isServiceRole && empresaId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", auth.userId!)
        .maybeSingle();
      if (profile?.empresa_id !== empresaId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let query = supabase
      .from("social_accounts")
      .select("id, empresa_id, nome_conta, plataforma, access_token, token_expires_at, page_id, ig_business_id, conectado_via, ativo");

    if (accountId) query = query.eq("id", accountId);
    else if (empresaId) query = query.eq("empresa_id", empresaId);
    else {
      return new Response(JSON.stringify({ error: "account_id ou empresa_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: contas, error } = await query;
    if (error) throw error;

    const now = Date.now();
    const results: AccountResult[] = [];

    for (const c of contas ?? []) {
      const base: AccountResult = {
        id: c.id,
        nome_conta: c.nome_conta,
        plataforma: c.plataforma,
        status: "unknown",
        expires_at: c.token_expires_at,
        expires_in_days: null,
        provider_ok: false,
        message: "",
      };

      if (c.conectado_via !== "oauth" || !c.access_token) {
        base.status = "not_oauth";
        base.message = "Cadastro manual — sem OAuth para testar.";
        results.push(base);
        continue;
      }

      // Testa token contra Graph API
      try {
        const url = new URL("https://graph.facebook.com/v21.0/me");
        url.searchParams.set("fields", "id,name");
        url.searchParams.set("access_token", c.access_token);

        const r = await fetch(url.toString());
        const data = await r.json();

        if (!r.ok || data.error) {
          base.status = "needs_reauth";
          base.provider_ok = false;
          base.message = "Token inválido ou revogado — reconecte a conta.";
          base.error = data?.error?.message || `HTTP ${r.status}`;

          // Marca inativa se ainda estiver ativa
          if (c.ativo) {
            await supabase.from("social_accounts").update({ ativo: false }).eq("id", c.id);
          }
          results.push(base);
          continue;
        }

        base.provider_ok = true;

        // Calcula expiração
        if (c.token_expires_at) {
          const expMs = new Date(c.token_expires_at).getTime();
          const diffDays = Math.floor((expMs - now) / (24 * 60 * 60 * 1000));
          base.expires_in_days = diffDays;
          if (diffDays <= 0) {
            base.status = "needs_reauth";
            base.message = "Token expirado — reconecte a conta.";
          } else if (diffDays <= 7) {
            base.status = "expiring";
            base.message = `Token expira em ${diffDays} dia(s). Renovação automática rodará em breve.`;
          } else {
            base.status = "connected";
            base.message = `Conectado. Token válido por ${diffDays} dias.`;
          }
        } else {
          base.status = "connected";
          base.message = "Conectado (sem validade registrada).";
        }
      } catch (err) {
        base.status = "unknown";
        base.message = "Falha ao contatar Meta Graph API.";
        base.error = String(err);
      }

      results.push(base);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meta-test-connection error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
