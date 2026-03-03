import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tipo, destinatario_email, destinatario_nome, assunto, corpo, referencia_id, referencia_tipo } = await req.json();

    if (!tipo || !destinatario_email || !assunto) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: tipo, destinatario_email, assunto" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's empresa
    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id, full_name")
      .eq("user_id", user.id)
      .single();

    // Log the email attempt (simulated — no real SMTP yet)
    const { data: logEntry, error: logError } = await supabase
      .from("email_log")
      .insert({
        user_id: user.id,
        empresa_id: profile?.empresa_id || null,
        tipo,
        destinatario_email,
        destinatario_nome: destinatario_nome || null,
        assunto,
        corpo: corpo || null,
        referencia_id: referencia_id || null,
        referencia_tipo: referencia_tipo || null,
        status: "simulado",
        provedor: "simulado",
      })
      .select("id")
      .single();

    if (logError) {
      console.error("Error logging email:", logError);
      throw new Error("Erro ao registrar e-mail");
    }

    // In production, this would call Resend/SendGrid/SES API
    // For now, we return success with simulation flag
    console.log(`[SIMULATED EMAIL] To: ${destinatario_email} | Subject: ${assunto} | Type: ${tipo}`);

    return new Response(JSON.stringify({
      success: true,
      simulated: true,
      message: `E-mail "${assunto}" para ${destinatario_email} registrado com sucesso (modo simulação).`,
      id: logEntry?.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
