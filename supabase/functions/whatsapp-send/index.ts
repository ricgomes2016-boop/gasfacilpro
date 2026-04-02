import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabase, resolveConfig, sendMessage, saveMessage } from "../_shared/bia-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
  }
});
