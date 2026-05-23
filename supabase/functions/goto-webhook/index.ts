import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-goto-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require shared secret to prevent unauthenticated call injection.
    const expectedSecret = Deno.env.get("GOTO_WEBHOOK_SECRET");
    if (expectedSecret) {
      const provided =
        req.headers.get("x-goto-secret") ||
        req.headers.get("x-webhook-secret") ||
        req.headers.get("x-goto-signature") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        new URL(req.url).searchParams.get("secret") ||
        "";
      if (provided !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log("GoTo webhook received:", JSON.stringify(body));

    // GoTo Connect sends call events with caller info
    const telefone = body.callerNumber || body.caller_number || body.from || body.phoneNumber || "";
    const tipo = body.channel === "whatsapp" ? "whatsapp" : "telefone";

    if (!telefone) {
      return new Response(JSON.stringify({ error: "No phone number" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize phone: remove non-digits, keep last 10-11 digits
    const digits = telefone.replace(/\D/g, "");
    const normalized = digits.slice(-11);
    const searchPatterns = [normalized, normalized.slice(-10)];

    // Try to find client by phone
    let clienteId = null;
    let clienteNome = null;

    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nome, telefone")
      .or(searchPatterns.map(p => `telefone.ilike.%${p}%`).join(","))
      .limit(1);

    if (clientes && clientes.length > 0) {
      clienteId = clientes[0].id;
      clienteNome = clientes[0].nome;
    }

    // Insert call record (will trigger realtime for popup)
    const { data: chamada, error } = await supabase
      .from("chamadas_recebidas")
      .insert({
        telefone: telefone,
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        tipo,
        status: "recebida",
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      throw error;
    }

    return new Response(JSON.stringify({ success: true, chamada }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
