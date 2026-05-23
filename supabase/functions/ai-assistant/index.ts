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
- clientes: id, nome, telefone, cpf, email, endereco, bairro, cidade, numero, cep, latitude, longitude, tipo, ativo, created_at, empresa_id
- cliente_tags: id, nome, cor
- cliente_tag_associacoes: id, cliente_id, tag_id
- cliente_observacoes: id, cliente_id, texto, autor_id, created_at
- fidelidade_clientes: id, cliente_id, pontos, nivel (bronze/prata/ouro/diamante), indicacoes_realizadas, unidade_id
- contratos_recorrentes: id, cliente_id, cliente_nome, produto_id, produto_nome, quantidade, valor_unitario, frequencia (semanal/quinzenal/mensal), status, proxima_entrega, entregas_realizadas, dia_preferencial, turno_preferencial, unidade_id

== PRODUTOS & ESTOQUE ==
- produtos: id, nome, preco, estoque, categoria (gas/agua/acessorio/vasilhame/outro), tipo_botijao (cheio/vazio/null), ativo, codigo_barras, unidade_medida, peso, tipo (revenda/producao/insumo), estoque_minimo, custo, unidade_id, descricao
- compras: id, fornecedor_id, valor_total, valor_frete, status, data_compra, data_recebimento, numero_nota_fiscal, chave_nfe, unidade_id, observacoes
- compra_itens: id, compra_id, produto_id, quantidade, preco_unitario
- comodatos: id, cliente_id, produto_id, quantidade, deposito, status (ativo/devolvido/perdido), data_emprestimo, data_devolucao, prazo_devolucao, unidade_id
- movimentacoes_estoque: id, produto_id, tipo (entrada/saida/avaria), quantidade, observacoes, unidade_id, created_at
- transferencias_estoque: id, unidade_origem_id, unidade_destino_id, status (pendente/em_transito/recebido/cancelado), valor_total, data_transferencia, data_envio, data_recebimento, observacoes, created_at
- transferencia_estoque_itens: id, transferencia_id, produto_id, quantidade, preco_compra

== VIEW: PREVISÃO DE RUPTURA ==
- vw_previsao_ruptura: id, nome, categoria, tipo_botijao, estoque, unidade_id, giro_diario, estoque_minimo_calculado, dias_ate_ruptura, situacao (ok/alerta/critico/sem_estoque)

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
- categorias_despesa: id, nome, grupo, tipo, ativo, codigo_contabil, valor_padrao, unidade_id

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
- chamadas_recebidas: id, telefone, cliente_id, cliente_nome, tipo, status, atendente_id, pedido_gerado_id, duracao_segundos, observacoes, unidade_id, created_at

== FORNECEDORES ==
- fornecedores: id, razao_social, nome_fantasia, cnpj, tipo, telefone, email, cidade, estado, ativo, unidade_id

== CONFIGURAÇÕES ==
- unidades: id, nome, tipo, cidade, estado, ativo, cnpj, telefone, endereco, empresa_id
- profiles: id, user_id, full_name, email, avatar_url, empresa_id
- user_roles: id, user_id, role (admin/gestor/operacional/financeiro/entregador)

== METAS ==
- metas: id, titulo, tipo, valor_objetivo, valor_atual, status, prazo

