import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES_SCHEMA = `
Tabelas disponíveis (contexto entregador):
- pedidos: id, cliente_id, entregador_id, valor_total, forma_pagamento, status, canal_venda, endereco_entrega, observacoes, troco_para, created_at, unidade_id
- pedido_itens: id, pedido_id, produto_id, quantidade, preco_unitario, produto_nome
- clientes: id, nome, telefone, endereco, bairro, cidade, numero
- produtos: id, nome, preco, estoque, categoria, tipo_botijao, ativo, unidade_id
- movimentacoes_estoque: id, produto_id, tipo, quantidade, observacoes, unidade_id, created_at
- transferencias_estoque: id, unidade_origem_id, unidade_destino_id, status, valor_total, data_transferencia, observacoes
- transferencia_estoque_itens: id, transferencia_id, produto_id, quantidade, preco_compra
- unidades: id, nome, tipo, cidade, ativo, empresa_id
- entregadores: id, nome, telefone, status, unidade_id
- contas_receber: id, cliente, descricao, valor, vencimento, status, pedido_id, unidade_id
- carregamentos_rota: id, entregador_id, status, data_saida, unidade_id
- carregamento_rota_itens: id, carregamento_id, produto_id, quantidade_saida, quantidade_vendida, quantidade_retorno
`;

