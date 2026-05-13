// whatsapp-refresh-profile — Atualiza foto de perfil da loja (e opcionalmente de contatos)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveConfig, fetchStoreProfilePicture, fetchContactProfilePicture } from "../_shared/bia-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const { unidade_id, conversa_id } = body || {};

    if (!unidade_id) {
      return new Response(JSON.stringify({ ok: false, error: "unidade_id é obrigatório" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve qualquer provider ativo para a unidade
    const provedores = ["meta", "evolution", "zapi", "uazapi", "gateway"] as const;
    let config: any = null;
    for (const p of provedores) {
      config = await resolveConfig(supabase, p, unidade_id, null);
      if (config) break;
    }
    if (!config) {
      return new Response(JSON.stringify({ ok: false, reason: "no_active_integration" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Atualiza foto da loja
    const lojaUrl = await fetchStoreProfilePicture(config);
    if (lojaUrl) {
      await supabase.from("integracoes_whatsapp")
        .update({ loja_foto_url: lojaUrl, loja_foto_atualizada_em: new Date().toISOString() })
        .eq("unidade_id", unidade_id)
        .eq("provedor", config.provedor);
    }

    // 2. Atualiza foto de uma conversa específica (opcional)
    let contatoUrl: string | null = null;
    if (conversa_id) {
      const { data: conv } = await supabase
        .from("ai_conversas").select("telefone").eq("id", conversa_id).maybeSingle();
      if (conv?.telefone) {
        contatoUrl = await fetchContactProfilePicture(config, conv.telefone);
        if (contatoUrl) {
          await supabase.from("ai_conversas")
            .update({ foto_url: contatoUrl, foto_atualizada_em: new Date().toISOString() })
            .eq("id", conversa_id);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, loja_foto_url: lojaUrl, contato_foto_url: contatoUrl, provedor: config.provedor }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-refresh-profile error:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
