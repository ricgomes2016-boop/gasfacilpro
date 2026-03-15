import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// VAPI WEBHOOK HANDLER
// ============================================================================
serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("VAPI Webhook Payload:", JSON.stringify(body, null, 2));

    const messageType = body.message?.type;

    // Vapi calls this endpoint for Tools (function calling)
    if (messageType === "tool-calls") {
      const toolCall = body.message.toolCalls[0];
      const functionName = toolCall.function.name;
      const args = toolCall.function.arguments; // JSON object with parameters

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // We default to Central Gas Matriz for now. 
      // In production with multiple numbers, this would be dynamic based on the caller's number.
      let unidadeId = null;
      const { data: matriz } = await supabase.from('unidades').select('id').eq('tipo', 'matriz').maybeSingle();
      if (matriz) unidadeId = matriz.id;

      if (functionName === "consultar_preco") {
        return await handleConsultarPreco(supabase, args, toolCall.id, unidadeId, corsHeaders);
      } 
      
      if (functionName === "criar_pedido") {
        return await handleCriarPedido(supabase, args, toolCall.id, unidadeId, corsHeaders);
      }

      // Fallback for unknown tools
      return new Response(JSON.stringify({
        results: [{
          toolCallId: toolCall.id,
          result: `Função ${functionName} não reconhecida pelo sistema.`
        }]
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Default response for non-tool events (like end-of-call report)
    return new Response(JSON.stringify({ status: "success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("VAPI Webhook Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


// ============================================================================
// TOOLS IMPLEMENTATION
// ============================================================================

async function handleConsultarPreco(supabase: any, args: any, toolCallId: string, unidadeId: string | null, corsHeaders: any) {
  const produtoNome = args.produto || "P13";
  
  let q = supabase.from("produtos")
    .select("id, nome, preco, estoque")
    .ilike("nome", `%${produtoNome}%`)
    .eq("ativo", true);
    
  if (unidadeId) q = q.or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);

  const { data, error } = await q.limit(1).maybeSingle();

  let resultado = "";
  if (error || !data) {
    resultado = `Desculpe, não encontrei o produto ${produtoNome} cadastrado no momento.`;
  } else if (data.estoque <= 0) {
    resultado = `Temos o ${data.nome} por R$ ${Number(data.preco).toFixed(2)}, mas no momento está fora de estoque.`;
  } else {
    resultado = `O valor do ${data.nome} é R$ ${Number(data.preco).toFixed(2)}. Temos em estoque para pronta entrega.`;
  }

  return new Response(JSON.stringify({
    results: [{
      toolCallId: toolCallId,
      result: resultado
    }]
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}


async function handleCriarPedido(supabase: any, args: any, toolCallId: string, unidadeId: string | null, corsHeaders: any) {
  // Params expected from Vapi
  const { nome, telefone, endereco, pagamento, produto } = args;

  if (!telefone || !endereco) {
    return new Response(JSON.stringify({
      results: [{
        toolCallId: toolCallId,
        result: "Para criar o pedido preciso do endereço completo e número de telefone com DDD."
      }]
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 1. Find product
  const produtoBusca = produto || "P13";
  let qProd = supabase.from("produtos").select("id, preco, nome").ilike("nome", `%${produtoBusca}%`).eq("ativo", true);
  if (unidadeId) qProd = qProd.or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);
  
  const { data: prodData } = await qProd.limit(1).maybeSingle();
  if (!prodData) {
    return new Response(JSON.stringify({
      results: [{ toolCallId: toolCallId, result: "Não consegui identificar o produto para fechar o pedido." }]
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 2. Normalize and find/create client
  const phoneDigits = telefone.replace(/\D/g, "");
  const normalized = phoneDigits.slice(-11);
  const searchPatterns = [normalized, normalized.slice(-10)];
  
  let clienteId = null;
  const { data: clientes } = await supabase.from("clientes").select("id, nome")
    .or(searchPatterns.map(p => `telefone.ilike.%${p}%`).join(","))
    .limit(1);

  if (clientes && clientes.length > 0) {
    clienteId = clientes[0].id;
  } else {
    // Create new client if not exists
    const { data: newClient } = await supabase.from("clientes").insert({
      nome: nome || "Cliente Vapi",
      telefone: normalized,
      endereco: endereco,
      origem: "voice_ai"
    }).select().single();
    if (newClient) clienteId = newClient.id;
  }

  // 3. Transform payment method
  const pagInput = (pagamento || "").toLowerCase();
  let formaPagamento = "dinheiro";
  if (pagInput.includes("pix")) formaPagamento = "pix";
  if (pagInput.includes("cartao") || pagInput.includes("cartão")) formaPagamento = "cartao";
  if (pagInput.includes("fiado") || pagInput.includes("prazo")) formaPagamento = "fiado";

  // 4. Create Order
  const pedidoData = {
    cliente_id: clienteId,
    valor_total: prodData.preco,
    forma_pagamento: formaPagamento,
    endereco_entrega: endereco,
    canal_venda: "telefone",
    status: "pendente",
    observacoes: `Criado via Assistente de Voz Vapi.ai\nItem: ${prodData.nome}`,
    unidade_id: unidadeId
  };

  const { data: novoPedido, error } = await supabase.from("pedidos").insert(pedidoData).select().single();

  let resultMsg = "";
  if (error) {
    console.error("Erro ao criar pedido VAPI:", error);
    resultMsg = "Houve um problema sistêmico e não consegui gerar o pedido agora.";
  } else {
    // Return success to Vapi so the AI can say it out loud
    resultMsg = `Pedido criado com sucesso! O valor total é R$ ${Number(prodData.preco).toFixed(2)}. O entregador deve chegar em cerca de 30 a 45 minutos.`;
  }

  return new Response(JSON.stringify({
    results: [{
      toolCallId: toolCallId,
      result: resultMsg
    }]
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
