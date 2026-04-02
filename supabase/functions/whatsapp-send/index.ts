<<<<<<< HEAD
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabase, resolveConfig, sendMessage, saveMessage } from "../_shared/bia-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
=======
// whatsapp-send — Envia mensagem do operador humano via WhatsApp (Meta/Evolution/etc)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveConfig, sendMessage } from "../_shared/bia-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
>>>>>>> d40740467ebe81de75e4e2bb8e545d10e44d55ab
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
<<<<<<< HEAD
    const supabase = createSupabase();
    
    // Check Authorization to ensure this is a logged-in human
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { conversa_id, content, unidade_id, provedor = "meta" } = body;

    if (!conversa_id || !content) {
      return new Response(JSON.stringify({ error: "Missing conversa_id or content" }), { status: 400, headers: corsHeaders });
    }

    // Load conversation to get telefone
    const { data: conversa } = await supabase
      .from("ai_conversas")
      .select("telefone")
      .eq("id", conversa_id)
      .maybeSingle();

    if (!conversa || !conversa.telefone) {
      return new Response(JSON.stringify({ error: "Conversation or telefone not found" }), { status: 404, headers: corsHeaders });
    }

    // Resolve Provider config
    const config = await resolveConfig(supabase, provedor, unidade_id || null, null);
    if (!config) {
      return new Response(JSON.stringify({ error: `No active configuration found for provider: ${provedor}` }), { status: 404, headers: corsHeaders });
    }

    // Send via API
    await sendMessage(config, conversa.telefone, content);

    // Save as 'human' in database to show up in chat
    await saveMessage(supabase, conversa_id, "human", content, { source: "omnichannel" });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("whatsapp-send error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
=======
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { conversa_id, content, unidade_id } = await req.json();

    if (!conversa_id || !content?.trim()) {
      return new Response(JSON.stringify({ error: "conversa_id e content são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Buscar telefone da conversa
    const { data: conversa, error: convErr } = await supabase
      .from("ai_conversas")
      .select("id, telefone")
      .eq("id", conversa_id)
      .maybeSingle();

    if (convErr || !conversa) {
      return new Response(JSON.stringify({ error: "Conversa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conversa.telefone) {
      return new Response(JSON.stringify({ error: "Conversa sem telefone associado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const telefone = conversa.telefone;

    // 2. Resolver config do WhatsApp — tenta meta primeiro, depois evolution, zapi, uazapi, gateway
    const provedores = ["meta", "evolution", "zapi", "uazapi", "gateway"] as const;
    let config = null;
    for (const provedor of provedores) {
      config = await resolveConfig(supabase, provedor, unidade_id || null, null);
      if (config) break;
    }

    if (!config) {
      return new Response(JSON.stringify({ error: "Nenhuma integração WhatsApp ativa encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Enviar mensagem via WhatsApp
    await sendMessage(config, telefone, content.trim());

    // 4. Salvar mensagem como 'human' no banco
    const { error: insertErr } = await supabase.from("ai_mensagens").insert({
      conversa_id,
      role: "human",
      content: content.trim(),
      metadata: { source: "whatsapp-send", provedor: config.provedor },
    });

    if (insertErr) {
      console.error("Erro ao salvar mensagem:", insertErr);
      return new Response(JSON.stringify({ error: "Mensagem enviada mas erro ao salvar", details: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Atualizar updated_at da conversa
    await supabase.from("ai_conversas").update({ updated_at: new Date().toISOString() }).eq("id", conversa_id);

    return new Response(JSON.stringify({ ok: true, provedor: config.provedor }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-send error:", error);
    return new Response(JSON.stringify({ error: "Erro interno", details: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
>>>>>>> d40740467ebe81de75e4e2bb8e545d10e44d55ab
  }
});
