import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(systemPrompt: string, userPrompt: string, apiKey: string, temperature = 0.1) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function extractJSON(content: string) {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    let userId = "";
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload.sub;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid token format" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUserClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Role check
    const { data: roles } = await supabaseUserClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const allowedRoles = ["admin", "gestor", "operacional", "entregador"];
    if (!roles?.some((r: any) => allowedRoles.includes(r.role))) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { comando, unidade_id } = await req.json();
    if (!comando) {
      return new Response(JSON.stringify({ error: "Comando vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);
    const apiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Pega empresa_id do profile
    const { data: profile } = await sb
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", userId)
      .maybeSingle();

    const empresaId = profile?.empresa_id;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: "Empresa não identificada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ETAPA 1: Extrair pistas + detectar intenção (venda OU consulta de fiado/notinhas)
    const extractPrompt = `Você analisa um comando do operador em português. Retorne APENAS JSON válido:
{
  "intencao": "venda" ou "consulta_fiado" (use "consulta_fiado" quando o operador pergunta sobre fiado, notinhas, débito, dívida, conta, o que cliente deve, quanto deve, o que tem em aberto, etc.),
  "nome": "primeiro nome ou nome completo do cliente, se mencionado, senão null",
  "telefone": "apenas dígitos do telefone, se mencionado, senão null",
  "endereco_rua": "nome da rua/avenida sem número, senão null",
  "numero": "apenas o número do endereço, senão null",
  "bairro": "nome do bairro, se mencionado, senão null"
}
Exemplos:
- "lança um P13 pra Maria da Rua das Flores" → intencao: "venda"
- "como tá o fiado da Maria?" → intencao: "consulta_fiado"
- "quanto o João deve?" → intencao: "consulta_fiado"
- "tem notinha em aberto da Ana?" → intencao: "consulta_fiado"
Não invente dados. Use null quando incerto.`;

    const cluesContent = await callAI(extractPrompt, comando, apiKey, 0);
    const clues = extractJSON(cluesContent) || {};

    console.log("Pistas extraídas:", clues);

    // ETAPA 2: Buscar candidatos no banco via RPC
    const { data: candidatos, error: rpcError } = await sb.rpc("buscar_clientes_para_ia", {
      _empresa_id: empresaId,
      _unidade_id: unidade_id || null,
      _nome: clues.nome || null,
      _telefone: clues.telefone || null,
      _endereco_rua: clues.endereco_rua || null,
      _numero: clues.numero || null,
      _bairro: clues.bairro || null,
      _limite: 15,
    });

    if (rpcError) console.error("RPC error:", rpcError);

    // Carrega produtos (geralmente são poucos)
    const { data: produtos } = await sb
      .from("produtos")
      .select("id, nome, preco, estoque, categoria")
      .eq("ativo", true)
      .or("tipo_botijao.is.null,tipo_botijao.neq.vazio")
      .limit(100);

    const candidatosList = (candidatos || []).length > 0
      ? (candidatos || []).map((c: any) =>
          `- id:${c.id} | "${c.nome}" | tel:${c.telefone || '-'} | ${c.endereco || '-'}, ${c.numero || 's/n'} - ${c.bairro || '-'}`
        ).join("\n")
      : "(nenhum cliente similar encontrado no banco)";

    const produtosList = (produtos || []).map((p: any) =>
      `- "${p.nome}" R$${p.preco} (id: ${p.id})`
    ).join("\n");

    // ETAPA 3: IA escolhe o cliente correto e monta a venda
    const systemPrompt = `Você é um assistente de vendas de uma distribuidora de gás. Interprete o comando do usuário e retorne JSON estruturado para lançar a venda.

CANDIDATOS DE CLIENTE (já filtrados por similaridade de nome/telefone/endereço):
${candidatosList}

PRODUTOS DISPONÍVEIS:
${produtosList}

REGRAS CRÍTICAS:
1. SEMPRE prefira reutilizar um cliente da lista de candidatos. Se houver candidato cujo NOME e/ou ENDEREÇO bate com o comando, use o id dele em "cliente_id". NÃO crie cliente novo nesse caso.
2. Se NENHUM candidato bater de forma plausível, retorne "cliente_id": null e preencha os campos de endereço com base no comando.
3. Para identificar o produto: "gás", "botijão", "P13" → procure o produto correspondente. "1 gás" significa quantidade 1.
4. Quantidade padrão = 1 se não especificada.
5. Forma de pagamento: dinheiro|pix|cartao_credito|cartao_debito|fiado. "crédito"=cartao_credito, "débito"=cartao_debito. null se não mencionado.
6. canal_venda: telefone|whatsapp|balcao|portaria. Padrão "telefone".
7. Comandos por voz podem ter erros — interprete da melhor forma.

Retorne APENAS JSON neste formato:
{
  "cliente_id": "uuid_do_candidato_ou_null",
  "cliente_nome": "nome",
  "cliente_telefone": "telefone ou null",
  "endereco": "rua sem número",
  "numero": "número ou null",
  "complemento": "ou null",
  "bairro": "ou null",
  "cep": "ou null",
  "cidade": "ou null",
  "itens": [{ "produto_id": "uuid", "nome": "nome", "quantidade": 1, "preco_unitario": 100 }],
  "forma_pagamento": "dinheiro|pix|cartao_credito|cartao_debito|fiado|null",
  "canal_venda": "telefone|whatsapp|balcao|portaria",
  "observacoes": "info extra do comando ou string vazia"
}`;

    const finalContent = await callAI(systemPrompt, comando, apiKey, 0.1);
    const parsed = extractJSON(finalContent);

    if (!parsed) {
      return new Response(JSON.stringify({ error: "Não foi possível interpretar o comando", raw: finalContent }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Erro ao processar comando. Tente novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
