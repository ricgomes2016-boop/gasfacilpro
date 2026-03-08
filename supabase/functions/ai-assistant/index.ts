import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES_SCHEMA = `
Tabelas disponíveis no sistema (distribuidora de gás):

== VENDAS & PEDIDOS ==
- pedidos: id, cliente_id, entregador_id, valor_total, forma_pagamento, status (pendente/em_preparo/saiu_entrega/entregue/cancelado), canal_venda, endereco_entrega, observacoes, troco_para, created_at, unidade_id
- pedido_itens: id, pedido_id, produto_id, quantidade, preco_unitario, produto_nome
- devolucoes: id, pedido_id, cliente_id, cliente_nome, motivo, tipo (troca/estorno/devolucao), status (pendente/aprovada/rejeitada/concluida), valor_total, aprovado_por, unidade_id, created_at
- devolucao_itens: id, devolucao_id, produto_id, produto_nome, quantidade, valor_unitario, motivo_item

== CLIENTES ==
- clientes: id, nome, telefone, cpf, email, endereco, bairro, cidade, numero, cep, latitude, longitude, tipo, ativo, created_at
- cliente_tags: id, nome, cor
- cliente_tag_associacoes: id, cliente_id, tag_id
- cliente_observacoes: id, cliente_id, texto, autor_id, created_at
- fidelidade_clientes: id, cliente_id, pontos, nivel (bronze/prata/ouro/diamante), indicacoes_realizadas, unidade_id
- contratos_recorrentes: id, cliente_id, cliente_nome, produto_id, produto_nome, quantidade, valor_unitario, frequencia (semanal/quinzenal/mensal), status, proxima_entrega, entregas_realizadas, dia_preferencial, turno_preferencial, unidade_id

== PRODUTOS & ESTOQUE ==
- produtos: id, nome, preco, estoque, categoria, ativo, codigo_barras, unidade_medida, peso, tipo (revenda/producao/insumo), estoque_minimo, custo, unidade_id
- compras: id, fornecedor_id, valor_total, valor_frete, status, data_compra, data_recebimento, numero_nota_fiscal, chave_nfe, unidade_id
- compra_itens: id, compra_id, produto_id, quantidade, preco_unitario
- comodatos: id, cliente_id, produto_id, quantidade, deposito, status (ativo/devolvido/perdido), data_emprestimo, data_devolucao, prazo_devolucao, unidade_id
- movimentacoes_estoque: id, produto_id, tipo (entrada/saida/avaria), quantidade, observacoes, unidade_id, created_at
- transferencias_estoque: id, unidade_origem_id, unidade_destino_id, status (pendente/em_transito/recebido/cancelado), valor_total, data_transferencia, data_envio, data_recebimento, observacoes, created_at
- transferencia_estoque_itens: id, transferencia_id, produto_id, quantidade, preco_compra

== VIEW: PREVISÃO DE RUPTURA (Use esta view para perguntas sobre estoque crítico) ==
- vw_previsao_ruptura: id, nome, categoria, tipo_botijao, estoque, unidade_id, giro_diario, estoque_minimo_calculado, dias_ate_ruptura (null = sem histórico de vendas), situacao (ok/alerta/critico/sem_estoque)
  QUANDO USAR: "produtos críticos", "ruptura", "vai acabar", "dias restantes de estoque", "estoque mínimo"
  EXEMPLO: SELECT nome, estoque, dias_ate_ruptura, situacao FROM vw_previsao_ruptura WHERE situacao != 'ok' AND unidade_id = '...' ORDER BY dias_ate_ruptura ASC

== LOGÍSTICA & ENTREGAS ==
- entregadores: id, nome, telefone, cpf, email, cnh, cnh_vencimento, status (disponivel/em_rota/indisponivel), ativo, latitude, longitude, user_id, funcionario_id, unidade_id
- carregamentos_rota: id, entregador_id, status (preparando/em_rota/retornado/conferido), data_saida, data_retorno, rota_definida_id, unidade_id
- carregamento_rota_itens: id, carregamento_id, produto_id, quantidade_saida, quantidade_vendida, quantidade_retorno
- escalas_entregador: id, entregador_id, data, turno_inicio, turno_fim, status, rota_definida_id, unidade_id
- rotas_definidas: id, nome, bairros, entregador_padrao_id, ativo, unidade_id

== FINANCEIRO ==
- movimentacoes_caixa: id, tipo (entrada/saida), valor, descricao, categoria, pedido_id, created_at, unidade_id
- contas_pagar: id, fornecedor, descricao, valor, vencimento, status (pendente/pago/vencido), categoria, boleto_codigo_barras, boleto_linha_digitavel, unidade_id
- contas_receber: id, cliente, descricao, valor, vencimento, status, forma_pagamento, pedido_id, unidade_id
- caixa_sessoes: id, data, status (aberto/fechado), valor_abertura, valor_fechamento, diferenca, usuario_abertura_id, unidade_id
- conferencia_cartao: id, data_venda, tipo (credito/debito), bandeira, valor_bruto, taxa_percentual, valor_taxa, valor_liquido_esperado, valor_liquido_recebido, status, parcelas, nsu, operadora_id, pedido_id, unidade_id
- extrato_bancario: id, data, descricao, valor, tipo (credito/debito), conciliado, pedido_id, unidade_id
- boletos_emitidos: id, sacado, cpf_cnpj, valor, vencimento, emissao, status, numero, unidade_id

== RH & FUNCIONÁRIOS ==
- funcionarios: id, nome, cargo, salario, setor, ativo, data_admissao, cpf, email, telefone, endereco, tipo_contrato, jornada_semanal, unidade_id
- folhas_pagamento: id, mes_referencia, status, total_bruto, total_descontos, total_liquido, total_comissoes, total_funcionarios, unidade_id
- folha_pagamento_itens: id, folha_id, funcionario_id, funcionario_nome, salario_base, comissao, horas_extras, bonus, bruto, inss, ir, vales_desconto, outros_descontos, liquido
- ferias: id, funcionario_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, dias_direito, dias_gozados, dias_vendidos, data_inicio, data_fim, status, unidade_id
- banco_horas: id, funcionario_id, saldo_positivo, saldo_negativo, unidade_id
- bonus: id, funcionario_id, tipo, valor, status, mes_referencia, unidade_id
- avaliacoes_desempenho: id, funcionario_id, periodo_referencia, nota_geral, produtividade, pontualidade, comunicacao, trabalho_equipe, iniciativa, status, unidade_id
- alertas_jornada: id, funcionario_id, data, tipo, descricao, nivel, resolvido, unidade_id
- atestados_faltas: id, funcionario_id, tipo (atestado/falta), data_inicio, data_fim, dias, abona, motivo, unidade_id
- comissao_config: id, produto_id, canal_venda, valor, unidade_id

== FROTA & VEÍCULOS ==
- veiculos: id, placa, modelo, marca, ano, tipo, status, km_atual, unidade_id
- abastecimentos: id, veiculo_id, entregador_id, valor, litros, km, motorista, data, tipo, posto, nota_fiscal, status, sem_saida_caixa, unidade_id
- manutencoes: id, veiculo_id, tipo, descricao, valor, data, status, km, oficina, unidade_id
- checklist_saida_veiculo: id, veiculo_id, entregador_id, data, pneus, freios, luzes, oleo, agua, limpeza, documentos, avarias, aprovado, unidade_id

== ATENDIMENTO ==
- chamadas_recebidas: id, telefone, cliente_id, cliente_nome, tipo (telefone/whatsapp), status (recebida/atendida/perdida/finalizada), atendente_id, pedido_gerado_id, duracao_segundos, observacoes, unidade_id, created_at

== FISCAL ==
- notas_fiscais: id, tipo, numero, serie, chave_acesso, status, valor_total, destinatario, unidade_id (se existir)

== CAMPANHAS & MARKETING ==
- campanhas: id, nome, tipo, status, alcance, enviados, data_criacao, unidade_id
- canais_venda: id, nome, tipo, ativo, unidade_id

== METAS ==
- metas: id, titulo, tipo, valor_objetivo, valor_atual, status (em_andamento/ativa/concluida/cancelada), prazo

== CONFIGURAÇÕES ==
- unidades: id, nome, tipo, cidade, estado, ativo, cnpj, telefone, endereco
- fornecedores: id, razao_social, nome_fantasia, cnpj, tipo, telefone, email, cidade, estado, ativo
- categorias_despesa: id, nome, grupo, tipo, ativo, codigo_contabil, valor_padrao, unidade_id
- profiles: id, user_id, full_name, email, avatar_url
- user_roles: id, user_id, role (admin/gestor/operacional/financeiro/entregador)

== ASSISTENTE IA ==
- ai_conversas: id, user_id, titulo, created_at, updated_at
- ai_mensagens: id, conversa_id, role (user/assistant), content, created_at
`;