const ENTREGADOR_TOOLS = [
  {
    type: "function",
    function: {
      name: "criar_pedido",
      description: "Cria um pedido/venda. Use quando o entregador disser 'lança', 'registra', 'venda', 'pedido' seguido de produto e endereço.",
      parameters: {
        type: "object",
        properties: {
          cliente_nome: { type: "string", description: "Nome do cliente" },
          cliente_telefone: { type: "string", description: "Telefone do cliente" },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                produto_nome: { type: "string", description: "Nome do produto (ex: P13, P20, Água)" },
                quantidade: { type: "number" },
              },
              required: ["produto_nome", "quantidade"],
            },
          },
          forma_pagamento: { type: "string", enum: ["dinheiro", "pix", "cartao_credito", "cartao_debito", "fiado"] },
          endereco_entrega: { type: "string", description: "Endereço completo de entrega" },
          observacoes: { type: "string" },
          troco_para: { type: "number" },
        },
        required: ["itens"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_transferencia_estoque",
      description: "Transfere produtos entre unidades/filiais. Use quando o entregador disser 'transfira', 'transfere', 'manda pra filial', 'envia pra'.",
      parameters: {
        type: "object",
        properties: {
          unidade_destino_nome: { type: "string", description: "Nome da filial de destino (ex: ABMF, Matriz)" },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                produto_nome: { type: "string", description: "Nome do produto" },
                quantidade: { type: "number" },
              },
              required: ["produto_nome", "quantidade"],
            },
          },
          observacoes: { type: "string" },
        },
        required: ["unidade_destino_nome", "itens"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_movimentacao_estoque",
      description: "Registra entrada, saída ou avaria de estoque",
      parameters: {
        type: "object",
        properties: {
          produto_nome: { type: "string" },
          tipo: { type: "string", enum: ["entrada", "saida", "avaria"] },
          quantidade: { type: "number" },
          observacoes: { type: "string" },
        },
        required: ["produto_nome", "tipo", "quantidade"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_status_pedido",
      description: "Atualiza o status de um pedido",
      parameters: {
        type: "object",
        properties: {
          pedido_id: { type: "string" },
          novo_status: { type: "string", enum: ["pendente", "em_preparo", "saiu_entrega", "entregue", "cancelado"] },
        },
        required: ["pedido_id", "novo_status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_sql",
      description: "Gera uma query SQL SELECT para consultar dados",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "Query SQL SELECT" },
          description: { type: "string" },
        },
        required: ["sql", "description"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, entregador_id, unidade_id } = await req.json();

    // Validate unidade_id as UUID to prevent prompt/SQL injection
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (unidade_id !== null && unidade_id !== undefined && unidade_id !== "" && !UUID_RE.test(String(unidade_id))) {
      return new Response(JSON.stringify({ error: "unidade_id inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (entregador_id && !UUID_RE.test(String(entregador_id))) {
      return new Response(JSON.stringify({ error: "entregador_id inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is the entregador (or owns the unidade)
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await callerClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (entregador_id) {
      const { data: ent } = await supabase.from("entregadores").select("id, unidade_id").eq("id", entregador_id).eq("user_id", userData.user.id).maybeSingle();
      if (!ent) {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (unidade_id && ent.unidade_id !== unidade_id) {
        return new Response(JSON.stringify({ error: "Acesso negado a essa unidade" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let queryData: any[] | null = null;
    let queryError: string | null = null;
    let queryDescription = "";
    let actionResults: string[] = [];

    // Step 1: Intent detection with tool calling
    const intentResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é o assistente IA de um entregador de gás. Analise a mensagem e use as ferramentas quando necessário.

REGRAS DE INTERPRETAÇÃO:
- "lança 1 gás na rua X, 20" → criar_pedido com 1x Gás P13 no endereço "Rua X, 20"
- "lança 2 P13 na central 50" → criar_pedido com 2x Gás P13 na "Rua Central, 50"
- "transfira 20 gás para filial ABMF" → criar_transferencia_estoque com 20x Gás P13 para ABMF
- "transfira 10 P20 pra matriz" → criar_transferencia_estoque com 10x Gás P20 para Matriz
- "quanto tem de P13?" → generate_sql SELECT
- "meus pedidos de hoje" → generate_sql SELECT
- "gás" ou "gas" sem especificar = Gás P13 (padrão)
- Se disser apenas "rua X, número" sem dizer produto, assume 1x Gás P13

Só gere SELECT statements via generate_sql. Para ações, use as ferramentas.
${unidade_id ? `Filtre por unidade_id = '${unidade_id}' nas queries.` : ""}
${entregador_id ? `O entregador_id atual é '${entregador_id}'.` : ""}
Use timezone 'America/Sao_Paulo'. Limite a 50 linhas.

${TABLES_SCHEMA}`,
          },
          ...messages,
        ],
        tools: ENTREGADOR_TOOLS,
        tool_choice: "auto",
      }),
    });

    if (!intentResponse.ok) {
      const status = intentResponse.status;
      await intentResponse.text();
      if (status === 429) return errResponse(429, "Muitas requisições. Aguarde.", corsHeaders);
      if (status === 402) return errResponse(402, "Créditos insuficientes.", corsHeaders);
      throw new Error("Falha ao processar");
    }

    const intentResult = await intentResponse.json();
    const toolCalls = intentResult.choices?.[0]?.message?.tool_calls || [];

    for (const toolCall of toolCalls) {
      const fnName = toolCall.function?.name;
      const args = JSON.parse(toolCall.function?.arguments || "{}");

      if (fnName === "generate_sql") {
        const sqlQuery = args.sql || "";
        queryDescription = args.description || "";
        const validationError = validateEntregadorSql(sqlQuery, unidade_id);
        if (validationError) {
          queryError = validationError;
        } else {
          try {
            const { data, error } = await supabase.rpc("execute_readonly_query", { query_text: sqlQuery });
            if (error) queryError = error.message;
            else queryData = data;
          } catch (e) {
            queryError = e instanceof Error ? e.message : "Erro";
          }
        }
      } else {
        const result = await executeAction(supabase, fnName, args, unidade_id, entregador_id);
        actionResults.push(result);
      }
    }

    // Step 2: Generate natural response
    let dataContext = "";
    if (queryData) dataContext = `\nResultado da consulta (${queryDescription}):\n${JSON.stringify(queryData, null, 2)}`;
    else if (queryError) dataContext = `\nErro na consulta: ${queryError}`;
    if (actionResults.length > 0) dataContext += `\n\nResultados:\n${actionResults.join("\n")}`;

    const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é o assistente inteligente do entregador de gás. Fale de forma direta, informal e eficiente — o entregador está na rua e precisa de respostas rápidas.

CAPACIDADES:
- Lançar vendas/pedidos por comando de voz
- Transferir estoque entre filiais
- Consultar estoque, pedidos, clientes
- Movimentar estoque (entrada/saída/avaria)

FORMATAÇÃO:
- Respostas CURTAS e objetivas
- Use emojis para status (✅ ❌ 📦 🔥)
- Formate valores como R$ X,XX
- Confirme ações com detalhes resumidos

Hoje: ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
${dataContext || "\nNenhuma consulta necessária."}`,
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!finalResponse.ok) {
      const status = finalResponse.status;
      await finalResponse.text();
      if (status === 429) return errResponse(429, "Muitas requisições.", corsHeaders);
      if (status === 402) return errResponse(402, "Créditos insuficientes.", corsHeaders);
      throw new Error("Falha ao gerar resposta");
    }

    return new Response(finalResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("entregador-chat-ia error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function errResponse(status: number, error: string, headers: Record<string, string>) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function executeAction(supabase: any, action: string, params: any, unidade_id: string | null, entregador_id: string | null): Promise<string> {
  try {
    switch (action) {
      case "criar_pedido": {
        const { cliente_nome, cliente_telefone, itens, forma_pagamento, endereco_entrega, observacoes, troco_para } = params;

        let clienteId = null;
        if (cliente_nome) {
          const { data: cli } = await supabase.from("clientes").select("id").ilike("nome", `%${cliente_nome}%`).limit(1).single();
          clienteId = cli?.id || null;
        }

        let valorTotal = 0;
        const pedidoItens = [];
        for (const item of itens || []) {
          const { data: prod } = await supabase.from("produtos")
            .select("id, nome, preco")
            .ilike("nome", `%${item.produto_nome}%`)
            .eq("unidade_id", unidade_id)
            .limit(1)
            .single();
          const preco = prod?.preco || 0;
          pedidoItens.push({
            produto_id: prod?.id || null,
            produto_nome: prod?.nome || item.produto_nome,
            quantidade: item.quantidade,
            preco_unitario: preco,
          });
          valorTotal += item.quantidade * preco;
        }

        const { data: pedido, error: pedidoErr } = await supabase.from("pedidos").insert({
          cliente_id: clienteId,
          entregador_id: entregador_id || null,
          valor_total: valorTotal,
          forma_pagamento: forma_pagamento || "dinheiro",
          status: "pendente",
          canal_venda: "entregador",
          endereco_entrega: endereco_entrega || null,
          observacoes: observacoes || `Pedido via chat entregador${cliente_nome ? ` - ${cliente_nome}` : ""}`,
          troco_para: troco_para || null,
          unidade_id,
        }).select("id").single();
        if (pedidoErr) throw pedidoErr;

        for (const item of pedidoItens) {
          await supabase.from("pedido_itens").insert({
            pedido_id: pedido.id,
            produto_id: item.produto_id,
            produto_nome: item.produto_nome,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
          });
        }

        const itensStr = pedidoItens.map(i => `${i.quantidade}x ${i.produto_nome}`).join(", ");
        return `✅ Pedido criado (#${pedido.id.substring(0, 8)}): ${itensStr} → ${endereco_entrega || "sem endereço"}. Total: R$ ${valorTotal.toFixed(2)}`;
      }

      case "criar_transferencia_estoque": {
        const { unidade_destino_nome, itens, observacoes } = params;

        // Find destination unit
        const { data: destino } = await supabase.from("unidades")
          .select("id, nome")
          .ilike("nome", `%${unidade_destino_nome}%`)
          .eq("ativo", true)
          .limit(1)
          .single();
        if (!destino) return `❌ Filial "${unidade_destino_nome}" não encontrada`;

        let valorTotal = 0;
        const transferItens = [];
        for (const item of itens || []) {
          const { data: prod } = await supabase.from("produtos")
            .select("id, nome, custo, preco")
            .ilike("nome", `%${item.produto_nome}%`)
            .eq("unidade_id", unidade_id)
            .limit(1)
            .single();
          const precoCusto = prod?.custo || prod?.preco || 0;
          transferItens.push({
            produto_id: prod?.id || null,
            produto_nome: prod?.nome || item.produto_nome,
            quantidade: item.quantidade,
            preco_compra: precoCusto,
          });
          valorTotal += item.quantidade * precoCusto;
        }

        const { data: transf, error: tErr } = await supabase.from("transferencias_estoque").insert({
          unidade_origem_id: unidade_id,
          unidade_destino_id: destino.id,
          status: "pendente",
          valor_total: valorTotal,
          data_transferencia: new Date().toISOString().split("T")[0],
          observacoes: observacoes || `Transferência via chat entregador`,
        }).select("id").single();
        if (tErr) throw tErr;

        for (const item of transferItens) {
          await supabase.from("transferencia_estoque_itens").insert({
            transferencia_id: transf.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_compra: item.preco_compra,
          });
        }

        const itensStr = transferItens.map(i => `${i.quantidade}x ${i.produto_nome}`).join(", ");
        return `✅ Transferência criada para ${destino.nome}: ${itensStr}. Status: Pendente.`;
      }

      case "registrar_movimentacao_estoque": {
        const { produto_nome, tipo, quantidade, observacoes } = params;
        const { data: prod } = await supabase.from("produtos")
          .select("id, nome, estoque")
          .ilike("nome", `%${produto_nome}%`)
          .eq("unidade_id", unidade_id)
          .limit(1)
          .single();
        if (!prod) return `❌ Produto "${produto_nome}" não encontrado`;

        await supabase.from("movimentacoes_estoque").insert({
          produto_id: prod.id,
          tipo,
          quantidade,
          observacoes: observacoes || `${tipo} via chat entregador`,
          unidade_id,
        });

        const novoEstoque = tipo === "entrada" ? (prod.estoque || 0) + quantidade : (prod.estoque || 0) - quantidade;
        await supabase.from("produtos").update({ estoque: Math.max(0, novoEstoque) }).eq("id", prod.id);
        return `✅ ${tipo}: ${quantidade}x ${prod.nome}. Estoque: ${prod.estoque || 0} → ${Math.max(0, novoEstoque)}`;
      }

      case "atualizar_status_pedido": {
        const { pedido_id, novo_status } = params;
        const { error } = await supabase.from("pedidos").update({ status: novo_status }).eq("id", pedido_id);
        if (error) throw error;
        return `✅ Pedido ${pedido_id.substring(0, 8)} → "${novo_status}"`;
      }

      default:
        return `❌ Ação "${action}" não reconhecida`;
    }
  } catch (e) {
    console.error(`Action error [${action}]:`, e);
    return `❌ Erro: ${e instanceof Error ? e.message : "erro desconhecido"}`;
  }
}

function validateEntregadorSql(sqlQuery: string, unidadeId: string | null | undefined): string | null {
  const blocked = "Consulta rejeitada: filtro de unidade obrigatório.";
  const normalized = (sqlQuery || "").trim();
  if (!normalized) return blocked;
  const upper = normalized.toUpperCase();
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!unidadeId || !UUID_RE.test(String(unidadeId))) return blocked;
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) return blocked;
  if (normalized.includes(";") || normalized.includes("--") || normalized.includes("/*") || normalized.includes("*/")) return blocked;
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|MERGE|CALL|DO|EXECUTE|COPY|SET|RESET|VACUUM|ANALYZE|LOCK|LISTEN|NOTIFY|BEGIN|COMMIT|ROLLBACK|SAVEPOINT)\b/i.test(normalized)) return blocked;
  if (!/\bWHERE\b/i.test(normalized)) return blocked;
  const eq = new RegExp(`unidade_id\\s*=\\s*'${String(unidadeId).replace(/-/g, "\\-")}'`, "i");
  if (!eq.test(normalized)) return blocked;
  const foreignUuids = normalized.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
  for (const u of foreignUuids) {
    if (u.toLowerCase() !== String(unidadeId).toLowerCase()) return blocked;
  }
  const fromJoinCount = (normalized.match(/\b(FROM|JOIN)\b/gi) || []).length;
  const unidadeIdMentions = (normalized.match(/\bunidade_id\b/gi) || []).length;
  if (unidadeIdMentions < fromJoinCount) return blocked;
  if (/\bSELECT\b[\s\S]*\bSELECT\b/i.test(normalized)) return blocked;
  return null;
}
