import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  createSupabase, 
  findCliente, 
  createOrder, 
  checkBusinessHours,
  registerCall
} from "../_shared/bia-core.ts";

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

      const supabase = createSupabase();

      // Roteamento de unidade:
      // 1) Tenta por DID (número discado) via did_empresa_routing
      // 2) Cai na unidade fixa Central Gas (mesma usada pela Bia de voz / ElevenLabs)
      const CENTRAL_GAS_UNIDADE_ID = "aa5b7c93-4fe6-4dba-a0b5-2af43cd20614";
      let unidadeId: string | null = null;

      const toNumber: string | undefined =
        body?.message?.call?.customer?.number ||
        body?.message?.call?.toPhoneNumber ||
        body?.message?.phoneNumber?.number;
      if (toNumber) {
        const digits = String(toNumber).replace(/\D/g, "");
        const last10 = digits.slice(-10);
        const { data: route } = await supabase
          .from("did_empresa_routing")
          .select("unidade_id")
          .or(`did.ilike.%${last10}%,did.ilike.%${digits}%`)
          .limit(1)
          .maybeSingle();
        if (route?.unidade_id) unidadeId = route.unidade_id;
      }
      if (!unidadeId) unidadeId = CENTRAL_GAS_UNIDADE_ID;

      // Check Business Hours / Sunday Rules
      const { isOffHours, horarioInfo, isSunday, waterDeliveryAllowed } = await checkBusinessHours(supabase, unidadeId);

      if (functionName === "consultar_preco") {
        return await handleConsultarPreco(supabase, args, toolCall.id, unidadeId, corsHeaders, { isSunday, waterDeliveryAllowed });
      } 
      
      if (functionName === "criar_pedido") {
        if (isOffHours) {
           return new Response(JSON.stringify({
            results: [{
              toolCallId: toolCall.id,
              result: `No momento estamos fechados. Nosso horário é ${horarioInfo}. Mas posso agendar para você se quiser!`
            }]
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return await handleCriarPedido(supabase, args, toolCall.id, unidadeId, corsHeaders, { isOffHours, horarioInfo });
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

async function handleConsultarPreco(supabase: any, args: any, toolCallId: string, unidadeId: string | null, corsHeaders: any, context: { isSunday: boolean, waterDeliveryAllowed: boolean }) {
  const produtoNome = args.produto || "P13";
  
  // Detecção de água no domingo
  const isWater = /água|agua|mineral|galão|galao|20\s*l/i.test(produtoNome);
  if (context.isSunday && isWater && !context.waterDeliveryAllowed) {
     return new Response(JSON.stringify({
      results: [{
        toolCallId: toolCallId,
        result: "Infelizmente aos domingos não fazemos entrega de água, apenas carga de gás. Mas você pode retirar água aqui na portaria até as 14:00!"
      }]
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let q = supabase.from("produtos")
    .select("id, nome, preco, estoque, categoria")
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
    if (context.isSunday && data.categoria === 'gas') {
      resultado += " Hoje no domingo atendemos até as 14:00.";
    }
  }

  return new Response(JSON.stringify({
    results: [{
      toolCallId: toolCallId,
      result: resultado
    }]
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}


async function handleCriarPedido(supabase: any, args: any, toolCallId: string, unidadeId: string | null, corsHeaders: any, context: any) {
  const { nome, telefone, endereco, pagamento, produto } = args;

  if (!telefone || !endereco) {
    return new Response(JSON.stringify({
      results: [{
        toolCallId: toolCallId,
        result: "Para criar o pedido preciso do endereço completo e número de telefone com DDD."
      }]
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Use bia-core findCliente for consistency
  const cliente = await findCliente(supabase, telefone);
  
  // Transform order data for bia-core createOrder
  const orderData = {
    nome: nome || cliente.nome || "Cliente Vapi",
    produto: produto || "P13",
    endereco: endereco,
    pagamento: pagamento || "dinheiro",
    quantidade: "1"
  };

  // Create order using central logic
  const pedidoResult = await createOrder(
    supabase,
    orderData,
    cliente.id,
    cliente.nome,
    nome || "Cliente Vapi",
    telefone,
    unidadeId
  );

  let resultMsg = "";
  if (!pedidoResult) {
    resultMsg = "Houve um problema sistêmico e não consegui gerar o pedido agora.";
  } else {
    resultMsg = `Pedido criado com sucesso! O entregador já foi avisado e deve chegar em 30 a 45 minutos.`;
    // Register the call to trigger frontend popup
    await registerCall(supabase, telefone, cliente.id, cliente.nome, nome || "Cliente Vapi", unidadeId, pedidoResult.pedidoId);
  }

  return new Response(JSON.stringify({
    results: [{
      toolCallId: toolCallId,
      result: resultMsg
    }]
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