const ACTIONS_SCHEMA = `
Ações que você pode executar (use a tool "execute_action" quando o usuário pedir):
- criar_pedido: {cliente_nome, produtos: [{nome, quantidade}], forma_pagamento, endereco_entrega}
- atualizar_status_pedido: {pedido_id, novo_status}
- atualizar_status_entregador: {entregador_id, novo_status}

IMPORTANTE: Sempre confirme com o usuário antes de executar qualquer ação. Liste os dados e pergunte "Deseja que eu execute?".
Quando o usuário confirmar, execute a ação. Se não confirmar, não execute.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, unidade_id, action } = await req.json();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Handle action execution
    if (action) {
      return await handleAction(supabase, action, unidade_id, corsHeaders);
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // Detect if it's a conversational message (no SQL needed)
    const isConversational = /^(ol[áa]|oi|bom dia|boa tarde|boa noite|tudo bem|obrigad|valeu|tchau|ajuda|o que voc[êe]|quem [ée] voc[êe])/i.test(lastUserMessage.trim());

    let queryData: any[] | null = null;
    let queryError: string | null = null;
    let queryDescription = "";
    let sqlQuery = "NO_SQL";

    if (!isConversational) {
      // Step 1: Ask AI to generate SQL
      const sqlResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              content: `Você é um assistente de BI para uma distribuidora de gás. Gere APENAS consultas SQL SELECT seguras baseadas no schema abaixo.
