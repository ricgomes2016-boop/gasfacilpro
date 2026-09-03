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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SITE_USER_ID = "00000000-0000-0000-0000-000000000000";

async function upsertSiteConversation(
  supabase: any,
  conversationId: string,
  empresaId: string,
  unidadeId: string,
  nomeLoja: string,
) {
  const { error } = await supabase.from("ai_conversas").upsert({
    id: conversationId,
    user_id: SITE_USER_ID,
    titulo: `Site: ${nomeLoja}`,
    subject: "site_institucional",
    status: "active",
    empresa_id: empresaId,
    unidade_id: unidadeId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) throw new Error(`Falha ao registrar conversa: ${error.message}`);
}

async function saveSiteMessage(
  supabase: any,
  conversationId: string,
  empresaId: string,
  unidadeId: string,
  role: "user" | "assistant",
  content: string,
  requestId: string,
  extra: Record<string, unknown> = {},
) {
  const { error } = await supabase.from("ai_mensagens").insert({
    conversa_id: conversationId,
    empresa_id: empresaId,
    unidade_id: unidadeId,
    role,
    content,
    status: "sent",
    metadata: { source: "bia-site-chat", request_id: requestId, ...extra },
  });
  if (error) console.error("[BIA-SITE-CHAT] Falha ao auditar mensagem", error);
}

async function getSavedReply(supabase: any, conversationId: string, requestId: string) {
  const { data } = await supabase.from("ai_mensagens")
    .select("content")
    .eq("conversa_id", conversationId)
    .eq("role", "assistant")
    .contains("metadata", { request_id: requestId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.content || null;
}

function jsonReply(reply: string, conversationId: string, status = 200) {
  return new Response(JSON.stringify({ reply, conversationId }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    const conversationId = UUID_RE.test(String(body.conversationId || ""))
      ? String(body.conversationId)
      : crypto.randomUUID();
    const messageId = UUID_RE.test(String(body.messageId || ""))
      ? String(body.messageId)
      : crypto.randomUUID();

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

    await upsertSiteConversation(supabase, conversationId, empresa.id, unidade.id, nomeLoja);

    const savedReply = await getSavedReply(supabase, conversationId, messageId);
    if (savedReply) return jsonReply(savedReply, conversationId);

    const currentUserMessage = [...messages].reverse().find((m: any) => m?.role === "user")?.content;
    if (typeof currentUserMessage === "string" && currentUserMessage.trim()) {
      await saveSiteMessage(
        supabase,
        conversationId,
        empresa.id,
        unidade.id,
        "user",
        currentUserMessage.trim(),
        messageId,
      );
    }

    if (BIA_PAUSED_UNIDADE_SLUGS.has(unidadeSlug)) {
      const contato = formatarTelefoneBr(
        unidade.whatsapp_notificacao_pedido || unidade.telefone
      );
      const reply = contato
        ? `O atendimento automático da ${nomeLoja} está temporariamente indisponível. Por favor, fale com a loja pelo número ${contato}.`
        : `O atendimento automático da ${nomeLoja} está temporariamente indisponível. Por favor, fale diretamente com a loja.`;
      await saveSiteMessage(supabase, conversationId, empresa.id, unidade.id, "assistant", reply, messageId);
      return jsonReply(reply, conversationId);
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
        const reply = msg.content ?? "";
        await saveSiteMessage(supabase, conversationId, empresa.id, unidade.id, "assistant", reply, messageId);
        return jsonReply(reply, conversationId);
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
            result = await criarPedido(supabase, empresa.id, unidade.id, args, messageId);
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

        // O sucesso não depende de uma segunda chamada à IA. Assim o cliente
        // sempre recebe a confirmação mesmo se o gateway falhar depois do insert.
        if (tc.function.name === "criar_pedido" && result?.sucesso) {
          const valor = Number(result.valor_total || 0).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          });
          const reply = result.reutilizado
            ? `Seu pedido nº ${result.numero_pedido} já estava registrado. ${result.quantidade}x ${result.produto}, total ${valor}.`
            : `Pedido nº ${result.numero_pedido} realizado com sucesso. ${result.quantidade}x ${result.produto}, total ${valor}. A loja já recebeu sua solicitação.`;
          await saveSiteMessage(
            supabase,
            conversationId,
            empresa.id,
            unidade.id,
            "assistant",
            reply,
            messageId,
            { pedido_id: result.pedido_id, pedido_criado: !result.reutilizado },
          );
          await supabase.from("ai_conversas").update({
            pedido_id: result.pedido_id,
            updated_at: new Date().toISOString(),
          }).eq("id", conversationId);
          return jsonReply(reply, conversationId);
        }
      }
    }

    const fallback = "Não consegui concluir esta etapa e nenhum novo pedido foi confirmado. Pode tentar novamente?";
    await saveSiteMessage(supabase, conversationId, empresa.id, unidade.id, "assistant", fallback, messageId);
    return jsonReply(fallback, conversationId);
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
  const { data: chamada, error: chamadaError } = await supabase.from("chamadas_recebidas").insert({
    telefone,
    cliente_id: clientes?.[0]?.id ?? null,
    cliente_nome: clientes?.[0]?.nome ?? null,
    tipo: "voip",
    status: "recebida",
    empresa_id: empresaId,
    unidade_id: unidadeId,
    observacoes: "🤖 Atendimento iniciado pela Bia (site institucional)",
  }).select("id").single();
  if (chamadaError) {
    console.error("[BIA-SITE-CHAT] Falha ao registrar atendimento", chamadaError);
  }

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
      chamada_id: chamada?.id ?? null,
    };
  }
  return { encontrado: false, chamada_id: chamada?.id ?? null };
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
  args: any,
  idempotencyKey: string,
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

  // Protege apenas retries do MESMO envio (mesma idempotencyKey).
  // Pedidos repetidos legitimos do mesmo produto NAO devem ser bloqueados.
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentes } = await supabase.from("pedidos")
    .select("id, numero_sequencial, valor_total")
    .eq("unidade_id", unidadeId)
    .eq("cliente_id", finalClienteId)
    .eq("origem_pedido", "site")
    .like("observacoes", `%BiaReq:${idempotencyKey}%`)
    .gte("created_at", fiveMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  const pedidoExistente = recentes?.[0];
  if (pedidoExistente) {
    return {
      sucesso: true,
      reutilizado: true,
      pedido_id: pedidoExistente.id,
      numero_pedido: pedidoExistente.numero_sequencial,
      produto: nomeProduto,
      quantidade: qty,
      valor_total: Number(pedidoExistente.valor_total),
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
      observacoes: `Pedido pela Bia (site). BiaReq:${idempotencyKey}.${referencia ? " Ref: " + referencia : ""}${telefone ? " Tel: " + telefone : ""}`,
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


  const telDigits = String(telefone || "").replace(/\D/g, "");
  if (telDigits) {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: chamada } = await supabase.from("chamadas_recebidas")
      .select("id")
      .eq("unidade_id", unidadeId)
      .or(`telefone.eq.${telDigits},telefone.ilike.%${telDigits.slice(-11)}%`)
      .gte("created_at", twoHoursAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (chamada?.id) {
      await supabase.from("chamadas_recebidas").update({
        pedido_gerado_id: pedido.id,
        observacoes: `🤖 Pedido nº ${pedido.numero_sequencial} criado pela Bia (site institucional)`,
      }).eq("id", chamada.id);
    }
  }

  return {
    sucesso: true,
    reutilizado: false,
    pedido_id: pedido.id,
    numero_pedido: pedido.numero_sequencial,
    produto: nomeProduto,
    quantidade: qty,
    valor_total: valorTotal,
  };
}
