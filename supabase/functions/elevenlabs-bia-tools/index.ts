import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Central Gás identifiers (hardcoded — esta função atende SOMENTE Central Gás CP)
const CENTRAL_GAS_SLUG = "centralgascp";

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

    // Resolve empresa Central Gás and its main unidade
    const { data: empresa } = await supabase
      .from("empresas")
      .select("id")
      .eq("slug", CENTRAL_GAS_SLUG)
      .maybeSingle();

    if (!empresa) return err("Empresa Central Gás não encontrada", 500);

    const { data: unidade } = await supabase
      .from("unidades")
      .select("id")
      .eq("empresa_id", empresa.id)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!unidade) return err("Unidade Central Gás não encontrada", 500);

    // ============== ACTION: identificar_cliente ==============
    if (action === "identificar_cliente") {
      const telefone = String(body.telefone || "").replace(/\D/g, "");
      if (!telefone) return err("Telefone obrigatório");

      const last = telefone.slice(-11);
      const last10 = telefone.slice(-10);

      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, nome, telefone, endereco, numero, bairro, cidade, complemento:numero")
        .eq("empresa_id", empresa.id)
        .or(`telefone.ilike.%${last}%,telefone.ilike.%${last10}%`)
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
        referencia,
        produto,
        quantidade,
      } = body;

      if (!produto || !quantidade) return err("Produto e quantidade são obrigatórios");

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

      // Match produto (P13 / P20 / P45 / Água)
      const prodNorm = String(produto).toUpperCase().replace(/\s/g, "");
      let nomeProduto = "";
      if (prodNorm.includes("P13") || prodNorm.includes("13")) nomeProduto = "Gás P13";
      else if (prodNorm.includes("P20") || prodNorm.includes("20")) nomeProduto = "Gás P20";
      else if (prodNorm.includes("P45") || prodNorm.includes("45")) nomeProduto = "Gás P45";
      else if (prodNorm.includes("AGUA") || prodNorm.includes("ÁGUA")) nomeProduto = "Água Mineral 20L";
      else return err(`Produto não reconhecido: ${produto}. Use P13, P20, P45 ou Água.`);

      const { data: prod } = await supabase
        .from("produtos")
        .select("id, preco, nome")
        .eq("unidade_id", unidade.id)
        .ilike("nome", nomeProduto)
        .limit(1)
        .maybeSingle();

      if (!prod) return err(`Produto ${nomeProduto} não cadastrado na unidade`);

      const qty = Number(quantidade) || 1;
      const valorTotal = (prod.preco || 0) * qty;

      // Cria pedido pendente
      const { data: pedido, error: pedidoErr } = await supabase
        .from("pedidos")
        .insert({
          cliente_id: finalClienteId,
          unidade_id: unidade.id,
          status: "pendente",
          canal_venda: "telefone_ia",
          forma_pagamento: "a_definir",
          valor_total: valorTotal,
          observacoes: `Pedido criado pela Bia (IA). ${referencia ? "Ref: " + referencia : ""}`,
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
        preco_unitario: prod.preco || 0,
        subtotal: valorTotal,
      });

      return ok({
        sucesso: true,
        pedido_id: pedido.id,
        numero_pedido: pedido.numero_sequencial,
        produto: nomeProduto,
        quantidade: qty,
        mensagem: `Pedido #${pedido.numero_sequencial} criado com sucesso! ${qty}x ${nomeProduto}. O entregador chega em até 30 minutos.`,
      });
    }

    return err("Ação inválida. Use: identificar_cliente ou criar_pedido");
  } catch (e: any) {
    console.error("[ELEVENLABS-BIA] Error:", e);
    return err(e.message || "Erro interno", 500);
  }
});