NUNCA gere INSERT, UPDATE, DELETE, DROP, ALTER ou qualquer comando que modifique dados.
Retorne APENAS o SQL puro sem markdown, sem explicação, sem backticks.
Se a pergunta não puder ser respondida com SQL (é uma conversa casual ou pedido de ação), retorne exatamente: NO_SQL
${unidade_id ? `Filtre por unidade_id = '${unidade_id}' quando a tabela tiver essa coluna.` : ""}
Use timezone 'America/Sao_Paulo' para datas. Use NOW() para data atual.
Limite resultados a no máximo 50 linhas.
Para perguntas sobre "hoje", use: created_at::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
Para "este mês": date_trunc('month', created_at AT TIME ZONE 'America/Sao_Paulo') = date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')

${TABLES_SCHEMA}`,
            },
            { role: "user", content: lastUserMessage },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "generate_sql",
                description: "Gera uma query SQL SELECT para responder a pergunta do usuário",
                parameters: {
                  type: "object",
                  properties: {
                    sql: { type: "string", description: "A query SQL SELECT ou NO_SQL se não aplicável" },
                    description: { type: "string", description: "Breve descrição do que a query faz" },
                    chart_type: { type: "string", enum: ["bar", "line", "pie", "area", "none"], description: "Tipo de gráfico recomendado para os dados. Use 'none' se não fizer sentido visualizar graficamente." },
                  },
                  required: ["sql", "description", "chart_type"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "generate_sql" } },
        }),
      });

      if (!sqlResponse.ok) {
        const status = sqlResponse.status;
        const txt = await sqlResponse.text();
        console.error("AI SQL generation error:", status, txt);
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("Falha ao gerar consulta");
      }

      const sqlResult = await sqlResponse.json();
      const toolCall = sqlResult.choices?.[0]?.message?.tool_calls?.[0];
      let chartType = "none";

      if (toolCall?.function?.arguments) {
        const args = JSON.parse(toolCall.function.arguments);
        sqlQuery = args.sql || "NO_SQL";
        queryDescription = args.description || "";
        chartType = args.chart_type || "none";
      }

      // Validate: only SELECT allowed
      if (sqlQuery !== "NO_SQL") {
        const normalized = sqlQuery.trim().toUpperCase();
        if (!normalized.startsWith("SELECT")) {
          sqlQuery = "NO_SQL";
        }
      }

      // Execute query
      if (sqlQuery !== "NO_SQL") {
        try {
          const { data, error } = await supabase.rpc("execute_readonly_query", { query_text: sqlQuery });
          if (error) {
            console.error("Query error:", error);
            queryError = error.message;
          } else {
            queryData = data;
          }
        } catch (e) {
          console.error("Query execution error:", e);
          queryError = e instanceof Error ? e.message : "Erro ao executar consulta";
        }
      }

      // If we have chart data, include chart metadata
      if (queryData && chartType !== "none" && Array.isArray(queryData) && queryData.length > 0) {
        queryDescription += `\n\n[CHART_META]${JSON.stringify({ type: chartType, data: queryData })}[/CHART_META]`;
      }
    }

    // Step 2: Generate natural language response
    const dataContext = queryData
      ? `\nResultado da consulta (${queryDescription}):\n${JSON.stringify(queryData, null, 2)}`
      : queryError
      ? `\nErro na consulta: ${queryError}`
      : "\nNenhuma consulta de banco foi necessária.";

    // Get current time info for context-aware suggestions
    const now = new Date();
    const brHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
    const dayOfWeek = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" });
    const dayOfMonth = parseInt(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", day: "2-digit" }));

    let timeContext = "";
    if (brHour < 12) timeContext = "É manhã — bom momento para verificar pedidos pendentes e estoque.";
    else if (brHour < 18) timeContext = "É tarde — período de maior movimento de entregas.";
    else timeContext = "É noite — bom momento para verificar o fechamento do dia.";
    if (dayOfMonth >= 25) timeContext += " Fim do mês — considere verificar contas a pagar/receber e folha.";

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
            content: `Você é o assistente inteligente de uma distribuidora de gás. Seu nome é GásBot. Responda de forma clara e objetiva em português brasileiro.
