import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Cliente {
  nome: string;
  telefone: string | null;
  cpf: string | null;
  email: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  tipo: string;
}

interface Body {
  empresa_id: string;
  unidade_id: string;
  clientes: Cliente[];
  offset?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: Body = await req.json();
    const { empresa_id, unidade_id, clientes } = body;

    if (!empresa_id || !unidade_id || !Array.isArray(clientes)) {
      return new Response(JSON.stringify({ error: "params inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant ownership check (unless service_role)
    if (!auth.isServiceRole) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", auth.userId)
        .maybeSingle();
      if (!profile || profile.empresa_id !== empresa_id) {
        return new Response(JSON.stringify({ error: "Acesso negado a esta empresa" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: unidade } = await supabase
        .from("unidades")
        .select("id")
        .eq("id", unidade_id)
        .eq("empresa_id", empresa_id)
        .maybeSingle();
      if (!unidade) {
        return new Response(JSON.stringify({ error: "Unidade não pertence à empresa" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const BATCH = 500;
    let inseridos = 0;
    let associados = 0;
    let erros: string[] = [];

    for (let i = 0; i < clientes.length; i += BATCH) {
      const lote = clientes.slice(i, i + BATCH).map((c) => ({
        nome: c.nome,
        telefone: c.telefone,
        cpf: c.cpf,
        email: c.email,
        endereco: c.endereco,
        numero: c.numero,
        bairro: c.bairro,
        cidade: c.cidade,
        cep: c.cep,
        tipo: c.tipo || "residencial",
        empresa_id,
        ativo: true,
      }));

      const { data, error } = await supabase
        .from("clientes")
        .insert(lote)
        .select("id");

      if (error) {
        erros.push(`lote ${i}: ${error.message}`);
        continue;
      }
      inseridos += data?.length || 0;

      // Associate to unidade
      if (data && data.length > 0) {
        const assoc = data.map((d) => ({ cliente_id: d.id, unidade_id }));
        const { error: aErr } = await supabase.from("cliente_unidades").insert(assoc);
        if (aErr) erros.push(`assoc ${i}: ${aErr.message}`);
        else associados += assoc.length;
      }
    }

    return new Response(
      JSON.stringify({ inseridos, associados, erros: erros.slice(0, 10), total_erros: erros.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
