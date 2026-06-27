import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mapeia o slug do site institucional para a empresa-mãe (Central Gas) e o nome
// EXATO da unidade dessa empresa onde os produtos estão precificados.
// Sites legados podem ter empresas duplicadas com Matriz sem preço — por isso o
// roteamento sempre aponta para a unidade certa dentro da empresa `central-gas`.
const SLUG_TO_TENANT: Record<string, { empresaSlug: string; unidadeNome: string; nomeLoja: string }> = {
  centralgascp: { empresaSlug: "central-gas", unidadeNome: "Central Gas", nomeLoja: "Central Gás" },
  fortegas:     { empresaSlug: "central-gas", unidadeNome: "Forte Gás",   nomeLoja: "Forte Gás" },
  japagas:      { empresaSlug: "central-gas", unidadeNome: "Japa Gás",    nomeLoja: "Japa Gás" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { messages = [], unidadeSlug = "fortegas" } = body;

    // SECURITY: enforce strict slug allowlist. Public endpoint must not allow
    // arbitrary tenant enumeration via guessed slugs.
    if (!Object.prototype.hasOwnProperty.call(SLUG_TO_TENANT, unidadeSlug)) {
      return new Response(
        JSON.stringify({ error: "Slug não autorizado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenant = SLUG_TO_TENANT[unidadeSlug];
    const nomeLoja = tenant.nomeLoja;

    // Resolve empresa + unidade pelo nome EXATO da unidade dentro da empresa-mãe.
    const { data: empresa } = await supabase
      .from("empresas")
      .select("id, nome")
      .eq("slug", tenant.empresaSlug)
      .maybeSingle();

    if (!empresa) {
      return new Response(
        JSON.stringify({ error: `Empresa não encontrada para slug ${unidadeSlug}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: unidade } = await supabase
      .from("unidades")
      .select("id, nome")
      .eq("empresa_id", empresa.id)
      .eq("nome", tenant.unidadeNome)
      .eq("ativo", true)
      .maybeSingle();

    if (!unidade) {
      return new Response(
        JSON.stringify({ error: `Unidade "${tenant.unidadeNome}" não encontrada/ativa para ${unidadeSlug}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "identificar_cliente",
          description:
            "Busca um cliente cadastrado pelo telefone (com ou sem DDD). Retorna nome e endereço se encontrado.",
          parameters: {
            type: "object",
            properties: {
              telefone: { type: "string", description: "Telefone só com dígitos, com DDD." },
            },
            required: ["telefone"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "consultar_produtos",
          description: "Lista os produtos disponíveis (P13, P20, P45, Água) com preços atuais.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "criar_pedido",
          description:
            "Cria o pedido no ERP. Use APENAS após confirmar com o cliente: produto, quantidade e endereço.",
          parameters: {
            type: "object",
            properties: {
              cliente_id: { type: "string", description: "ID do cliente existente. Omita se for novo." },
              nome: { type: "string" },
              telefone: { type: "string" },
              endereco: { type: "string", description: "Rua" },
              numero: { type: "string" },
              bairro: { type: "string" },
              referencia: { type: "string" },
              produto: {
                type: "string",
                description: "Um de: P13, P20, P45, Água",
              },
              quantidade: { type: "number" },
              forma_pagamento: {
                type: "string",
                description: "dinheiro, pix, cartao, ou a_definir",
              },
            },
            required: ["produto", "quantidade", "telefone"],
          },
        },
      },
    ];

    const systemPrompt = `Você é a Bia, atendente virtual da ${nomeLoja}. Tom cordial, simples e objetivo. Use frases curtas (1 a 2 linhas). Sem emojis, sem gírias.

Fluxo:
1) Cumprimente e peça o telefone com DDD.
2) Use identificar_cliente. Se encontrar, confirme o nome e o endereço. Se não, peça primeiro nome, rua, número e bairro.
3) Pergunte o produto (P13, P20, P45 ou Água) e a quantidade. Use consultar_produtos quando pedirem preço.
4) Confirme produto, quantidade, valor, endereço e forma de pagamento antes de criar o pedido.
5) Chame criar_pedido e informe o número do pedido e o prazo (até 30 min).

Regras:
- Não invente preços nem endereços.
- Se o cliente sair do assunto, retome com educação.
- Não peça CPF, e-mail ou dados sensíveis.
- Sempre se identifique como "Bia da ${nomeLoja}".`;

    // Loop de tool calling (até 5 iterações)
    let convo: any[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    for (let i = 0; i < 5; i++) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: convo,
          tools,
        }),
      });

      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error("AI gateway error:", aiResp.status, t);
        if (aiResp.status === 429)
          return new Response(JSON.stringify({ error: "Muitas requisições. Tente em instantes." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (aiResp.status === 402)
          return new Response(JSON.stringify({ error: "Créditos esgotados. Avise o administrador." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        return new Response(JSON.stringify({ error: "Erro no provedor de IA" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await aiResp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) break;

      // Sem tool calls? termina
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return new Response(
          JSON.stringify({ reply: msg.content ?? "" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Adiciona a msg do assistant com tool_calls ao histórico
      convo.push(msg);

      // Executa cada tool
      for (const tc of msg.tool_calls) {
        const args = JSON.parse(tc.function.arguments || "{}");
        let result: any = {};
        try {
          if (tc.function.name === "identificar_cliente") {
            result = await identificarCliente(supabase, empresa.id, unidade.id, args.telefone);
          } else if (tc.function.name === "consultar_produtos") {
            result = await consultarProdutos(supabase, empresa.id, unidade.id);
          } else if (tc.function.name === "criar_pedido") {
            result = await criarPedido(supabase, empresa.id, unidade.id, args);
          } else {
            result = { error: "Tool desconhecida" };
          }
        } catch (e: any) {
          result = { error: e.message };
        }

        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    return new Response(
      JSON.stringify({ reply: "Desculpe, tive um problema. Pode repetir, por favor?" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[BIA-SITE-CHAT] Error:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function identificarCliente(
  supabase: any,
  empresaId: string,
  unidadeId: string,
  telefoneRaw: string
) {
  const telefone = String(telefoneRaw || "").replace(/\D/g, "");
  if (!telefone) return { error: "Telefone inválido" };

  const last = telefone.slice(-11);
  const last10 = telefone.slice(-10);

  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nome, telefone, endereco, numero, bairro, cidade")
    .eq("empresa_id", empresaId)
    .or(`telefone.ilike.%${last}%,telefone.ilike.%${last10}%`)
    .limit(1);

  // Registra chamada recebida (popup CallerID)
  await supabase.from("chamadas_recebidas").insert({
    telefone,
    cliente_id: clientes?.[0]?.id ?? null,
    cliente_nome: clientes?.[0]?.nome ?? null,
    tipo: "voip",
    status: "recebida",
    unidade_id: unidadeId,
    observacoes: "🤖 Pedido criado pela Bia (site institucional)",
  });

  if (clientes && clientes.length > 0) {
    const c = clientes[0];
    return {
      encontrado: true,
      cliente_id: c.id,
      nome: c.nome,
      endereco: c.endereco,
      numero: c.numero,
      bairro: c.bairro,
      cidade: c.cidade,
    };
  }
  return { encontrado: false };
}

async function consultarProdutos(supabase: any, unidadeId: string) {
  const { data } = await supabase
    .from("produtos")
    .select("id, nome, preco")
    .eq("unidade_id", unidadeId)
    .eq("categoria", "gas")
    .order("nome");

  const { data: agua } = await supabase
    .from("produtos")
    .select("id, nome, preco")
    .eq("unidade_id", unidadeId)
    .ilike("nome", "%água%")
    .limit(1);

  const lista = [...(data ?? []), ...(agua ?? [])].filter(
    (p) => !/vazio/i.test(p.nome)
  );
  return { produtos: lista.map((p) => ({ nome: p.nome, preco: p.preco })) };
}

async function criarPedido(
  supabase: any,
  empresaId: string,
  unidadeId: string,
  args: any
) {
  const {
    cliente_id,
    nome,
    telefone,
    endereco,
    numero,
    bairro,
    referencia,
    produto,
    quantidade,
    forma_pagamento,
  } = args;

  if (!produto || !quantidade) return { error: "Produto e quantidade obrigatórios" };

  let finalClienteId = cliente_id;
  if (!finalClienteId) {
    if (!nome || !telefone) return { error: "Nome e telefone obrigatórios para cliente novo" };
    const telDigits = String(telefone).replace(/\D/g, "");
    const { data: novoCliente, error: clienteErr } = await supabase
      .from("clientes")
      .insert({
        nome,
        telefone: telDigits,
        endereco,
        numero,
        bairro,
        empresa_id: empresaId,
        ativo: true,
      })
      .select("id")
      .single();
    if (clienteErr) return { error: "Erro ao cadastrar cliente: " + clienteErr.message };
    finalClienteId = novoCliente.id;
    await supabase
      .from("cliente_unidades")
      .insert({ cliente_id: finalClienteId, unidade_id: unidadeId });
  }

  // Resolve produto
  const prodNorm = String(produto).toUpperCase().replace(/\s/g, "");
  let nomeProduto = "";
  if (prodNorm.includes("P13") || prodNorm === "13") nomeProduto = "Gás P13";
  else if (prodNorm.includes("P20") || prodNorm === "20") nomeProduto = "Gás P20";
  else if (prodNorm.includes("P45") || prodNorm === "45") nomeProduto = "Gás P45";
  else if (prodNorm.includes("AGUA") || prodNorm.includes("ÁGUA"))
    nomeProduto = "Água Mineral 20L";
  else return { error: `Produto não reconhecido: ${produto}` };

  const { data: prod } = await supabase
    .from("produtos")
    .select("id, preco, nome")
    .eq("unidade_id", unidadeId)
    .ilike("nome", nomeProduto)
    .limit(1)
    .maybeSingle();

  if (!prod) return { error: `Produto ${nomeProduto} não cadastrado` };

  const qty = Number(quantidade) || 1;
  const precoUnit = Number(prod.preco) || 0;
  const valorTotal = precoUnit * qty;

  if (precoUnit <= 0) {
    return {
      error: `O produto ${nomeProduto} ainda não tem preço cadastrado nesta loja. Avise o atendente para configurar o preço antes de finalizar o pedido.`,
    };
  }

  const { data: pedido, error: pedidoErr } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: finalClienteId,
      unidade_id: unidadeId,
      status: "pendente",
      canal_venda: "site_ia",
      forma_pagamento: forma_pagamento || "a_definir",
      valor_total: valorTotal,
      endereco_entrega: endereco ?? null,
      numero_entrega: numero ?? null,
      bairro_entrega: bairro ?? null,
      observacoes: `Pedido pela Bia (site).${referencia ? " Ref: " + referencia : ""}${telefone ? " Tel: " + telefone : ""}`,
    })
    .select("id, numero_sequencial")
    .single();

  if (pedidoErr) return { error: "Erro ao criar pedido: " + pedidoErr.message };

  const { error: itemErr } = await supabase.from("pedido_itens").insert({
    pedido_id: pedido.id,
    produto_id: prod.id,
    quantidade: qty,
    preco_unitario: precoUnit,
  });

  if (itemErr) {
    // rollback do pedido para não deixar lixo sem itens
    await supabase.from("pedidos").delete().eq("id", pedido.id);
    return { error: "Erro ao gravar item do pedido: " + itemErr.message };
  }

  return {
    sucesso: true,
    numero_pedido: pedido.numero_sequencial,
    produto: nomeProduto,
    quantidade: qty,
    valor_total: valorTotal,
  };
}