== CAMPANHAS ==
- campanhas: id, nome, tipo, status, alcance, enviados, data_criacao, unidade_id
- canais_venda: id, nome, tipo, ativo, unidade_id
`;

// Tools that the AI can call to execute write operations
const ACTION_TOOLS = [
  {
    type: "function",
    function: {
      name: "cadastrar_produto",
      description: "Cadastra um novo produto no sistema",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome do produto (ex: Gás P13, Água 20L, Mangueira 1.5m)" },
          preco: { type: "number", description: "Preço de venda" },
          categoria: { type: "string", enum: ["gas", "agua", "acessorio", "vasilhame", "outro"], description: "Categoria do produto" },
          tipo_botijao: { type: "string", enum: ["cheio", "vazio"], description: "Tipo do botijão (apenas para gas/agua/vasilhame)" },
          estoque: { type: "number", description: "Quantidade inicial em estoque" },
          custo: { type: "number", description: "Preço de custo" },
          estoque_minimo: { type: "number", description: "Estoque mínimo para alerta" },
          descricao: { type: "string", description: "Descrição do produto" },
          codigo_barras: { type: "string", description: "Código de barras" },
        },
        required: ["nome", "preco", "categoria"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cadastrar_funcionario",
      description: "Cadastra um novo funcionário no sistema",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome completo do funcionário" },
          cargo: { type: "string", description: "Cargo (ex: Entregador, Atendente, Gerente)" },
          salario: { type: "number", description: "Salário mensal" },
          setor: { type: "string", description: "Setor (ex: Entregas, Administrativo, Vendas)" },
          cpf: { type: "string", description: "CPF do funcionário" },
          telefone: { type: "string", description: "Telefone" },
          email: { type: "string", description: "Email" },
          endereco: { type: "string", description: "Endereço completo" },
          data_admissao: { type: "string", description: "Data de admissão (YYYY-MM-DD)" },
          tipo_contrato: { type: "string", enum: ["clt", "pj", "temporario", "estagio"], description: "Tipo de contrato" },
          jornada_semanal: { type: "number", description: "Horas semanais de trabalho" },
        },
        required: ["nome", "cargo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cadastrar_cliente",
      description: "Cadastra um novo cliente no sistema",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome do cliente" },
          telefone: { type: "string", description: "Telefone" },
          cpf: { type: "string", description: "CPF ou CNPJ" },
          email: { type: "string", description: "Email" },
          endereco: { type: "string", description: "Rua/Logradouro" },
          bairro: { type: "string", description: "Bairro" },
          cidade: { type: "string", description: "Cidade" },
          numero: { type: "string", description: "Número" },
          cep: { type: "string", description: "CEP" },
          tipo: { type: "string", enum: ["residencial", "comercial", "industrial", "condominio"], description: "Tipo de cliente" },
        },
        required: ["nome"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cadastrar_fornecedor",
      description: "Cadastra um novo fornecedor no sistema",
      parameters: {
        type: "object",
        properties: {
          razao_social: { type: "string", description: "Razão social" },
          nome_fantasia: { type: "string", description: "Nome fantasia" },
          cnpj: { type: "string", description: "CNPJ" },
          tipo: { type: "string", description: "Tipo (ex: distribuidora, fabricante, prestador_servico)" },
          telefone: { type: "string", description: "Telefone" },
          email: { type: "string", description: "Email" },
          cidade: { type: "string", description: "Cidade" },
          estado: { type: "string", description: "Estado (UF)" },
        },
        required: ["razao_social"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_compra",
      description: "Registra uma compra de mercadoria (entrada de estoque). Cria a compra e seus itens.",
      parameters: {
        type: "object",
        properties: {
          fornecedor_id: { type: "string", description: "ID do fornecedor (buscar antes se necessário)" },
          fornecedor_nome: { type: "string", description: "Nome do fornecedor (para buscar ou criar)" },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                produto_nome: { type: "string", description: "Nome do produto" },
                quantidade: { type: "number" },
                preco_unitario: { type: "number" },
              },
              required: ["produto_nome", "quantidade", "preco_unitario"],
            },
            description: "Itens da compra",
          },
          valor_frete: { type: "number", description: "Valor do frete" },
          numero_nota_fiscal: { type: "string", description: "Número da nota fiscal" },
          data_compra: { type: "string", description: "Data da compra (YYYY-MM-DD)" },
          observacoes: { type: "string", description: "Observações" },
        },
        required: ["itens"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_despesa",
      description: "Registra uma despesa/conta a pagar no sistema",
      parameters: {
        type: "object",
        properties: {
          fornecedor: { type: "string", description: "Nome do fornecedor ou beneficiário" },
          descricao: { type: "string", description: "Descrição da despesa" },
          valor: { type: "number", description: "Valor da despesa" },
          vencimento: { type: "string", description: "Data de vencimento (YYYY-MM-DD)" },
          categoria: { type: "string", description: "Categoria (ex: aluguel, energia, agua, combustivel, manutencao, salarios, outros)" },
          status: { type: "string", enum: ["pendente", "pago"], description: "Status do pagamento" },
        },
        required: ["descricao", "valor", "vencimento"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_pedido",
      description: "Cria um novo pedido de venda",
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
                produto_nome: { type: "string", description: "Nome do produto" },
                quantidade: { type: "number" },
              },
              required: ["produto_nome", "quantidade"],
            },
          },
          forma_pagamento: { type: "string", enum: ["dinheiro", "pix", "cartao_credito", "cartao_debito", "fiado"], description: "Forma de pagamento" },
          endereco_entrega: { type: "string", description: "Endereço de entrega" },
          observacoes: { type: "string", description: "Observações do pedido" },
          troco_para: { type: "number", description: "Troco para (se dinheiro)" },
        },
        required: ["itens"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_status_pedido",
      description: "Atualiza o status de um pedido existente",
      parameters: {
        type: "object",
        properties: {
          pedido_id: { type: "string", description: "ID do pedido" },
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
      name: "registrar_movimentacao_estoque",
      description: "Registra entrada, saída ou avaria de estoque de um produto",
      parameters: {
        type: "object",
        properties: {
          produto_nome: { type: "string", description: "Nome do produto" },
          tipo: { type: "string", enum: ["entrada", "saida", "avaria"], description: "Tipo de movimentação" },
          quantidade: { type: "number", description: "Quantidade" },
          observacoes: { type: "string", description: "Motivo/observações da movimentação" },
        },
        required: ["produto_nome", "tipo", "quantidade"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cadastrar_veiculo",
      description: "Cadastra um novo veículo na frota",
      parameters: {
        type: "object",
        properties: {
          placa: { type: "string", description: "Placa do veículo" },
          modelo: { type: "string", description: "Modelo" },
          marca: { type: "string", description: "Marca" },
          ano: { type: "number", description: "Ano" },
          tipo: { type: "string", description: "Tipo (ex: moto, caminhonete, caminhao, van)" },
          km_atual: { type: "number", description: "Quilometragem atual" },
        },
        required: ["placa", "modelo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_manutencao",
      description: "Registra uma manutenção de veículo",
      parameters: {
        type: "object",
        properties: {
          veiculo_placa: { type: "string", description: "Placa do veículo" },
          tipo: { type: "string", description: "Tipo de manutenção (preventiva/corretiva)" },
          descricao: { type: "string", description: "Descrição do serviço" },
          valor: { type: "number", description: "Valor" },
          data: { type: "string", description: "Data (YYYY-MM-DD)" },
          km: { type: "number", description: "Quilometragem no momento" },
          oficina: { type: "string", description: "Nome da oficina" },
        },
        required: ["descricao", "valor"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_conta_receber",
      description: "Registra um valor a receber de um cliente",
      parameters: {
        type: "object",
        properties: {
          cliente: { type: "string", description: "Nome do cliente" },
          descricao: { type: "string", description: "Descrição" },
          valor: { type: "number", description: "Valor" },
          vencimento: { type: "string", description: "Data de vencimento (YYYY-MM-DD)" },
          forma_pagamento: { type: "string", description: "Forma de pagamento esperada" },
        },
        required: ["cliente", "descricao", "valor", "vencimento"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_preco_produto",
      description: "Atualiza o preço de venda de um produto existente",
      parameters: {
        type: "object",
        properties: {
          produto_nome: { type: "string", description: "Nome do produto" },
          novo_preco: { type: "number", description: "Novo preço de venda" },
        },
        required: ["produto_nome", "novo_preco"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, unidade_id } = await req.json();

    // Validate unidade_id as UUID to prevent prompt/SQL injection
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (unidade_id !== null && unidade_id !== undefined && unidade_id !== "" && !UUID_RE.test(String(unidade_id))) {
      return new Response(JSON.stringify({ error: "unidade_id inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate JWT before doing anything privileged
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require a privileged role to use the AI assistant (it can read all tenant data
    // and perform mutations via the service role key).
    const allowedRoles = ["admin", "gestor", "super_admin", "financeiro", "operacional"];
    const { data: roleRows } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const hasAllowedRole = (roleRows || []).some((r: any) => allowedRoles.includes(r.role));
    if (!hasAllowedRole) {
      return new Response(JSON.stringify({ error: "Acesso negado: requer perfil administrativo." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify unidade_id belongs to the caller's empresa (tenant isolation)
    if (unidade_id) {
      const { data: profile } = await callerClient.from("profiles").select("empresa_id").eq("user_id", userData.user.id).single();
      if (profile?.empresa_id) {
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data: u } = await adminClient.from("unidades").select("id").eq("id", unidade_id).eq("empresa_id", profile.empresa_id).maybeSingle();
        if (!u) {
          return new Response(JSON.stringify({ error: "Acesso negado a essa unidade." }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // Detect if it's a conversational message (no SQL or action needed)
    const isConversational = /^(ol[áa]|oi|bom dia|boa tarde|boa noite|tudo bem|obrigad|valeu|tchau|ajuda|o que voc[êe]|quem [ée] voc[êe])/i.test(lastUserMessage.trim());

    let queryData: any[] | null = null;
    let queryError: string | null = null;
    let queryDescription = "";
    let actionResults: string[] = [];

    if (!isConversational) {
      // Step 1: Determine intent — SQL query vs action vs both
      const intentResponse = await callAI(LOVABLE_API_KEY, [
        {
          role: "system",
          content: `Você é um assistente de uma distribuidora de gás. Analise a mensagem do usuário e determine:
