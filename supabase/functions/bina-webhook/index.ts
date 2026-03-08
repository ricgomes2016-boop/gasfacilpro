import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log("Bina webhook received:", JSON.stringify(body));

    // Accept from Android app, GoTo Connect, or manual test
    // Fields: telefone, callerNumber, caller_number, from, phoneNumber
    const rawPhone =
      body.telefone ||
      body.callerNumber ||
      body.caller_number ||
      body.from ||
      body.phoneNumber ||
      "";

    if (!rawPhone) {
      return new Response(JSON.stringify({ error: "No phone number provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine call type
    const rawTipo = (body.tipo || body.channel || body.type || "celular").toLowerCase();
    let tipo = "celular";
    if (rawTipo.includes("whatsapp")) tipo = "whatsapp";
    else if (rawTipo.includes("voip") || rawTipo.includes("sip") || rawTipo.includes("goto")) tipo = "voip";

    // Normalize phone number: keep only digits, last 11 chars
    const digits = rawPhone.replace(/\D/g, "");
    const normalized = digits.slice(-11);
    const normalized10 = digits.slice(-10);

    // Try to find a matching client by phone
    let clienteId: string | null = null;
    let clienteNome: string | null = null;

    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, nome, telefone")
      .or(
        [normalized, normalized10]
          .filter(Boolean)
          .map((p) => `telefone.ilike.%${p}%`)
          .join(",")
      )
      .eq("ativo", true)
      .limit(1);

    if (clientes && clientes.length > 0) {
      clienteId = clientes[0].id;
      clienteNome = clientes[0].nome;
    }

    // Insert call record (triggers Realtime → CallerIdPopup)
    const observacoesStr = body.bateria ? `Bateria: ${body.bateria}%` : null;
    const { data: chamada, error } = await supabase
      .from("chamadas_recebidas")
      .insert({
        telefone: rawPhone,
        cliente_id: clienteId,
        cliente_nome: clienteNome,
        tipo,
        status: "recebida",
        observacoes: observacoesStr
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      throw error;
    }

    console.log("Chamada registrada:", chamada.id, tipo, rawPhone);

    return new Response(
      JSON.stringify({
        success: true,
        chamada_id: chamada.id,
        cliente_encontrado: !!clienteId,
        cliente_nome: clienteNome,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Bina webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
