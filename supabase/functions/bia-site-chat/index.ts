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
  fortegas:     { empresaSlug: "forte-gas",   unidadeNome: "Forte Gás",   nomeLoja: "Forte Gás" },
  japagas:      { empresaSlug: "central-gas", unidadeNome: "Japa Gás",    nomeLoja: "Japa Gás" },
};

// A indisponibilidade do atendimento é configurada por site/unidade. Nunca use
// o slug da empresa-mãe aqui: Forte Gás, Central Gás e Japa Gás compartilham a
// mesma empresa no banco, mas operam canais de atendimento independentes.
const BIA_PAUSED_UNIDADE_SLUGS = new Set(["centralgascp"]);

function formatarTelefoneBr(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "").replace(/^55/, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits || null;
}

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
      .select("id, nome, telefone, whatsapp_notificacao_pedido")
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

    if (BIA_PAUSED_UNIDADE_SLUGS.has(unidadeSlug)) {
      const contato = formatarTelefoneBr(
        unidade.whatsapp_notificacao_pedido || unidade.telefone
      );
      const reply = contato
        ? `O atendimento automático da ${nomeLoja} está temporariamente indisponível. Por favor, fale com a loja pelo número ${contato}.`
        : `O atendimento automático da ${nomeLoja} está temporariamente indisponível. Por favor, fale diretamente com a loja.`;
      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
            "Cria o pedido no ERP. NÃO chame esta função até o cliente ter respondido SIM explicitamente a uma pergunta de confirmação final (ex.: 'Posso confirmar seu pedido?'). Sempre passe confirmado_pelo_cliente=true apenas se o cliente acabou de confirmar.",
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
              confirmado_pelo_cliente: {
                type: "boolean",
                description: "Marque true APENAS se o cliente respondeu SIM na pergunta de confirmação final.",
              },
            },
            required: ["produto", "quantidade", "telefone", "confirmado_pelo_cliente"],
          },
        },
      },
    ];

    const systemPrompt = `Você é a Bia, atendente virtual da ${nomeLoja}. Tom cordial, simples e objetivo. Use frases curtas (1 a 2 linhas). Sem emojis, sem gírias.

Fluxo:
1) Cumprimente e peça o telefone com DDD.
2) Use identificar_cliente. Se encontrar, confirme o nome e o endereço. Se não, peça primeiro nome, rua, número e bairro.
3) Pergunte o produto (P13, P20, P45 ou Água) e a quantidade. Use consultar_produtos quando pedirem preço.
4) Apresente um RESUMO completo (produto, quantidade, valor total, endereço, forma de pagamento) e pergunte literalmente: "Posso confirmar seu pedido?".
5) AGUARDE a resposta do cliente. Só chame criar_pedido (com confirmado_pelo_cliente=true) DEPOIS que o cliente responder SIM. Se responder não ou pedir ajuste, corrija e pergunte de novo.
6) Após criar_pedido, informe o número do pedido e o prazo (até 30 min).

Regras:
- NUNCA chame criar_pedido antes da confirmação final do cliente.
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

// Fonte oficial de preços da Bia: configuracoes_empresa.regras_bia.tabela_precos
async function getTabelaPrecosBia(
  supabase: any,
  empresaId: string
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("configuracoes_empresa")
    .select("regras_bia")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const tp = (data?.regras_bia as any)?.tabela_precos || {};
  const pick = (k: string) =>
    Number(tp?.[k]?.preco_desconto) > 0
      ? Number(tp[k].preco_desconto)
      : Number(tp?.[k]?.preco) || 0;
  return {
    "Gás P13": pick("gas_p13"),
    "Gás P20": pick("gas_p20"),
    "Gás P45": pick("gas_p45"),
    "Água Mineral 20L": pick("agua_20l"),
  };
}

async function consultarProdutos(supabase: any, empresaId: string, unidadeId: string) {
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

  const tabela = await getTabelaPrecosBia(supabase, empresaId);

  const lista = [...(data ?? []), ...(agua ?? [])].filter(
    (p) => !/vazio/i.test(p.nome)
  );
  return {
    produtos: lista.map((p) => {
      const precoCad = Number(p.preco) || 0;
      const precoTab = tabela[p.nome] || 0;
      return { nome: p.nome, preco: precoCad > 0 ? precoCad : precoTab };
    }).filter((p) => p.preco > 0),
  };
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
    confirmado_pelo_cliente,
  } = args;

  if (confirmado_pelo_cliente !== true) {
    return { error: "Peça a confirmação final ao cliente (\"Posso confirmar seu pedido?\") antes de criar o pedido." };
  }

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
  let precoUnit = Number(prod.preco) || 0;
  if (precoUnit <= 0) {
    const tabela = await getTabelaPrecosBia(supabase, empresaId);
    precoUnit = tabela[nomeProduto] || 0;
  }
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
      canal_venda: "site",
      origem_pedido: "site",
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