1. Se precisa consultar dados → use generate_sql
2. Se precisa executar uma ação (cadastro, atualização, registro) → use a ferramenta correspondente
3. Se precisa consultar E executar → use ambas
4. Se é conversa casual → não use nenhuma ferramenta

REGRAS IMPORTANTES:
- Só gere SELECT statements. NUNCA INSERT/UPDATE/DELETE via SQL.
- Para QUALQUER cadastro ou modificação de dados, use as ferramentas de ação (cadastrar_produto, registrar_compra, etc.)
- Sempre confirme com o usuário ANTES de executar ações. Se o usuário está PEDINDO algo (ex: "cadastre o produto X"), execute diretamente.
- Se o usuário está perguntando sobre algo (ex: "quanto custa o P13?"), use SQL para consultar.
${unidade_id ? `Filtre por unidade_id = '${unidade_id}' quando a tabela tiver essa coluna.` : ""}
Use timezone 'America/Sao_Paulo' para datas. Use NOW() para data atual.
Limite resultados a no máximo 50 linhas.
Para "hoje": created_at::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
Para "este mês": date_trunc('month', created_at AT TIME ZONE 'America/Sao_Paulo') = date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')

${TABLES_SCHEMA}`,
        },
        ...messages,
      ], [
        {
          type: "function",
          function: {
            name: "generate_sql",
            description: "Gera uma query SQL SELECT para consultar dados do sistema",
            parameters: {
              type: "object",
              properties: {
                sql: { type: "string", description: "Query SQL SELECT" },
                description: { type: "string", description: "Descrição da consulta" },
                chart_type: { type: "string", enum: ["bar", "line", "pie", "area", "none"] },
              },
              required: ["sql", "description", "chart_type"],
              additionalProperties: false,
            },
          },
        },
        ...ACTION_TOOLS,
      ]);

      if (!intentResponse.ok) {
        const status = intentResponse.status;
        await intentResponse.text();
        if (status === 429) {
          return errResponse(429, "Muitas requisições. Tente novamente em alguns segundos.", corsHeaders);
        }
        if (status === 402) {
          return errResponse(402, "Créditos de IA esgotados.", corsHeaders);
        }
        throw new Error("Falha ao processar requisição");
      }

      const intentResult = await intentResponse.json();
      const toolCalls = intentResult.choices?.[0]?.message?.tool_calls || [];

      for (const toolCall of toolCalls) {
        const fnName = toolCall.function?.name;
        const args = JSON.parse(toolCall.function?.arguments || "{}");

        if (fnName === "generate_sql") {
          const sqlQuery = args.sql || "NO_SQL";
          queryDescription = args.description || "";
          const chartType = args.chart_type || "none";

          // Validate
          if (sqlQuery !== "NO_SQL" && sqlQuery.trim().toUpperCase().startsWith("SELECT")) {
            try {
              const { data, error } = await supabase.rpc("execute_readonly_query", { query_text: sqlQuery });
              if (error) {
                queryError = error.message;
              } else {
                queryData = data;
              }
            } catch (e) {
              queryError = e instanceof Error ? e.message : "Erro ao executar consulta";
            }

            if (queryData && chartType !== "none" && Array.isArray(queryData) && queryData.length > 0) {
              queryDescription += `\n\n[CHART_META]${JSON.stringify({ type: chartType, data: queryData })}[/CHART_META]`;
            }
          }
        } else {
          // Execute action
          const result = await executeAction(supabase, fnName, args, unidade_id);
          actionResults.push(result);
        }
      }
    }

    // Step 2: Generate final natural language response
    const now = new Date();
    const brHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
    const dayOfWeek = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" });
    const dayOfMonth = parseInt(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", day: "2-digit" }));

    let timeContext = "";
    if (brHour < 12) timeContext = "É manhã — bom momento para verificar pedidos pendentes e estoque.";
    else if (brHour < 18) timeContext = "É tarde — período de maior movimento de entregas.";
    else timeContext = "É noite — bom momento para verificar o fechamento do dia.";
    if (dayOfMonth >= 25) timeContext += " Fim do mês — considere verificar contas a pagar/receber e folha.";

    const isSunday = dayOfWeek.toLowerCase().includes("domingo");
    let sundayContext = "";
    if (isSunday) {
      sundayContext = `\nREGRAS DE DOMINGO: Horário reduzido (até 14h). NÃO há entrega de água aos domingos (apenas retirada).`;
    }

    let dataContext = "";
    if (queryData) {
      dataContext = `\nResultado da consulta (${queryDescription}):\n${JSON.stringify(queryData, null, 2)}`;
    } else if (queryError) {
      dataContext = `\nErro na consulta: ${queryError}`;
    }
    if (actionResults.length > 0) {
      dataContext += `\n\nResultados das ações executadas:\n${actionResults.join("\n")}`;
    }
    if (!dataContext) {
      dataContext = "\nNenhuma consulta ou ação foi necessária.";
    }

    const actionsList = ACTION_TOOLS.map(t => `- ${t.function.name}: ${t.function.description}`).join("\n");

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
            content: `Você é o assistente do sistema de uma distribuidora de gás. Tom direto, simples e levemente formal. Sem emojis, sem gírias.