Use markdown para formatar: tabelas, negrito, listas, etc.
Formate valores monetários como R$ X.XXX,XX.
Se os dados retornaram vazio, diga que não foram encontrados registros para o período/filtro.
Se houve erro na consulta, peça ao usuário reformular a pergunta.
Seja proativo: além de responder, sugira insights ou ações baseadas nos dados.

CONTEXTO TEMPORAL: Hoje é ${dayOfWeek}, ${now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. ${timeContext}

AÇÕES DISPONÍVEIS: Você pode ajudar o usuário a executar ações no sistema. ${ACTIONS_SCHEMA}

Quando recomendar gráficos, se os dados contiverem [CHART_META]...[/CHART_META], inclua o bloco na resposta para que o frontend renderize o gráfico. NÃO remova os marcadores CHART_META.

Se for a primeira mensagem do usuário, cumprimente brevemente e sugira 2-3 perguntas relevantes baseadas no contexto temporal.
${dataContext}`,
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!finalResponse.ok) {
      const status = finalResponse.status;
      await finalResponse.text();
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Falha ao gerar resposta");
    }

    return new Response(finalResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleAction(supabase: any, action: any, unidade_id: string | null, corsHeaders: Record<string, string>) {
  try {
    const { type, params } = action;

    switch (type) {
      case "atualizar_status_pedido": {
        const { pedido_id, novo_status } = params;
        const validStatuses = ["pendente", "em_preparo", "saiu_entrega", "entregue", "cancelado"];
        if (!validStatuses.includes(novo_status)) {
          return new Response(JSON.stringify({ error: `Status inválido. Use: ${validStatuses.join(", ")}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await supabase.from("pedidos").update({ status: novo_status }).eq("id", pedido_id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: `Pedido atualizado para "${novo_status}"` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "atualizar_status_entregador": {
        const { entregador_id, novo_status } = params;
        const validStatuses = ["disponivel", "em_rota", "indisponivel"];
        if (!validStatuses.includes(novo_status)) {
          return new Response(JSON.stringify({ error: `Status inválido. Use: ${validStatuses.join(", ")}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await supabase.from("entregadores").update({ status: novo_status }).eq("id", entregador_id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: `Entregador atualizado para "${novo_status}"` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error("Action error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao executar ação" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
