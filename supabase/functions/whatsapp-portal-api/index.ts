// whatsapp-portal-api — API server-to-server isolada para o portal WhatsApp.
// Não altera Z-API, meta-webhook nem os fluxos existentes: apenas lê/grava usando
// a lógica autoritativa já existente (createOrder da BIA).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOrder } from "../_shared/bia-core.ts";
import {
  ACTIONS,
  type Action,
  MAX_BODY_BYTES,
  MUTACOES,
  corsHeadersFor,
  isUuid,
  mascararTelefone,
  normalizarTelefone,
  podeCriarPedido,
  verificarAssinatura,
} from "./security.ts";
import { buscarIdempotente, registrarNonce, salvarIdempotente } from "./store.ts";

const VERSION = "1.0.0";

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function empresaDaUnidade(supabase: any, unidadeId: string): Promise<string | null> {
  const { data } = await supabase.from("unidades").select("empresa_id, ativo").eq("id", unidadeId).maybeSingle();
  if (!data || data.ativo === false) return null;
  return data.empresa_id ?? null;
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const rota = url.pathname.split("/").filter(Boolean).pop() || "";

  // ===== health público: não acessa dados =====
  if (req.method === "GET" || rota === "health") {
    return json({ ok: true, version: VERSION }, 200, cors);
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  const segredo = Deno.env.get("WHATSAPP_PORTAL_HMAC_SECRET");
  if (!segredo) {
    console.error("[portal] segredo HMAC ausente");
    return json({ error: "server_not_configured" }, 503, cors);
  }

  const corpo = await req.text();
  if (new TextEncoder().encode(corpo).length > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413, cors);
  }

  const timestamp = req.headers.get("x-gf-timestamp");
  const nonce = req.headers.get("x-gf-nonce");
  const assinatura = req.headers.get("x-gf-signature");
  const idempotencyKey = req.headers.get("idempotency-key");

  const verif = await verificarAssinatura({ segredo, timestamp, nonce, assinatura, corpo });
  if (!verif.ok) {
    console.warn("[portal] requisição rejeitada:", verif.motivo);
    return json({ error: "unauthorized", reason: verif.motivo }, 401, cors);
  }

  let body: Record<string, any>;
  try {
    body = JSON.parse(corpo || "{}");
  } catch {
    return json({ error: "invalid_json" }, 400, cors);
  }

  const action = String(body.action || rota) as Action;
  if (!ACTIONS.includes(action)) return json({ error: "unknown_action" }, 404, cors);
  if (action === "health") return json({ ok: true, version: VERSION }, 200, cors);

  const isMutacao = MUTACOES.includes(action);
  if (isMutacao && (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128)) {
    return json({ error: "idempotency_key_required" }, 400, cors);
  }

  const supabase = db();

  // Idempotência: devolve a resposta anterior sem reprocessar.
  if (isMutacao && idempotencyKey) {
    const anterior = await buscarIdempotente(supabase, idempotencyKey);
    if (anterior) return json(anterior, 200, cors);
  }

  // Anti-replay: o nonce só pode ser usado uma vez.
  if (!(await registrarNonce(supabase, nonce!, action))) {
    return json({ error: "replay_detected" }, 409, cors);
  }

  // Escopo obrigatório por unidade/empresa.
  const unidadeId = body.unidade_id;
  if (!isUuid(unidadeId)) return json({ error: "unidade_id_invalido" }, 400, cors);
  const empresaId = await empresaDaUnidade(supabase, unidadeId);
  if (!empresaId) return json({ error: "unidade_nao_encontrada" }, 404, cors);

  const finalizar = async (resposta: Record<string, unknown>, status = 200) => {
    if (isMutacao && idempotencyKey) {
      await salvarIdempotente(supabase, { nonce: nonce!, idempotencyKey, action, response: resposta });
    }
    return json(resposta, status, cors);
  };

  try {
    switch (action) {
      // ===== 1. identify-customer =====
      case "identify-customer": {
        const tel = normalizarTelefone(body.phone);
        if (!tel) return json({ error: "phone_invalido" }, 400, cors);
        const { data } = await supabase
          .from("clientes")
          .select("id, nome, endereco, numero, bairro, cidade, telefone, bloqueio_credito, ativo")
          .eq("empresa_id", empresaId)
          .limit(500);
        const hit = (data || []).find((c: any) => normalizarTelefone(c.telefone) === tel);
        console.log("[portal] identify-customer", { unidadeId, phone: mascararTelefone(tel), found: !!hit });
        if (!hit) return json({ found: false }, 200, cors);
        return json({
          found: true,
          customer: {
            id: hit.id,
            nome: hit.nome,
            endereco: hit.endereco,
            numero: hit.numero,
            bairro: hit.bairro,
            cidade: hit.cidade,
            ativo: hit.ativo !== false,
            bloqueado: hit.bloqueio_credito === true,
          },
        }, 200, cors);
      }

      // ===== 2. products =====
      case "products": {
        const { data, error } = await supabase
          .from("produtos")
          .select("id, nome, preco, estoque, categoria, estoque_unico")
          .eq("unidade_id", unidadeId)
          .eq("ativo", true)
          .order("nome");
        if (error) throw error;
        return json({
          products: (data || []).map((p: any) => ({
            id: p.id,
            nome: p.nome,
            preco: Number(p.preco) || 0,
            estoque: Number(p.estoque) || 0,
            categoria: p.categoria,
            disponivel: (Number(p.estoque) || 0) > 0,
          })),
        }, 200, cors);
      }

      // ===== 3. quote (nunca grava pedido) =====
      case "quote": {
        const qtd = Math.trunc(Number(body.quantity) || 0);
        if (!isUuid(body.product_id) || qtd <= 0 || qtd > 100) {
          return json({ error: "parametros_invalidos" }, 400, cors);
        }
        const { data: prod } = await supabase
          .from("produtos")
          .select("id, nome, preco, estoque, categoria")
          .eq("id", body.product_id)
          .eq("unidade_id", unidadeId)
          .eq("ativo", true)
          .maybeSingle();
        if (!prod) return json({ error: "produto_nao_encontrado" }, 404, cors);
        const unit = Number(prod.preco) || 0;
        const taxa = Number(body.delivery_fee) > 0 ? Number(body.delivery_fee) : 0;
        const total = Math.max(0, unit * qtd + taxa);
        return json({
          quote: {
            product_id: prod.id,
            nome: prod.nome,
            quantity: qtd,
            unit_price: unit,
            delivery_fee: taxa,
            total,
            estoque_suficiente: (Number(prod.estoque) || 0) >= qtd,
          },
        }, 200, cors);
      }

      // ===== 4. create-order =====
      case "create-order": {
        if (!podeCriarPedido(body)) {
          return finalizar({ success: false, error: "confirmation_required" }, 400);
        }
        const tel = normalizarTelefone(body.phone);
        if (!tel) return finalizar({ success: false, error: "phone_invalido" }, 400);
        if (!isUuid(body.product_id)) return finalizar({ success: false, error: "product_id_invalido" }, 400);
        const qtd = Math.trunc(Number(body.quantity) || 0);
        if (qtd <= 0 || qtd > 100) return finalizar({ success: false, error: "quantidade_invalida" }, 400);

        const { data: prod } = await supabase
          .from("produtos")
          .select("id, nome, preco")
          .eq("id", body.product_id)
          .eq("unidade_id", unidadeId)
          .eq("ativo", true)
          .maybeSingle();
        if (!prod) return finalizar({ success: false, error: "produto_nao_encontrado" }, 404);

        const endereco = String(body.address || "").slice(0, 400);
        if (!endereco) return finalizar({ success: false, error: "endereco_obrigatorio" }, 400);

        const { data: clientes } = await supabase
          .from("clientes").select("id, nome, telefone").eq("empresa_id", empresaId).limit(500);
        const cli = (clientes || []).find((c: any) => normalizarTelefone(c.telefone) === tel) || null;

        const resultado = await createOrder(
          supabase,
          {
            produto: prod.nome,
            quantidade: String(qtd),
            valor: String(Number(body.total) > 0 ? Number(body.total) : Number(prod.preco) * qtd),
            pagamento: String(body.payment_method || "dinheiro"),
            endereco,
            nome: String(body.name || cli?.nome || "Cliente WhatsApp").slice(0, 120),
          },
          cli?.id ?? null,
          cli?.nome ?? null,
          String(body.name || cli?.nome || "Cliente WhatsApp").slice(0, 120),
          tel,
          unidadeId,
          false,
          0,
        );

        if (!resultado?.pedidoId) {
          console.error("[portal] create-order falhou", { unidadeId, phone: mascararTelefone(tel) });
          return finalizar({ success: false, error: "order_creation_failed" }, 502);
        }

        // Confirma que o pedido e o item existem antes de declarar sucesso.
        const { data: ped } = await supabase
          .from("pedidos").select("id, status, valor_total, unidade_id")
          .eq("id", resultado.pedidoId).eq("unidade_id", unidadeId).maybeSingle();
        const { count: itens } = await supabase
          .from("pedido_itens").select("id", { count: "exact", head: true }).eq("pedido_id", resultado.pedidoId);
        if (!ped || !itens) {
          return finalizar({ success: false, error: "order_incomplete" }, 502);
        }

        return finalizar({
          success: true,
          order_id: ped.id,
          status: ped.status,
          total: Number(ped.valor_total) || 0,
          duplicate: (resultado as any).duplicado === true,
        });
      }

      // ===== 5. order-status =====
      case "order-status": {
        const tel = normalizarTelefone(body.phone);
        if (!isUuid(body.order_id) || !tel) return json({ error: "parametros_invalidos" }, 400, cors);
        const { data: ped } = await supabase
          .from("pedidos")
          .select("id, status, valor_total, created_at, cliente_id, observacoes, entregador_id")
          .eq("id", body.order_id)
          .eq("unidade_id", unidadeId)
          .maybeSingle();
        if (!ped) return json({ found: false }, 404, cors);

        let pertence = typeof ped.observacoes === "string" && ped.observacoes.includes(tel);
        if (!pertence && ped.cliente_id) {
          const { data: c } = await supabase.from("clientes").select("telefone").eq("id", ped.cliente_id).maybeSingle();
          pertence = normalizarTelefone(c?.telefone) === tel;
        }
        if (!pertence) return json({ found: false }, 404, cors);

        let entregador: string | null = null;
        if (ped.entregador_id) {
          const { data: e } = await supabase.from("entregadores").select("nome").eq("id", ped.entregador_id).maybeSingle();
          entregador = e?.nome ?? null;
        }
        return json({
          found: true,
          order: {
            id: ped.id,
            status: ped.status,
            total: Number(ped.valor_total) || 0,
            created_at: ped.created_at,
            entregador,
          },
        }, 200, cors);
      }

      // ===== 6. cancel-order =====
      case "cancel-order": {
        const tel = normalizarTelefone(body.phone);
        const motivo = String(body.reason || "").trim().slice(0, 200);
        if (!isUuid(body.order_id) || !tel) return finalizar({ success: false, error: "parametros_invalidos" }, 400);
        if (!motivo) return finalizar({ success: false, error: "reason_required" }, 400);

        const { data: ped } = await supabase
          .from("pedidos")
          .select("id, status, cliente_id, observacoes")
          .eq("id", body.order_id)
          .eq("unidade_id", unidadeId)
          .maybeSingle();
        if (!ped) return finalizar({ success: false, error: "pedido_nao_encontrado" }, 404);

        let pertence = typeof ped.observacoes === "string" && ped.observacoes.includes(tel);
        if (!pertence && ped.cliente_id) {
          const { data: c } = await supabase.from("clientes").select("telefone").eq("id", ped.cliente_id).maybeSingle();
          pertence = normalizarTelefone(c?.telefone) === tel;
        }
        if (!pertence) return finalizar({ success: false, error: "pedido_nao_encontrado" }, 404);

        if (!["pendente", "confirmado", "agendado"].includes(String(ped.status))) {
          return finalizar({ success: false, error: "status_nao_cancelavel", status: ped.status }, 409);
        }

        const { error } = await supabase
          .from("pedidos")
          .update({
            status: "cancelado",
            observacoes: `${ped.observacoes || ""} | Cancelado via portal WhatsApp: ${motivo}`.slice(0, 1000),
          })
          .eq("id", ped.id)
          .eq("unidade_id", unidadeId);
        if (error) return finalizar({ success: false, error: "cancel_failed" }, 502);
        return finalizar({ success: true, order_id: ped.id, status: "cancelado" });
      }

      // ===== 7. drivers =====
      case "drivers": {
        const { data } = await supabase
          .from("entregadores")
          .select("id, nome, status")
          .eq("unidade_id", unidadeId)
          .eq("ativo", true)
          .order("nome");
        return json({ drivers: data || [] }, 200, cors);
      }

      default:
        return json({ error: "unknown_action" }, 404, cors);
    }
  } catch (e) {
    console.error("[portal] erro interno na action", action, (e as Error)?.message);
    return json({ error: "internal_error" }, 500, cors);
  }
});