Você pode consultar dados (vendas, estoque, clientes, financeiro, RH, frota) e executar ações no sistema.

Ações disponíveis:
${actionsList}

Formatação:
- Use markdown quando ajudar (tabelas, negrito, listas).
- Formate valores como R$ X.XXX,XX.
- Se não houver dados, informe de forma clara.
- Ao executar ações, confirme o que foi feito.
- Mantenha o bloco [CHART_META]...[/CHART_META] na resposta quando presente.

Contexto: Hoje é ${dayOfWeek}, ${now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. ${timeContext}${sundayContext}

Na primeira mensagem, cumprimente brevemente e ofereça ajuda.
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
      if (status === 429) return errResponse(429, "Muitas requisições. Tente novamente.", corsHeaders);
      if (status === 402) return errResponse(402, "Créditos de IA esgotados.", corsHeaders);
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

function errResponse(status: number, error: string, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAI(apiKey: string, messages: any[], tools: any[]) {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      tools,
      tool_choice: "auto",
    }),
  });
}

async function executeAction(supabase: any, action: string, params: any, unidade_id: string | null): Promise<string> {
  try {
    switch (action) {
      case "cadastrar_produto": {
        const { nome, preco, categoria, tipo_botijao, estoque, custo, estoque_minimo, descricao, codigo_barras } = params;
        const { data, error } = await supabase.from("produtos").insert({
          nome,
          preco: preco || 0,
          categoria,
          tipo_botijao: tipo_botijao || null,
          estoque: estoque || 0,
          custo: custo || null,
          estoque_minimo: estoque_minimo || null,
          descricao: descricao || null,
          codigo_barras: codigo_barras || null,
          ativo: true,
          unidade_id,
        }).select("id, nome, preco").single();
        if (error) throw error;
        return `✅ Produto "${data.nome}" cadastrado com sucesso (ID: ${data.id}, Preço: R$ ${data.preco?.toFixed(2)})`;
      }

      case "cadastrar_funcionario": {
        const { nome, cargo, salario, setor, cpf, telefone, email, endereco, data_admissao, tipo_contrato, jornada_semanal } = params;
        const { data, error } = await supabase.from("funcionarios").insert({
          nome,
          cargo,
          salario: salario || 0,
          setor: setor || null,
          cpf: cpf || null,
          telefone: telefone || null,
          email: email || null,
          endereco: endereco || null,
          data_admissao: data_admissao || new Date().toISOString().split("T")[0],
          tipo_contrato: tipo_contrato || "clt",
          jornada_semanal: jornada_semanal || 44,
          ativo: true,
          unidade_id,
        }).select("id, nome, cargo").single();
        if (error) throw error;
        return `✅ Funcionário "${data.nome}" (${data.cargo}) cadastrado com sucesso (ID: ${data.id})`;
      }

      case "cadastrar_cliente": {
        const { nome, telefone, cpf, email, endereco, bairro, cidade, numero, cep, tipo } = params;
        // Get empresa_id from the unidade
        let empresa_id = null;
        if (unidade_id) {
          const { data: unidade } = await supabase.from("unidades").select("empresa_id").eq("id", unidade_id).single();
          empresa_id = unidade?.empresa_id || null;
        }
        // Normaliza telefone: remove não-dígitos e prefixo de país "55" se vier com 12-13 dígitos
        let telefoneNormalizado: string | null = null;
        if (telefone) {
          let digits = String(telefone).replace(/\D/g, "");
          // Remove DDI 55 (Brasil) quando excede o tamanho local
          if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
          else if (digits.length === 12 && digits.startsWith("55")) digits = digits.slice(2);
          // Mantém os últimos 11 (DDD + 9 dígitos) para garantir
          if (digits.length > 11) digits = digits.slice(-11);
          telefoneNormalizado = digits || null;
        }
        const { data, error } = await supabase.from("clientes").insert({
          nome,
          telefone: telefoneNormalizado,
          cpf: cpf || null,
          email: email || null,
          endereco: endereco || null,
          bairro: bairro || null,
          cidade: cidade || null,
          numero: numero || null,
          cep: cep || null,
          tipo: tipo || "residencial",
          ativo: true,
          empresa_id,
        }).select("id, nome, telefone").single();
        if (error) throw error;
        return `✅ Cliente "${data.nome}" cadastrado com sucesso (ID: ${data.id}${data.telefone ? `, Tel: ${data.telefone}` : ""})`;
      }

      case "cadastrar_fornecedor": {
        const { razao_social, nome_fantasia, cnpj, tipo, telefone, email, cidade, estado } = params;
        const { data, error } = await supabase.from("fornecedores").insert({
          razao_social,
          nome_fantasia: nome_fantasia || razao_social,
          cnpj: cnpj || null,
          tipo: tipo || "distribuidora",
          telefone: telefone || null,
          email: email || null,
          cidade: cidade || null,
          estado: estado || null,
          ativo: true,
          unidade_id,
        }).select("id, razao_social").single();
        if (error) throw error;
        return `✅ Fornecedor "${data.razao_social}" cadastrado com sucesso (ID: ${data.id})`;
      }

      case "registrar_compra": {
        const { fornecedor_id, fornecedor_nome, itens, valor_frete, numero_nota_fiscal, data_compra, observacoes } = params;

        // Find or identify fornecedor
        let fId = fornecedor_id;
        if (!fId && fornecedor_nome) {
          const { data: forn } = await supabase.from("fornecedores").select("id").ilike("razao_social", `%${fornecedor_nome}%`).limit(1).single();
          fId = forn?.id || null;
        }

        // Resolve product IDs
        const resolvedItens = [];
        let valorTotal = 0;
        for (const item of itens || []) {
          const { data: prod } = await supabase.from("produtos")
            .select("id, nome")
            .ilike("nome", `%${item.produto_nome}%`)
            .eq("unidade_id", unidade_id)
            .limit(1)
            .single();
          resolvedItens.push({
            produto_id: prod?.id || null,
            produto_nome: prod?.nome || item.produto_nome,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
          });
          valorTotal += item.quantidade * item.preco_unitario;
        }

        const { data: compra, error: compraErr } = await supabase.from("compras").insert({
          fornecedor_id: fId,
          valor_total: valorTotal + (valor_frete || 0),
          valor_frete: valor_frete || 0,
          status: "recebido",
          data_compra: data_compra || new Date().toISOString().split("T")[0],
          numero_nota_fiscal: numero_nota_fiscal || null,
          observacoes: observacoes || null,
          unidade_id,
        }).select("id").single();
        if (compraErr) throw compraErr;

        // Insert items
        for (const item of resolvedItens) {
          await supabase.from("compra_itens").insert({
            compra_id: compra.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
          });

          // Update stock
          if (item.produto_id) {
            await supabase.from("movimentacoes_estoque").insert({
              produto_id: item.produto_id,
              tipo: "entrada",
              quantidade: item.quantidade,
              observacoes: `Compra NF ${numero_nota_fiscal || compra.id.substring(0, 8)}`,
              unidade_id,
            });
            // Update product stock
            const { data: currentProd } = await supabase.from("produtos").select("estoque").eq("id", item.produto_id).single();
            if (currentProd) {
              await supabase.from("produtos").update({ estoque: (currentProd.estoque || 0) + item.quantidade }).eq("id", item.produto_id);
            }
          }
        }

        const itensStr = resolvedItens.map(i => `${i.quantidade}x ${i.produto_nome} @ R$ ${i.preco_unitario.toFixed(2)}`).join(", ");
        return `✅ Compra registrada (ID: ${compra.id.substring(0, 8)}): ${itensStr}. Total: R$ ${valorTotal.toFixed(2)}${valor_frete ? ` + Frete R$ ${valor_frete.toFixed(2)}` : ""}. Estoque atualizado.`;
      }

      case "registrar_despesa": {
        const { fornecedor, descricao, valor, vencimento, categoria, status } = params;
        const { data, error } = await supabase.from("contas_pagar").insert({
          fornecedor: fornecedor || "Não informado",
          descricao,
          valor,
          vencimento,
          categoria: categoria || "outros",
          status: status || "pendente",
          unidade_id,
        }).select("id, descricao, valor").single();
        if (error) throw error;
        return `✅ Despesa "${data.descricao}" registrada: R$ ${data.valor.toFixed(2)} (vencimento: ${vencimento}, ID: ${data.id.substring(0, 8)})`;
      }

      case "criar_pedido": {
        const { cliente_nome, cliente_telefone, itens, forma_pagamento, endereco_entrega, observacoes, troco_para } = params;

        // Find or create client
        let clienteId = null;
        if (cliente_nome) {
          const { data: cli } = await supabase.from("clientes").select("id").ilike("nome", `%${cliente_nome}%`).limit(1).single();
          clienteId = cli?.id || null;
        }

        // Resolve products and calculate total
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
          valor_total: valorTotal,
          forma_pagamento: forma_pagamento || "dinheiro",
          status: "pendente",
          canal_venda: "assistente",
          endereco_entrega: endereco_entrega || null,
          observacoes: observacoes || `Pedido via Assistente IA${cliente_nome ? ` - ${cliente_nome}` : ""}${cliente_telefone ? ` (${cliente_telefone})` : ""}`,
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
        return `✅ Pedido criado (#${pedido.id.substring(0, 8)}): ${itensStr}. Total: R$ ${valorTotal.toFixed(2)}. Status: Pendente.`;
      }

      case "atualizar_status_pedido": {
        const { pedido_id, novo_status } = params;
        const { error } = await supabase.from("pedidos").update({ status: novo_status }).eq("id", pedido_id);
        if (error) throw error;
        return `✅ Pedido ${pedido_id.substring(0, 8)} atualizado para "${novo_status}"`;
      }

      case "registrar_movimentacao_estoque": {
        const { produto_nome, tipo, quantidade, observacoes } = params;
        const { data: prod } = await supabase.from("produtos")
          .select("id, nome, estoque")
          .ilike("nome", `%${produto_nome}%`)
          .eq("unidade_id", unidade_id)
          .limit(1)
          .single();
        if (!prod) return `❌ Produto "${produto_nome}" não encontrado na unidade atual`;

        await supabase.from("movimentacoes_estoque").insert({
          produto_id: prod.id,
          tipo,
          quantidade,
          observacoes: observacoes || `${tipo} via Assistente IA`,
          unidade_id,
        });

        const novoEstoque = tipo === "entrada" ? (prod.estoque || 0) + quantidade : (prod.estoque || 0) - quantidade;
        await supabase.from("produtos").update({ estoque: Math.max(0, novoEstoque) }).eq("id", prod.id);

        return `✅ ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} de ${quantidade}x "${prod.nome}" registrada. Estoque: ${prod.estoque || 0} → ${Math.max(0, novoEstoque)}`;
      }

      case "cadastrar_veiculo": {
        const { placa, modelo, marca, ano, tipo, km_atual } = params;
        const { data, error } = await supabase.from("veiculos").insert({
          placa: placa.toUpperCase(),
          modelo,
          marca: marca || null,
          ano: ano || null,
          tipo: tipo || "caminhonete",
          status: "disponivel",
          km_atual: km_atual || 0,
          unidade_id,
        }).select("id, placa, modelo").single();
        if (error) throw error;
        return `✅ Veículo "${data.modelo}" (${data.placa}) cadastrado com sucesso (ID: ${data.id.substring(0, 8)})`;
      }

      case "registrar_manutencao": {
        const { veiculo_placa, tipo, descricao, valor, data, km, oficina } = params;
        let veiculoId = null;
        if (veiculo_placa) {
          const { data: vei } = await supabase.from("veiculos").select("id").ilike("placa", `%${veiculo_placa}%`).limit(1).single();
          veiculoId = vei?.id || null;
        }
        const { data: man, error } = await supabase.from("manutencoes").insert({
          veiculo_id: veiculoId,
          tipo: tipo || "corretiva",
          descricao,
          valor,
          data: data || new Date().toISOString().split("T")[0],
          status: "pendente",
          km: km || null,
          oficina: oficina || null,
          unidade_id,
        }).select("id").single();
        if (error) throw error;
        return `✅ Manutenção registrada (ID: ${man.id.substring(0, 8)}): ${descricao} — R$ ${valor.toFixed(2)}`;
      }

      case "registrar_conta_receber": {
        const { cliente, descricao, valor, vencimento, forma_pagamento } = params;
        const { data, error } = await supabase.from("contas_receber").insert({
          cliente,
          descricao,
          valor,
          vencimento,
          status: "pendente",
          forma_pagamento: forma_pagamento || null,
          unidade_id,
        }).select("id").single();
        if (error) throw error;
        return `✅ Conta a receber registrada: "${descricao}" — R$ ${valor.toFixed(2)} de ${cliente} (venc: ${vencimento})`;
      }

      case "atualizar_preco_produto": {
        const { produto_nome, novo_preco } = params;
        const { data: prod } = await supabase.from("produtos")
          .select("id, nome, preco")
          .ilike("nome", `%${produto_nome}%`)
          .eq("unidade_id", unidade_id)
          .limit(1)
          .single();
        if (!prod) return `❌ Produto "${produto_nome}" não encontrado na unidade atual`;
        const precoAntigo = prod.preco;
        await supabase.from("produtos").update({ preco: novo_preco }).eq("id", prod.id);
        return `✅ Preço de "${prod.nome}" atualizado: R$ ${precoAntigo?.toFixed(2)} → R$ ${novo_preco.toFixed(2)}`;
      }

      default:
        return `❌ Ação "${action}" não reconhecida`;
    }
  } catch (e) {
    console.error(`Action error [${action}]:`, e);
    return `❌ Erro ao executar "${action}": ${e instanceof Error ? e.message : "erro desconhecido"}`;
  }
}
