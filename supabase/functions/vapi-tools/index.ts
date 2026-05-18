// Vapi Tools webhook for Bia (Forte Gás voice assistant)
// Handles tool calls: criar_pedido, consultar_preco
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// DID padrão da Forte Gás (caso o Vapi não envie o "to")
const DEFAULT_DID = "+554337717463";

function normalizeDigits(s?: string | null) {
  return (s ?? "").replace(/\D/g, "");
}

async function resolverEmpresa(toNumber?: string) {
  const did = toNumber || DEFAULT_DID;
  const { data } = await supabase
    .from("did_empresa_routing")
    .select("empresa_id, unidade_id")
    .eq("ativo", true)
    .limit(50);
  const digits = normalizeDigits(did);
  const match = (data ?? []).find(
    (r: any) => normalizeDigits((r as any).did) === digits || true
  );
  // pega a primeira ativa se não bater exato
  const row = (data ?? []).find((r: any) => normalizeDigits((r as any).did ?? "") === digits) ?? data?.[0];
  return row ? { empresa_id: row.empresa_id, unidade_id: row.unidade_id } : null;
}

async function getUnidadePadrao(empresa_id: string) {
  const { data } = await supabase
    .from("unidades")
    .select("id")
    .eq("empresa_id", empresa_id)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function consultarPreco(args: any, ctx: any) {
  const produto = String(args?.produto ?? "").toLowerCase();
  const empresa_id = ctx.empresa_id;
  const unidade_id = ctx.unidade_id;

  let nomeBusca = "Gás P13";
  if (produto.includes("p20")) nomeBusca = "Gás P20";
  else if (produto.includes("p45")) nomeBusca = "Gás P45";
  else if (produto.includes("agua") || produto.includes("água") || produto.includes("galão") || produto.includes("galao")) nomeBusca = "Água Mineral 20L";

  const { data } = await supabase
    .from("produtos")
    .select("id, nome, preco, preco_telefone, unidade_id")
    .eq("unidade_id", unidade_id)
    .eq("nome", nomeBusca)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (!data) return { ok: false, mensagem: `Produto ${nomeBusca} não encontrado.` };
  const preco = Number(data.preco_telefone ?? data.preco ?? 0);
  return { ok: true, produto: data.nome, preco_reais: preco, mensagem: `${data.nome} custa R$ ${preco.toFixed(2)}.` };
}

async function criarPedido(args: any, ctx: any) {
  const empresa_id = ctx.empresa_id;
  const unidade_id = ctx.unidade_id;
  const telefoneCliente = ctx.callerNumber;

  const produtoTxt = String(args?.produto ?? "P13").toLowerCase();
  const quantidade = Number(args?.quantidade ?? 1);
  const endereco = String(args?.endereco ?? "").trim();
  const numero = String(args?.numero ?? "").trim();
  const bairro = String(args?.bairro ?? "").trim();
  const referencia = String(args?.referencia ?? "").trim();
  const formaPagamento = String(args?.forma_pagamento ?? "dinheiro").toLowerCase();
  const trocoPara = args?.troco_para ? Number(args.troco_para) : null;
  const nomeCliente = String(args?.nome_cliente ?? "").trim();
  const telefoneInput = normalizeDigits(args?.telefone ?? telefoneCliente ?? "");

  let nomeBusca = "Gás P13";
  if (produtoTxt.includes("p20")) nomeBusca = "Gás P20";
  else if (produtoTxt.includes("p45")) nomeBusca = "Gás P45";
  else if (produtoTxt.includes("agua") || produtoTxt.includes("água") || produtoTxt.includes("galão") || produtoTxt.includes("galao")) nomeBusca = "Água Mineral 20L";

  const { data: produto } = await supabase
    .from("produtos")
    .select("id, nome, preco, preco_telefone")
    .eq("unidade_id", unidade_id)
    .eq("nome", nomeBusca)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (!produto) return { ok: false, mensagem: `Produto ${nomeBusca} indisponível.` };

  const preco = Number(produto.preco_telefone ?? produto.preco ?? 0);
  const valorTotal = preco * quantidade;

  // Buscar / criar cliente por telefone
  let clienteId: string | null = null;
  if (telefoneInput) {
    const { data: existing } = await supabase
      .from("clientes")
      .select("id")
      .eq("empresa_id", empresa_id)
      .ilike("telefone", `%${telefoneInput.slice(-9)}%`)
      .limit(1)
      .maybeSingle();
    if (existing) clienteId = existing.id;
  }
  if (!clienteId) {
    const { data: novo, error: errCli } = await supabase
      .from("clientes")
      .insert({
        nome: nomeCliente || "Cliente Telefone (Bia)",
        telefone: telefoneInput || null,
        endereco: endereco || null,
        numero: numero || null,
        bairro: bairro || null,
        empresa_id,
        ativo: true,
      })
      .select("id")
      .single();
    if (errCli) return { ok: false, mensagem: `Erro ao cadastrar cliente: ${errCli.message}` };
    clienteId = novo.id;
  }

  const enderecoCompleto = [endereco, numero].filter(Boolean).join(", ");

  const { data: pedido, error: errPed } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      unidade_id,
      status: "pendente",
      valor_total: valorTotal,
      forma_pagamento: formaPagamento,
      endereco_entrega: enderecoCompleto || null,
      numero_entrega: numero || null,
      bairro_entrega: bairro || null,
      observacoes: referencia ? `Ref: ${referencia}` : null,
      canal_venda: "telefone",
      troco_para: trocoPara,
    })
    .select("id, numero_sequencial")
    .single();

  if (errPed) return { ok: false, mensagem: `Erro ao criar pedido: ${errPed.message}` };

  await supabase.from("pedido_itens").insert({
    pedido_id: pedido.id,
    produto_id: produto.id,
    quantidade,
    preco_unitario: preco,
  });

  return {
    ok: true,
    pedido_numero: pedido.numero_sequencial,
    valor_total: valorTotal,
    mensagem: `Pedido número ${pedido.numero_sequencial} criado. Total R$ ${valorTotal.toFixed(2)}. Tempo estimado de entrega: 20 a 40 minutos.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    // Vapi sends: { message: { type: "tool-calls", toolCalls: [{ id, function: { name, arguments } }], call: { customer: { number }, phoneNumber: { number } } } }
    const message = body?.message ?? body;
    const toolCalls = message?.toolCalls ?? message?.tool_calls ?? [];
    const call = message?.call ?? {};
    const callerNumber = call?.customer?.number ?? message?.customer?.number ?? null;
    const toNumber = call?.phoneNumber?.number ?? null;

    const ctx0 = await resolverEmpresa(toNumber);
    if (!ctx0) {
      return new Response(JSON.stringify({ results: toolCalls.map((tc: any) => ({ toolCallId: tc.id, result: "Empresa não encontrada para este número." })) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let unidade_id = ctx0.unidade_id;
    if (!unidade_id) unidade_id = await getUnidadePadrao(ctx0.empresa_id);

    const ctx = { empresa_id: ctx0.empresa_id, unidade_id, callerNumber };

    const results = [];
    for (const tc of toolCalls) {
      const name = tc?.function?.name ?? tc?.name;
      let args = tc?.function?.arguments ?? tc?.arguments ?? {};
      if (typeof args === "string") {
        try { args = JSON.parse(args); } catch { args = {}; }
      }

      let result: any;
      if (name === "consultar_preco") result = await consultarPreco(args, ctx);
      else if (name === "criar_pedido") result = await criarPedido(args, ctx);
      else result = { ok: false, mensagem: `Tool desconhecida: ${name}` };

      results.push({ toolCallId: tc.id, result: JSON.stringify(result) });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("vapi-tools error:", e);
    return new Response(JSON.stringify({ results: [{ result: `Erro interno: ${e?.message ?? e}` }] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
