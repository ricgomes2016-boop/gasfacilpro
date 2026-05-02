import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Empresa fixa para atendimento da Bia por telefone (Central Gas)
const EMPRESA_BIA_ID = "f27e158e-7ab5-4617-9f66-c6b4a084d293";
const UNIDADE_BIA_ID = "aa5b7c93-4fe6-4dba-a0b5-2af43cd20614"; // Central Gas
const FALLBACK_EMPRESA_SLUGS = ["central-gas", "centralgascp", "central-gas-cp"];

const ok = (data: any) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const err = (msg: string, status = 400) =>
  new Response(JSON.stringify({ success: false, error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function resolverEmpresaUnidade(supabase: any, _body: any) {
  // Bia atende SEMPRE pela Central Gas (empresa fixa)
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nome")
    .eq("id", EMPRESA_BIA_ID)
    .maybeSingle();
  if (!empresa) throw new Error("Empresa Central Gas não encontrada");

  let unidade: { id: string; nome?: string } | null = null;
  const { data: u1 } = await supabase
    .from("unidades")
    .select("id, nome")
    .eq("id", UNIDADE_BIA_ID)
    .eq("empresa_id", empresa.id)
    .maybeSingle();
  unidade = u1;

  if (!unidade) {
    const { data: u2 } = await supabase
      .from("unidades")
      .select("id, nome")
      .eq("empresa_id", empresa.id)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    unidade = u2;
  }
  if (!unidade) throw new Error("Unidade Central Gas não encontrada");
  return { empresa, unidade };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    console.log("[ELEVENLABS-BIA] Request:", JSON.stringify(body));

    const action = body.action;

    const { empresa, unidade } = await resolverEmpresaUnidade(supabase, body);

    // ============== ACTION: identificar_cliente ==============
    if (action === "identificar_cliente") {
      const telefoneRaw = String(body.telefone || "").replace(/\D/g, "");
      // ElevenLabs may send the dynamic variable as 'true'/'false' string.
      const callerConfiavelRaw = body.caller_id_confiavel ?? body.caller_confiavel;
      const callerConfiavel =
        callerConfiavelRaw === true ||
        callerConfiavelRaw === "true" ||
        callerConfiavelRaw === 1 ||
        callerConfiavelRaw === "1";
      const callerExplicitlyUntrusted =
        callerConfiavelRaw === false ||
        callerConfiavelRaw === "false" ||
        callerConfiavelRaw === 0 ||
        callerConfiavelRaw === "0";

      // Numbers that are NEVER a real customer (carrier DIDs, 0800, sentinels).
      const OPERATOR_LAST10 = new Set<string>([
        "1152835921", // Vonage DID Central Gás
        "8005900492", // GoTo 0800
        "5900492",
      ]);
      const last10 = telefoneRaw.slice(-10);
      const isOperatorNumber =
        !telefoneRaw ||
        /^0+$/.test(telefoneRaw) ||
        telefoneRaw.length < 10 ||
        OPERATOR_LAST10.has(last10);

      // If the caller-id is explicitly untrusted OR matches an operator number,
      // do NOT try to match a customer by phone. Tell the agent to ask verbally.
      if (callerExplicitlyUntrusted || (!callerConfiavel && isOperatorNumber)) {
        // Still log the call for ops visibility, but without a fake telefone.
        const { error: chamadaError } = await supabase.from("chamadas_recebidas").insert({
          telefone: null,
          cliente_id: null,
          cliente_nome: null,
          tipo: "voip",
          status: "recebida",
          unidade_id: unidade.id,
          observacoes: `Bia (IA) - chamada via 0800/encaminhamento. Caller bruto: ${telefoneRaw || "vazio"}`,
        });
        if (chamadaError) console.error("Erro registrando chamada (caller não confiável):", chamadaError);

        return ok({
          encontrado: false,
          motivo: "caller_id_operadora",
          proxima_acao: "perguntar_telefone_e_rechamar_identificar_cliente",
          mensagem:
            "Chamada veio via encaminhamento (0800/operadora). Pergunte ao cliente o telefone com DDD e chame NOVAMENTE a ferramenta identificar_cliente passando esse telefone (com caller_id_confiavel=true) para buscar o cadastro. NUNCA pule essa etapa — sempre tente localizar o cliente no cadastro antes de pedir endereço.",
        });
      }

      if (!telefoneRaw) return err("Telefone obrigatório");

      const telefone = telefoneRaw;
      const last = telefone.slice(-11);
      const last10b = telefone.slice(-10);

      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, nome, telefone, endereco, numero, bairro, cidade, cep")
        .eq("empresa_id", empresa.id)
        .or(`telefone.ilike.%${last}%,telefone.ilike.%${last10b}%`)
        .limit(1);

      // Register the incoming call (triggers CallerID popup)
      const { error: chamadaError } = await supabase.from("chamadas_recebidas").insert({
        telefone,
        cliente_id: clientes?.[0]?.id ?? null,
        cliente_nome: clientes?.[0]?.nome ?? null,
        tipo: "voip",
        status: "recebida",
        unidade_id: unidade.id,
        observacoes: "Recebida pela Bia (IA - ElevenLabs)",
      });

      if (chamadaError) {
        console.error("Erro registrando chamada recebida:", chamadaError);
      }

      if (clientes && clientes.length > 0) {
        const c = clientes[0];
        return ok({
          encontrado: true,
          cliente_id: c.id,
          nome: c.nome,
          endereco_completo: `${c.endereco || ""}, ${c.numero || "s/n"} - ${c.bairro || ""}`.trim(),
          endereco: c.endereco,
          numero: c.numero,
          bairro: c.bairro,
          cidade: c.cidade,
          mensagem: `Cliente encontrado: ${c.nome}. Endereço: ${c.endereco || "não cadastrado"}, ${c.numero || ""} - ${c.bairro || ""}. Confirme o endereço com o cliente.`,
        });
      }

      return ok({
        encontrado: false,
        mensagem: "Cliente novo. Peça o nome completo e endereço (rua, número, bairro).",
      });
    }

    // ============== ACTION: criar_pedido ==============
    if (action === "criar_pedido") {
      const {
        cliente_id,
        nome,
        telefone,
        endereco,
        numero,
        bairro,
        cep,
        referencia,
        produto,
        quantidade,
        forma_pagamento,
      } = body;

      if (!produto) return err("Produto é obrigatório");
      const qtdInput = quantidade ?? 1;

      // Resolve / create cliente
      let finalClienteId = cliente_id;
      if (!finalClienteId) {
        if (!nome || !telefone) return err("Nome e telefone obrigatórios para cliente novo");
        const telDigits = String(telefone).replace(/\D/g, "");
        const { data: novoCliente, error: clienteErr } = await supabase
          .from("clientes")
          .insert({
            nome,
            telefone: telDigits,
            endereco,
            numero,
            bairro,
            cep: cep || null,
            cidade: body.cidade || null,
            empresa_id: empresa.id,
            ativo: true,
          })
          .select("id")
          .single();
        if (clienteErr) {
          console.error("Erro criando cliente:", clienteErr);
          return err("Erro ao cadastrar cliente: " + clienteErr.message);
        }
        finalClienteId = novoCliente.id;
        // Vincula à unidade Central Gás
        await supabase.from("cliente_unidades").insert({
          cliente_id: finalClienteId,
          unidade_id: unidade.id,
        });
      }

      // Match produto (P13 / P20 / P45 / Água) - "gás/botijão/bujão" sozinho => P13
      const prodRaw = String(produto || "")
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const prodNorm = prodRaw.replace(/\s/g, "");
      let nomeProduto = "";
      if (prodNorm.includes("P45") || prodNorm.includes("45")) nomeProduto = "Gás P45";
      else if (prodNorm.includes("P20") || prodNorm.includes("20")) nomeProduto = "Gás P20";
      else if (prodNorm.includes("P13") || prodNorm.includes("13")) nomeProduto = "Gás P13";
      else if (prodNorm.includes("AGUA") || prodNorm.includes("GALAO")) nomeProduto = "Água Mineral 20L";
      else if (
        prodNorm.includes("GAS") ||
        prodNorm.includes("BOTIJAO") ||
        prodNorm.includes("BUJAO") ||
        prodNorm.includes("CARGA")
      ) nomeProduto = "Gás P13"; // Padrão: "um gás" = P13
      else return err(`Produto não reconhecido: ${produto}. Use P13, P20, P45 ou Água.`);

      const { data: prod } = await supabase
        .from("produtos")
        .select("id, preco, nome, preco_telefone")
        .eq("unidade_id", unidade.id)
        .ilike("nome", nomeProduto)
        .limit(1)
        .maybeSingle();

      if (!prod) return err(`Produto ${nomeProduto} não cadastrado na unidade`);

      let precoUnitario = Number(prod.preco_telefone || prod.preco || 0);
      if (finalClienteId) {
        const { data: ultimoItem } = await supabase
          .from("pedido_itens")
          .select("preco_unitario, pedidos!inner(cliente_id)")
          .eq("produto_id", prod.id)
          .eq("pedidos.cliente_id", finalClienteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ultimoItem?.preco_unitario) precoUnitario = Number(ultimoItem.preco_unitario);
      }

      const qty = Math.max(1, Number(qtdInput) || 1);

      // Normaliza forma de pagamento. Aceita variações coloquiais ("tá bom",
      // "qualquer", "tanto faz", "depois decido", "ver com entregador") como
      // 'a_definir' para a Bia NÃO ficar em loop perguntando "cartão, pix ou dinheiro".
      const fpRaw = String(forma_pagamento || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      let formaPgto = "a_definir";
      if (fpRaw.includes("credito")) formaPgto = "cartao_credito";
      else if (fpRaw.includes("debito")) formaPgto = "cartao_debito";
      else if (fpRaw.includes("cartao") || fpRaw.includes("maquin")) formaPgto = "cartao_credito";
      else if (fpRaw.includes("pix")) formaPgto = "pix";
      else if (fpRaw.includes("dinheiro") || fpRaw.includes("especie")) formaPgto = "dinheiro";
      else if (fpRaw.includes("fiado") || fpRaw.includes("prazo")) formaPgto = "fiado";
      else if (
        fpRaw === "" ||
        fpRaw.includes("ta bom") || fpRaw.includes("tabom") || fpRaw.includes("ok") ||
        fpRaw.includes("qualquer") || fpRaw.includes("tanto faz") ||
        fpRaw.includes("depois") || fpRaw.includes("decido") ||
        fpRaw.includes("ver") || fpRaw.includes("combina") ||
        fpRaw.includes("entregador") || fpRaw.includes("definir") ||
        fpRaw.includes("nao sei") || fpRaw.includes("a definir")
      ) {
        formaPgto = "a_definir";
      }

      const valorTotal = precoUnitario * qty;
      const enderecoCompleto = [endereco, numero && `Nº ${numero}`, bairro, referencia && `Ref: ${referencia}`]
        .filter(Boolean)
        .join(", ");

      // === IDEMPOTÊNCIA: evita pedidos duplicados quando a Bia chama criar_pedido
      // mais de uma vez na mesma ligação (ex.: primeiro com telefone, depois com nome).
      // Se já existir um pedido pendente do mesmo cliente, no canal telefone_ia,
      // criado nos últimos 3 minutos, reaproveita esse pedido em vez de criar outro.
      if (finalClienteId) {
        const desdeIso = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const { data: pedidoExistente } = await supabase
          .from("pedidos")
          .select("id, numero_sequencial, valor_total")
          .eq("cliente_id", finalClienteId)
          .eq("unidade_id", unidade.id)
          .eq("canal_venda", "telefone_ia")
          .eq("status", "pendente")
          .gte("created_at", desdeIso)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pedidoExistente) {
          console.log("[ELEVENLABS-BIA] Pedido duplicado evitado, reaproveitando:", pedidoExistente.id);
          return ok({
            sucesso: true,
            duplicado: true,
            pedido_id: pedidoExistente.id,
            numero_pedido: pedidoExistente.numero_sequencial,
            produto: nomeProduto,
            quantidade: qty,
            valor_total: pedidoExistente.valor_total,
            mensagem: `Pedido #${pedidoExistente.numero_sequencial} já registrado há instantes. Não foi criado um novo. Confirme com o cliente que o pedido está em andamento.`,
          });
        }
      }

      // Cria pedido pendente
      const { data: pedido, error: pedidoErr } = await supabase
        .from("pedidos")
        .insert({
          cliente_id: finalClienteId,
          unidade_id: unidade.id,
          status: "pendente",
          canal_venda: "telefone_ia",
          forma_pagamento: formaPgto,
          valor_total: valorTotal,
          endereco_entrega: enderecoCompleto || null,
          numero_entrega: numero || null,
          bairro_entrega: bairro || null,
          cep_entrega: cep || null,
          observacoes: `Pedido criado pela Bia (IA por telefone). ${referencia ? "Ref: " + referencia : ""}`,
        })
        .select("id, numero_sequencial")
        .single();

      if (pedidoErr) {
        console.error("Erro criando pedido:", pedidoErr);
        return err("Erro ao criar pedido: " + pedidoErr.message);
      }

      // Cria item do pedido
      await supabase.from("pedido_itens").insert({
        pedido_id: pedido.id,
        produto_id: prod.id,
        quantidade: qty,
        preco_unitario: precoUnitario,
      });

      const pagamentoLabel =
        formaPgto === "a_definir"
          ? "a combinar com o entregador"
          : formaPgto.replace("_", " ");
      return ok({
        sucesso: true,
        pedido_id: pedido.id,
        numero_pedido: pedido.numero_sequencial,
        produto: nomeProduto,
        quantidade: qty,
        valor_total: valorTotal,
        forma_pagamento: formaPgto,
        mensagem:
          `Pedido #${pedido.numero_sequencial} criado com sucesso. ${qty}x ${nomeProduto}, total R$ ${valorTotal.toFixed(2)}, pagamento: ${pagamentoLabel}. ` +
          `NÃO pergunte novamente a forma de pagamento — finalize a ligação confirmando o pedido e se despedindo do cliente.`,
      });

    }

    return err("Ação inválida. Use: identificar_cliente ou criar_pedido");
  } catch (e: any) {
    console.error("[ELEVENLABS-BIA] Error:", e);
    return err(e.message || "Erro interno", 500);
  }
});
