import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
- produtos: id, nome, preco, estoque, categoria (gas/agua/acessorio/vasilhame/outro), tipo_botijao (cheio/vazio/null), ativo, codigo_barras, unidade_medida, peso, tipo (revenda/producao/insumo), estoque_minimo, preco_custo, unidade_id, descricao
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
          nome: {
            type: "string",
            description:
              "Nome do produto (ex: Gás P13, Água 20L, Mangueira 1.5m)",
          },
          preco: { type: "number", description: "Preço de venda" },
          categoria: {
            type: "string",
            enum: ["gas", "agua", "acessorio", "vasilhame", "outro"],
            description: "Categoria do produto",
          },
          tipo_botijao: {
            type: "string",
            enum: ["cheio", "vazio"],
            description: "Tipo do botijão (apenas para gas/agua/vasilhame)",
          },
          estoque: {
            type: "number",
            description: "Quantidade inicial em estoque",
          },
          custo: { type: "number", description: "Preço de custo" },
          estoque_minimo: {
            type: "number",
            description: "Estoque mínimo para alerta",
          },
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
          cargo: {
            type: "string",
            description: "Cargo (ex: Entregador, Atendente, Gerente)",
          },
          salario: { type: "number", description: "Salário mensal" },
          setor: {
            type: "string",
            description: "Setor (ex: Entregas, Administrativo, Vendas)",
          },
          cpf: { type: "string", description: "CPF do funcionário" },
          telefone: { type: "string", description: "Telefone" },
          email: { type: "string", description: "Email" },
          endereco: { type: "string", description: "Endereço completo" },
          data_admissao: {
            type: "string",
            description: "Data de admissão (YYYY-MM-DD)",
          },
          tipo_contrato: {
            type: "string",
            enum: ["clt", "pj", "temporario", "estagio"],
            description: "Tipo de contrato",
          },
          jornada_semanal: {
            type: "number",
            description: "Horas semanais de trabalho",
          },
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
          tipo: {
            type: "string",
            enum: ["residencial", "comercial", "industrial", "condominio"],
            description: "Tipo de cliente",
          },
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
          tipo: {
            type: "string",
            description:
              "Tipo (ex: distribuidora, fabricante, prestador_servico)",
          },
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
      description:
        "Registra uma compra de mercadoria (entrada de estoque). Cria a compra e seus itens.",
      parameters: {
        type: "object",
        properties: {
          fornecedor_id: {
            type: "string",
            description: "ID do fornecedor (buscar antes se necessário)",
          },
          fornecedor_nome: {
            type: "string",
            description: "Nome do fornecedor (para buscar ou criar)",
          },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                produto_nome: {
                  type: "string",
                  description: "Nome do produto",
                },
                quantidade: { type: "number" },
                preco_unitario: { type: "number" },
              },
              required: ["produto_nome", "quantidade", "preco_unitario"],
            },
            description: "Itens da compra",
          },
          valor_frete: { type: "number", description: "Valor do frete" },
          situacao_pagamento: {
            type: "string",
            enum: ["avista", "aprazo"],
            description: "Se a compra será paga à vista ou a prazo",
          },
          forma_pagamento: {
            type: "string",
            enum: [
              "dinheiro",
              "pix",
              "ted",
              "debito",
              "credito",
              "boleto",
              "cheque",
              "vale_central_gas",
              "vale_ultragaz",
              "a_prazo",
            ],
            description: "Forma usada no pagamento da compra",
          },
          conta_bancaria_nome: {
            type: "string",
            description:
              "Nome do banco/conta de origem para pagamentos bancários",
          },
          data_vencimento: {
            type: "string",
            description: "Vencimento quando a compra for a prazo (YYYY-MM-DD)",
          },
          parcelas: {
            type: "number",
            description: "Quantidade de parcelas para cartão de crédito",
          },
          numero_cheque: { type: "string", description: "Número do cheque" },
          banco_cheque: { type: "string", description: "Banco do cheque" },
          numero_nota_fiscal: {
            type: "string",
            description: "Número da nota fiscal",
          },
          data_compra: {
            type: "string",
            description: "Data da compra (YYYY-MM-DD)",
          },
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
          fornecedor: {
            type: "string",
            description: "Nome do fornecedor ou beneficiário",
          },
          descricao: { type: "string", description: "Descrição da despesa" },
          valor: { type: "number", description: "Valor da despesa" },
          vencimento: {
            type: "string",
            description: "Data de vencimento (YYYY-MM-DD)",
          },
          categoria: {
            type: "string",
            description:
              "Categoria (ex: aluguel, energia, agua, combustivel, manutencao, salarios, outros)",
          },
          status: {
            type: "string",
            enum: ["pendente", "pago"],
            description: "Status do pagamento",
          },
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
      description:
        "Cria um novo pedido de venda. Pode ser imediato ou agendado para data/hora futura (use data_entrega e hora_entrega). Sempre tente localizar o cliente cadastrado pelo nome ou telefone informado.",
      parameters: {
        type: "object",
        properties: {
          cliente_id: {
            type: "string",
            description: "UUID do cliente já identificado (opcional)",
          },
          cliente_nome: {
            type: "string",
            description:
              "Nome do cliente (usado para busca se cliente_id ausente)",
          },
          cliente_telefone: {
            type: "string",
            description: "Telefone do cliente (usado para busca)",
          },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                produto_nome: {
                  type: "string",
                  description:
                    "Nome do produto (ex: 'Gás P13', 'Gás P20', 'Água 20L')",
                },
                quantidade: { type: "number" },
              },
              required: ["produto_nome", "quantidade"],
            },
          },
          forma_pagamento: {
            type: "string",
            enum: [
              "dinheiro",
              "pix",
              "pix_maquininha",
              "cartao_credito",
              "cartao_debito",
              "fiado",
              "boleto",
              "cheque",
              "venda_antecipada",
              "gas_do_povo",
            ],
          },
          endereco_entrega: {
            type: "string",
            description:
              "Endereço de entrega (se vazio, usa endereço cadastrado do cliente)",
          },
          ja_entregue: {
            type: "boolean",
            description:
              "True somente quando o usuário informar que o pedido já foi entregue",
          },
          tipo_entrega: {
            type: "string",
            enum: ["entregador", "portaria"],
            description:
              "Quem realizou a entrega. Portaria também representa balcão/retirada",
          },
          entregador_nome: {
            type: "string",
            description:
              "Nome do entregador quando ja_entregue=true e tipo_entrega=entregador",
          },
          data_entrega: {
            type: "string",
            description:
              "Data agendada da entrega no formato YYYY-MM-DD (opcional). Use sempre que o usuário pedir 'amanhã', 'dia X', 'sexta', etc.",
          },
          hora_entrega: {
            type: "string",
            description:
              "Hora agendada no formato HH:MM (opcional, default 08:00)",
          },
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
      name: "atualizar_status_pedido",
      description: "Atualiza o status de um pedido existente",
      parameters: {
        type: "object",
        properties: {
          pedido_id: { type: "string", description: "ID do pedido" },
          novo_status: {
            type: "string",
            enum: [
              "pendente",
              "em_preparo",
              "saiu_entrega",
              "entregue",
              "cancelado",
            ],
          },
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
          tipo: {
            type: "string",
            enum: ["entrada", "saida", "avaria"],
            description: "Tipo de movimentação",
          },
          quantidade: { type: "number", description: "Quantidade" },
          observacoes: {
            type: "string",
            description: "Motivo/observações da movimentação",
          },
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
          tipo: {
            type: "string",
            description: "Tipo (ex: moto, caminhonete, caminhao, van)",
          },
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
          tipo: {
            type: "string",
            description: "Tipo de manutenção (preventiva/corretiva)",
          },
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
          vencimento: {
            type: "string",
            description: "Data de vencimento (YYYY-MM-DD)",
          },
          forma_pagamento: {
            type: "string",
            description: "Forma de pagamento esperada",
          },
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
    const { messages, unidade_id, pending_actions, action_confirmation } =
      await req.json();
    const unidadeId = unidade_id ? String(unidade_id) : null;

    // Validate unidade_id as UUID to prevent prompt/SQL injection
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (unidadeId && !UUID_RE.test(unidadeId)) {
      return new Response(JSON.stringify({ error: "unidade_id inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!unidadeId) {
      return new Response(
        JSON.stringify({
          error: "Selecione uma unidade para usar o Assistente IA.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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
    const { data: userData, error: userErr } =
      await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require a privileged role to use the AI assistant (it can read all tenant data
    // and perform mutations via the service role key).
    const allowedRoles = ["admin", "gestor", "super_admin"];
    const { data: roleRows } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const hasAllowedRole = (roleRows || []).some((r: any) =>
      allowedRoles.includes(r.role),
    );
    const isSuperAdmin = (roleRows || []).some(
      (r: any) => r.role === "super_admin",
    );
    if (!hasAllowedRole) {
      return new Response(
        JSON.stringify({
          error: "Acesso negado: requer perfil administrativo.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: profile, error: profileError } = await callerClient
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (profileError || (!isSuperAdmin && !profile?.empresa_id)) {
      return new Response(
        JSON.stringify({ error: "Perfil sem empresa vinculada." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify unidade_id belongs to the caller's empresa (tenant isolation)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    let unidadeQuery = adminClient
      .from("unidades")
      .select("id, nome, empresa_id")
      .eq("id", unidadeId);
    if (!isSuperAdmin)
      unidadeQuery = unidadeQuery.eq("empresa_id", profile!.empresa_id);
    const { data: unidadeAutorizada } = await unidadeQuery.maybeSingle();
    if (!unidadeAutorizada) {
      return new Response(
        JSON.stringify({ error: "Acesso negado a essa unidade." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const empresaId =
      unidadeAutorizada.empresa_id || profile?.empresa_id || null;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // Detect if it's a conversational message (no SQL or action needed)
    const isConversational =
      /^(ol[áa]|oi|bom dia|boa tarde|boa noite|tudo bem|obrigad|valeu|tchau|ajuda|o que voc[êe]|quem [ée] voc[êe])/i.test(
        lastUserMessage.trim(),
      );

    let queryData: any[] | null = null;
    let queryError: string | null = null;
    let queryDescription = "";
    let actionResults: string[] = [];
    let pendingActions: Array<{
      action: string;
      params: Record<string, unknown>;
      preview: string;
    }> = [];
    const wantsFinancialSummary = isFinancialSummaryIntent(lastUserMessage);
    const wantsTodaySales = isTodaySalesIntent(lastUserMessage);
    const safeQuery = wantsTodaySales
      ? null
      : buildSafeQuery(lastUserMessage, unidadeId);
    const hasConfirmedPendingActions =
      Array.isArray(pending_actions) &&
      pending_actions.length > 0 &&
      (action_confirmation === "confirm" || isActionConfirmed(lastUserMessage));

    if (hasConfirmedPendingActions) {
      for (const pending of pending_actions) {
        if (!pending?.action || typeof pending.action !== "string") continue;
        const result = await executeAction(
          supabase,
          pending.action,
          pending.params || {},
          unidadeId,
          empresaId,
          lastUserMessage,
        );
        await logAiAction(supabase, {
          user_id: userData.user.id,
          empresa_id: empresaId,
          unidade_id: unidadeId,
          action: pending.action,
          params: pending.params || {},
          result,
          success: !/^(\s*)?(❌|Acao rejeitada|Erro)/i.test(result),
        });
        actionResults.push(result);
      }
    }

    if (wantsFinancialSummary && !hasConfirmedPendingActions) {
      try {
        queryData = [await getFinancialSummary(supabase, unidadeId)];
        queryDescription = "Resumo financeiro real do mês atual";
      } catch (e) {
        queryError =
          e instanceof Error
            ? e.message
            : "Erro ao calcular o resumo financeiro";
      }
    } else if (wantsTodaySales && !hasConfirmedPendingActions) {
      try {
        queryData = [await getTodaySalesSummary(supabase, unidadeId)];
        queryDescription = "Resumo de vendas de hoje";
      } catch (e) {
        queryError =
          e instanceof Error ? e.message : "Erro ao consultar vendas de hoje";
      }
    } else if (safeQuery && !hasConfirmedPendingActions) {
      try {
        const { data, error } = await supabase.rpc("execute_readonly_query", {
          query_text: safeQuery.sql.trim(),
        });
        if (error) {
          console.error("safeQuery rpc error", error);
          queryError = error.message;
        } else {
          queryData = data;
          queryDescription = safeQuery.description;
        }
      } catch (e) {
        queryError =
          e instanceof Error ? e.message : "Erro ao executar consulta";
      }
    } else if (!isConversational && !hasConfirmedPendingActions) {
      // Step 1: Determine intent — SQL query vs action vs both
      const intentResponse = await callAI(
        LOVABLE_API_KEY,
        [
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
- Use ferramentas de ação somente quando o usuário pedir explicitamente cadastro, registro ou atualização.
- Se o usuário está perguntando sobre algo (ex: "quanto custa o P13?"), use SQL para consultar.
- A unidade atual já está selecionada: "${unidadeAutorizada.nome}" (${unidadeId}). Nunca pergunte qual é a unidade.
- Ao criar pedido, só chame criar_pedido depois de saber: cliente, itens/quantidades, forma de pagamento e se já foi entregue.
- Se já foi entregue, também saiba se foi por entregador (e qual) ou por portaria/balcão. Se faltar algum desses dados, faça uma pergunta objetiva e não chame a ferramenta ainda.
- Ao registrar compra, obtenha fornecedor, produtos, quantidades, preço unitário, pagamento à vista/a prazo e forma de pagamento. Para prazo, obtenha vencimento; para banco/cartão, obtenha a conta; para crédito, parcelas; para cheque, número e banco. Se faltar algo, faça uma pergunta objetiva e não invente.
- Para qualquer ação, conduza uma conversa curta até reunir os dados necessários. Nunca presuma valores ou informações financeiras.
Filtre por unidade_id = '${unidadeId}' quando a tabela tiver essa coluna.
Use timezone 'America/Sao_Paulo' para datas. Use NOW() para data atual.
Limite resultados a no máximo 50 linhas.
Para "hoje": created_at::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
Para "este mês": date_trunc('month', created_at AT TIME ZONE 'America/Sao_Paulo') = date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')

${TABLES_SCHEMA}`,
          },
          ...messages,
        ],
        [
          {
            type: "function",
            function: {
              name: "generate_sql",
              description:
                "Gera uma query SQL SELECT para consultar dados do sistema",
              parameters: {
                type: "object",
                properties: {
                  sql: { type: "string", description: "Query SQL SELECT" },
                  description: {
                    type: "string",
                    description: "Descrição da consulta",
                  },
                  chart_type: {
                    type: "string",
                    enum: ["bar", "line", "pie", "area", "none"],
                  },
                },
                required: ["sql", "description", "chart_type"],
                additionalProperties: false,
              },
            },
          },
          ...ACTION_TOOLS,
        ],
      );

      if (!intentResponse.ok) {
        const status = intentResponse.status;
        await intentResponse.text();
        if (status === 429) {
          return errResponse(
            429,
            "Muitas requisições. Tente novamente em alguns segundos.",
            corsHeaders,
          );
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
          if (sqlQuery !== "NO_SQL") {
            // SECURITY: enforce tenant scoping — the AI-generated SQL MUST reference
            // the validated unidade_id (which we already confirmed belongs to user's empresa).
            // This prevents prompt-injection from leaking cross-tenant data.
            const validationError = validateGeneratedSql(sqlQuery, unidadeId);
            if (validationError) {
              queryError = "Consulta rejeitada: filtro de unidade obrigatório.";
            } else {
              try {
                const { data, error } = await supabase.rpc(
                  "execute_readonly_query",
                  { query_text: sqlQuery.trim() },
                );
                if (error) {
                  queryError = error.message;
                } else {
                  queryData = data;
                }
              } catch (e) {
                queryError =
                  e instanceof Error ? e.message : "Erro ao executar consulta";
              }

              if (
                queryData &&
                chartType !== "none" &&
                Array.isArray(queryData) &&
                queryData.length > 0
              ) {
                queryDescription += `\n\n[CHART_META]${JSON.stringify({ type: chartType, data: queryData })}[/CHART_META]`;
              }
            }
          }
        } else {
          if (!isActionConfirmed(lastUserMessage)) {
            const prepared =
              fnName === "criar_pedido"
                ? await prepareOrderAction(supabase, args, unidadeId, empresaId)
                : fnName === "registrar_compra"
                  ? await preparePurchaseAction(supabase, args, unidadeId)
                  : {
                      params: args,
                      preview: formatActionPreview(fnName, args),
                    };
            if ("question" in prepared)
              return streamTextResponse(prepared.question, corsHeaders);
            pendingActions.push({
              action: fnName,
              params: prepared.params,
              preview: prepared.preview,
            });
            continue;
          }

          // Execute action
          const result = await executeAction(
            supabase,
            fnName,
            args,
            unidadeId,
            empresaId,
            lastUserMessage,
          );
          await logAiAction(supabase, {
            user_id: userData.user.id,
            empresa_id: empresaId,
            unidade_id: unidadeId,
            action: fnName,
            params: args,
            result,
            success: !/^(\s*)?(❌|Acao rejeitada|Erro)/i.test(result),
          });
          actionResults.push(result);
        }
      }
    }

    if (pendingActions.length > 0) {
      const content = `Revise antes de executar. Nenhuma ação foi gravada ainda.\n\n${pendingActions.map((p) => p.preview).join("\n")}\n\nConfirme somente se os dados estiverem corretos.\n\n[PENDING_ACTIONS]${JSON.stringify(pendingActions)}[/PENDING_ACTIONS]`;
      return streamTextResponse(content, corsHeaders);
    }

    // Built-in operational queries are already validated and executed above.
    // Answer them deterministically so the language model cannot ask for a
    // second, unnecessary confirmation after the data has been loaded.
    if (!queryError && !hasConfirmedPendingActions) {
      const directAnswer = formatDirectQueryAnswer(queryDescription, queryData);
      if (directAnswer) return streamTextResponse(directAnswer, corsHeaders);
    }

    // Step 2: Generate final natural language response
    const now = new Date();
    const brHour = parseInt(
      now.toLocaleString("en-US", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        hour12: false,
      }),
    );
    const dayOfWeek = now.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
    });
    const dayOfMonth = parseInt(
      now.toLocaleString("en-US", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
      }),
    );

    let timeContext = "";
    if (brHour < 12)
      timeContext =
        "É manhã — bom momento para verificar pedidos pendentes e estoque.";
    else if (brHour < 18)
      timeContext = "É tarde — período de maior movimento de entregas.";
    else
      timeContext = "É noite — bom momento para verificar o fechamento do dia.";
    if (dayOfMonth >= 25)
      timeContext +=
        " Fim do mês — considere verificar contas a pagar/receber e folha.";

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
    if (pendingActions.length > 0) {
      dataContext += `\n\nAcoes pendentes de confirmacao, ainda NAO executadas:\n${pendingActions.map((p) => p.preview).join("\n")}\n\nPeca ao usuario para revisar e responder se deseja confirmar ou cancelar.`;
    }
    if (!dataContext) {
      dataContext = "\nNenhuma consulta ou ação foi necessária.";
    }

    const actionsList = ACTION_TOOLS.map(
      (t) => `- ${t.function.name}: ${t.function.description}`,
    ).join("\n");

    const finalResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
Unidade atual já selecionada: ${unidadeAutorizada.nome} (${unidadeId}). Nunca peça ao usuário para informar a unidade.

Ações disponíveis:
${actionsList}

REGRAS ANTI-ALUCINAÇÃO (obrigatórias):
- Consultas de leitura nunca exigem confirmação. Se o resultado da consulta estiver disponível, responda imediatamente com esses dados.
- Peça confirmação somente antes de ações que cadastram, alteram, liquidam ou excluem informações.
- NUNCA invente números, valores, quantidades, horários, nomes de clientes, produtos ou datas. Só cite o que estiver em "Resultado da consulta" abaixo.
- Se não houver dados na consulta (ou aparecer "Nenhuma consulta ou ação foi necessária"), diga explicitamente que não consultou / não há dados e ofereça consultar. Não estime, não arredonde, não presuma.
- Se a consulta retornou vazio ou zero, informe "0" ou "nenhum registro" — não substitua por valores plausíveis.
- Nunca cite horário de funcionamento, políticas ou regras de negócio que não estejam nos dados retornados.
- Se o usuário pedir algo que exigiria dados que você não consultou, diga que precisa consultar antes de responder.

Formatação:
- Use markdown quando ajudar (tabelas, negrito, listas).
- Formate valores como R$ X.XXX,XX.
- Se não houver dados, informe de forma clara.
- Ao executar ações, confirme o que foi feito.
- Para criar pedidos: SEMPRE chame a tool criar_pedido. Quando o usuário disser "amanhã", "sexta", "dia X", "às 8h", calcule a data exata (data_entrega = YYYY-MM-DD) e hora (hora_entrega = HH:MM) e passe nos parâmetros — não invente que está agendado sem usar a tool.
- Antes de criar pedido, confirme cliente, itens e quantidades, forma de pagamento, se já foi entregue e, quando entregue, quem realizou a entrega. Nunca presuma pagamento, entrega ou entregador.
- Para registrar compras, confirme fornecedor, cada produto, quantidade, preço unitário, total, situação à vista/a prazo e forma de pagamento. Solicite vencimento, conta bancária, parcelas ou cheque quando aplicável. A confirmação precisa mostrar o preço médio unitário e o valor total.
- Sempre tente identificar o cliente pelo nome OU telefone informado. Se não houver cadastro, crie o pedido mesmo assim (a tool aceita cliente não-cadastrado).
- Interprete nomes de produtos com flexibilidade: "p13"/"P13" = Gás P13, "p20" = Gás P20, "p45" = Gás P45, "água" = Água 20L.
- Se houver acoes pendentes de confirmacao no contexto, diga claramente que nada foi executado ainda e peca confirmacao.
- Mantenha o bloco [CHART_META]...[/CHART_META] na resposta quando presente.

Contexto: Hoje é ${dayOfWeek}, ${now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. ${timeContext}${sundayContext}

Na primeira mensagem, cumprimente brevemente e ofereça ajuda.
${dataContext}`,
            },
            ...messages,
          ],
          stream: true,
        }),
      },
    );

    if (!finalResponse.ok) {
      const status = finalResponse.status;
      await finalResponse.text();
      if (status === 429)
        return errResponse(
          429,
          "Muitas requisições. Tente novamente.",
          corsHeaders,
        );
      if (status === 402)
        return errResponse(402, "Créditos de IA esgotados.", corsHeaders);
      throw new Error("Falha ao gerar resposta");
    }

    return new Response(finalResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function errResponse(
  status: number,
  error: string,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function streamTextResponse(
  content: string,
  corsHeaders: Record<string, string>,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

function formatMoney(value: unknown): string {
  const number = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(number) ? number : 0);
}

function formatDirectQueryAnswer(
  description: string,
  data: any[] | null,
): string | null {
  if (!description || !Array.isArray(data)) return null;

  if (description === "Resumo de vendas de hoje") {
    const row = data[0] || {};
    const pedidos = Number(row.pedidos || 0);
    return `Até agora, o faturamento de hoje é **${formatMoney(row.faturamento)}**, em **${pedidos} ${pedidos === 1 ? "pedido" : "pedidos"}**. Ticket médio: **${formatMoney(row.ticket_medio)}**.`;
  }

  if (description === "Resumo financeiro real do mês atual") {
    const row = data[0] || {};
    let answer = `No mês atual, a receita é **${formatMoney(row.receita)}**, com **${Number(row.pedidos || 0)} pedidos**. O custo das mercadorias vendidas é **${formatMoney(row.custo_mercadorias)}**, as despesas somam **${formatMoney(row.despesas)}** e o lucro líquido operacional é **${formatMoney(row.lucro_liquido_operacional)}**.`;
    if (Number(row.custos_de_produtos_ausentes || 0) > 0) {
      answer += ` Atenção: há **${Number(row.custos_de_produtos_ausentes)} item(ns)** sem preço de custo cadastrado, então o lucro pode estar superestimado.`;
    }
    return answer;
  }

  if (description === "Produtos com estoque baixo") {
    if (data.length === 0)
      return "Não há produtos com estoque baixo nesta unidade.";
    const rows = data
      .slice(0, 20)
      .map(
        (row) =>
          `- **${row.nome || "Produto"}**: ${Number(row.estoque || 0)} em estoque; mínimo ${Number(row.estoque_minimo || 0)}`,
      )
      .join("\n");
    return `Encontrei **${data.length} produto(s)** com estoque baixo:\n\n${rows}`;
  }

  if (description === "Contas vencidas a pagar e a receber") {
    if (data.length === 0)
      return "Não há contas vencidas a pagar ou a receber nesta unidade.";
    const rows = data
      .slice(0, 30)
      .map(
        (row) =>
          `- **${row.tipo === "pagar" ? "A pagar" : "A receber"}** — ${row.pessoa || row.descricao || "Sem identificação"}: ${formatMoney(row.valor)}, vencimento ${row.vencimento || "não informado"}`,
      )
      .join("\n");
    return `Encontrei **${data.length} conta(s) vencida(s)**:\n\n${rows}`;
  }

  return null;
}

function isActionConfirmed(message: string): boolean {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /\b(confirmo|confirmar|pode executar|pode cadastrar|pode registrar|pode atualizar|sim pode|sim confirme|autorizo|execute)\b/.test(
    normalized,
  );
}

function formatActionPreview(
  action: string,
  params: Record<string, unknown>,
): string {
  const entries = Object.entries(params)
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    )
    .slice(0, 8)
    .map(
      ([key, value]) =>
        `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`,
    );
  return `- ${action}${entries.length ? ` (${entries.join(", ")})` : ""}`;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isFinancialSummaryIntent(message: string): boolean {
  const text = normalizeText(message);
  const metric =
    /\b(lucro|despesas?|custos?|preco medio|ticket medio|margem|resultado)\b/.test(
      text,
    );
  const productNamed = /\b(p13|p20|p45|agua|botijao|produto)\b/.test(text);
  // Períodos diferentes do mês atual precisam de consulta dinâmica (SQL),
  // pois o resumo financeiro é sempre do mês corrente.
  const outroPeriodo =
    /\b(ontem|anteontem|passad[oa]s?|anterior|semana|trimestre|semestre|ano|20\d{2}|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|entre|desde|ate|periodo|ultimos?|ultimas?)\b/.test(
      text,
    ) || /\d{1,2}\/\d{1,2}/.test(text);
  if (outroPeriodo) return false;
  return (
    metric &&
    (!productNamed || /\b(mes|mensal|atual|este|deste|hoje)\b/.test(text))
  );
}

async function getFinancialSummary(supabase: any, unidadeId: string) {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
  const startIso = `${startDate}T00:00:00-03:00`;
  const nextIso = `${nextDate}T00:00:00-03:00`;

  const [ordersRes, purchasesRes, cashRes, bankRes, payableRes, accountingRes] =
    await Promise.all([
      supabase
        .from("pedidos")
        .select("id, valor_total, status, data_entrega, created_at")
        .eq("unidade_id", unidadeId)
        .in("status", ["entregue", "finalizado", "pago", "pago_cartao"])
        .or(
          `and(data_entrega.gte.${startDate},data_entrega.lt.${nextDate}),and(data_entrega.is.null,created_at.gte.${startIso},created_at.lt.${nextIso})`,
        ),
      supabase
        .from("compras")
        .select("id,status")
        .eq("unidade_id", unidadeId)
        .gte("data_compra", startDate)
        .lt("data_compra", nextDate),
      supabase
        .from("movimentacoes_caixa")
        .select("valor")
        .eq("unidade_id", unidadeId)
        .eq("tipo", "saida")
        .or("status.is.null,status.neq.rejeitada")
        .is("compra_id", null)
        .is("pedido_id", null)
        .gte("created_at", startIso)
        .lt("created_at", nextIso),
      supabase
        .from("movimentacoes_bancarias")
        .select("valor")
        .eq("unidade_id", unidadeId)
        .eq("tipo", "saida")
        .or("referencia_tipo.is.null,referencia_tipo.neq.compra")
        .or("categoria.is.null,categoria.neq.compras")
        .gte("data", startDate)
        .lt("data", nextDate),
      supabase
        .from("contas_pagar")
        .select("valor")
        .eq("unidade_id", unidadeId)
        .is("compra_id", null)
        .or("categoria.is.null,categoria.neq.compras")
        .in("status", ["paga", "pago"])
        .gte("data_pagamento", startDate)
        .lt("data_pagamento", nextDate),
      supabase
        .from("despesas_contabeis")
        .select("valor")
        .eq("unidade_id", unidadeId)
        .gte("data_despesa", startDate)
        .lt("data_despesa", nextDate),
    ]);
  if (ordersRes.error)
    throw new Error(`Falha ao carregar vendas: ${ordersRes.error.message}`);

  const orders = ordersRes.data || [];
  const orderIds = orders.map((row: any) => row.id);
  let items: any[] = [];
  let purchaseItems: any[] = [];
  if (orderIds.length) {
    const { data, error } = await supabase
      .from("pedido_itens")
      .select("produto_id, quantidade, preco_unitario, produtos(preco_custo)")
      .in("pedido_id", orderIds);
    if (error)
      throw new Error(`Falha ao carregar itens vendidos: ${error.message}`);
    items = data || [];
  }
  const purchaseIds = (purchasesRes.data || [])
    .filter(
      (row: any) =>
        !["cancelada", "cancelado", "rejeitada", "rejeitado"].includes(
          normalizeText(String(row.status || "")),
        ),
    )
    .map((row: any) => row.id);
  if (purchaseIds.length) {
    const { data, error } = await supabase
      .from("compra_itens")
      .select("produto_id,quantidade,preco_unitario,produtos(nome)")
      .in("compra_id", purchaseIds);
    if (error)
      throw new Error(`Falha ao carregar itens comprados: ${error.message}`);
    purchaseItems = data || [];
  }

  const sum = (rows: any[] | null) =>
    (rows || []).reduce((total, row) => total + Number(row.valor || 0), 0);
  const receita = orders.reduce(
    (total: number, row: any) => total + Number(row.valor_total || 0),
    0,
  );
  const unidadesVendidas = items.reduce(
    (total: number, row: any) => total + Number(row.quantidade || 0),
    0,
  );
  const receitaItens = items.reduce(
    (total: number, row: any) =>
      total + Number(row.quantidade || 0) * Number(row.preco_unitario || 0),
    0,
  );
  const despesas =
    sum(cashRes.data) +
    sum(bankRes.data) +
    sum(payableRes.data) +
    sum(accountingRes.data);
  const purchaseAverageMap = new Map<
    string,
    { produto: string; quantidade: number; total: number }
  >();
  purchaseItems.forEach((row: any) => {
    if (!row.produto_id) return;
    const current = purchaseAverageMap.get(row.produto_id) || {
      produto: row.produtos?.nome || "Produto",
      quantidade: 0,
      total: 0,
    };
    current.quantidade += Number(row.quantidade || 0);
    current.total +=
      Number(row.quantidade || 0) * Number(row.preco_unitario || 0);
    purchaseAverageMap.set(row.produto_id, current);
  });
  const custoUnitario = (row: any) => {
    const purchase = row.produto_id
      ? purchaseAverageMap.get(row.produto_id)
      : null;
    return purchase?.quantidade
      ? purchase.total / purchase.quantidade
      : Number(row.produtos?.preco_custo || 0);
  };
  const custoMercadorias = items.reduce(
    (total: number, row: any) =>
      total + Number(row.quantidade || 0) * custoUnitario(row),
    0,
  );
  const custosAusentes = items.filter(
    (row: any) =>
      !purchaseAverageMap.has(row.produto_id) &&
      row.produtos?.preco_custo == null,
  ).length;
  const precosMediosCompra = Array.from(purchaseAverageMap.values()).map(
    (row) => ({
      produto: row.produto,
      quantidade_comprada: row.quantidade,
      preco_medio_compra: Number(
        (row.quantidade ? row.total / row.quantidade : 0).toFixed(2),
      ),
    }),
  );

  return {
    periodo: startDate.slice(0, 7),
    pedidos: orders.length,
    unidades_vendidas: unidadesVendidas,
    receita: Number(receita.toFixed(2)),
    custo_mercadorias: Number(custoMercadorias.toFixed(2)),
    despesas: Number(despesas.toFixed(2)),
    lucro_bruto: Number((receita - custoMercadorias).toFixed(2)),
    lucro_liquido_operacional: Number(
      (receita - custoMercadorias - despesas).toFixed(2),
    ),
    preco_medio_venda_por_item: Number(
      (unidadesVendidas ? receitaItens / unidadesVendidas : 0).toFixed(2),
    ),
    ticket_medio_por_pedido: Number(
      (orders.length ? receita / orders.length : 0).toFixed(2),
    ),
    precos_medios_compra_no_mes: precosMediosCompra,
    custos_de_produtos_ausentes: custosAusentes,
    observacao: custosAusentes
      ? "O lucro pode estar superestimado porque há itens sem preço de custo cadastrado."
      : null,
  };
}

async function prepareOrderAction(
  supabase: any,
  original: any,
  unidadeId: string,
  empresaId: string | null,
): Promise<any> {
  const params = { ...original };
  if (!params.cliente_id && !params.cliente_nome && !params.cliente_telefone) {
    return {
      question:
        "Para qual cliente devo lançar o pedido? Informe o nome ou telefone.",
    };
  }
  if (!Array.isArray(params.itens) || params.itens.length === 0) {
    return { question: "Quais produtos e quantidades devo lançar?" };
  }
  if (!params.forma_pagamento) {
    return { question: "Qual foi a forma de pagamento?" };
  }
  if (typeof params.ja_entregue !== "boolean") {
    return { question: "Esse pedido já foi entregue?" };
  }
  if (params.ja_entregue && !params.tipo_entrega) {
    return {
      question:
        "A entrega foi feita por um entregador ou foi retirada/entregue pela portaria?",
    };
  }
  if (
    params.ja_entregue &&
    params.tipo_entrega === "entregador" &&
    !params.entregador_nome
  ) {
    return { question: "Qual entregador realizou a entrega?" };
  }

  let client: any = null;
  if (params.cliente_id) {
    const { data } = await supabase
      .from("clientes")
      .select("id,nome,telefone,endereco,numero,bairro")
      .eq("id", params.cliente_id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    client = data;
  } else if (params.cliente_telefone) {
    const digits = String(params.cliente_telefone).replace(/\D/g, "");
    const { data } = await supabase
      .from("clientes")
      .select("id,nome,telefone,endereco,numero,bairro")
      .eq("empresa_id", empresaId)
      .ilike("telefone", `%${digits.slice(-8)}%`)
      .limit(2);
    if ((data || []).length === 1) client = data[0];
  } else {
    const { data } = await supabase
      .from("clientes")
      .select("id,nome,telefone,endereco,numero,bairro")
      .eq("empresa_id", empresaId)
      .ilike("nome", `%${params.cliente_nome}%`)
      .limit(5);
    if ((data || []).length === 1) client = data[0];
    else if ((data || []).length > 1 && params.endereco_entrega) {
      const wanted = normalizeText(params.endereco_entrega);
      client =
        data.find((row: any) =>
          wanted.includes(
            normalizeText(`${row.endereco || ""} ${row.numero || ""}`),
          ),
        ) || null;
    }
    if (!client && (data || []).length > 1) {
      const choices = data
        .map(
          (row: any) =>
            `${row.nome} — ${[row.endereco, row.numero, row.bairro].filter(Boolean).join(", ")}`,
        )
        .join("; ");
      return {
        question: `Encontrei mais de um cliente parecido. Qual deles é o correto? ${choices}`,
      };
    }
  }
  if (!client)
    return {
      question: `Não encontrei o cliente "${params.cliente_nome || params.cliente_telefone}". Confirme o nome/telefone ou cadastre o cliente antes de lançar.`,
    };
  params.cliente_id = client.id;
  params.cliente_nome = client.nome;
  params.endereco_entrega ||= [client.endereco, client.numero, client.bairro]
    .filter(Boolean)
    .join(", ");

  let total = 0;
  const resolvedItems: any[] = [];
  for (const item of params.itens) {
    const { data: products } = await supabase
      .from("produtos")
      .select("id,nome,preco")
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .ilike("nome", `%${item.produto_nome}%`)
      .limit(5);
    if (!products?.length)
      return {
        question: `Não encontrei o produto "${item.produto_nome}" na unidade atual. Qual produto devo usar?`,
      };
    if (products.length > 1)
      return {
        question: `Encontrei mais de um produto para "${item.produto_nome}": ${products.map((p: any) => p.nome).join(", ")}. Qual é o correto?`,
      };
    const product = products[0];
    let price = Number(product.preco || 0);
    let source = "tabela";
    const { data: negotiated } = await supabase
      .from("cliente_precos_negociados")
      .select("preco_negociado")
      .eq("cliente_id", client.id)
      .eq("produto_id", product.id)
      .eq("ativo", true)
      .maybeSingle();
    if (negotiated) {
      price = Number(negotiated.preco_negociado);
      source = "negociado";
    } else {
      const { data: last } = await supabase
        .from("pedido_itens")
        .select("preco_unitario,pedidos!inner(cliente_id,unidade_id)")
        .eq("produto_id", product.id)
        .eq("pedidos.cliente_id", client.id)
        .eq("pedidos.unidade_id", unidadeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last) {
        price = Number(last.preco_unitario);
        source = "último preço pago";
      }
    }
    const quantity = Number(item.quantidade || 0);
    if (!(quantity > 0))
      return { question: `Qual é a quantidade de ${product.nome}?` };
    resolvedItems.push({
      produto_id: product.id,
      produto_nome: product.nome,
      quantidade: quantity,
      preco_unitario: price,
      preco_fonte: source,
    });
    total += quantity * price;
  }
  params.itens = resolvedItems;
  params.valor_total_confirmado = Number(total.toFixed(2));
  params.idempotency_key ||= crypto.randomUUID();
  const itemText = resolvedItems
    .map(
      (i) =>
        `${i.quantidade}x ${i.produto_nome} a R$ ${i.preco_unitario.toFixed(2)} (${i.preco_fonte})`,
    )
    .join(", ");
  const delivery = params.ja_entregue
    ? `já entregue por ${params.tipo_entrega === "portaria" ? "portaria/balcão" : params.entregador_nome}`
    : "a entregar";
  return {
    params,
    preview: `Pedido para ${client.nome}: ${itemText}. Total R$ ${total.toFixed(2)}; ${params.forma_pagamento}; ${delivery}; endereço: ${params.endereco_entrega || "não informado"}.`,
  };
}

async function preparePurchaseAction(
  supabase: any,
  original: any,
  unidadeId: string,
): Promise<any> {
  const params = { ...original };
  if (!params.fornecedor_id && !params.fornecedor_nome) {
    return { question: "Qual é o fornecedor desta compra?" };
  }
  if (!Array.isArray(params.itens) || params.itens.length === 0) {
    return { question: "Qual produto e qual quantidade foram comprados?" };
  }
  if (params.itens.some((item: any) => !(Number(item.preco_unitario) >= 0))) {
    return { question: "Qual foi o preço unitário de compra de cada produto?" };
  }
  if (!params.situacao_pagamento) {
    return { question: "A compra foi à vista ou a prazo?" };
  }
  if (!params.forma_pagamento) {
    return { question: "Qual foi a forma de pagamento?" };
  }
  if (params.situacao_pagamento === "aprazo" && !params.data_vencimento) {
    return { question: "Qual é a data de vencimento da compra a prazo?" };
  }
  if (params.forma_pagamento === "credito" && !(Number(params.parcelas) > 0)) {
    return {
      question: "Em quantas parcelas foi feita a compra no cartão de crédito?",
    };
  }
  if (params.forma_pagamento === "cheque" && !params.numero_cheque) {
    return { question: "Qual é o número do cheque usado na compra?" };
  }

  let supplier: any = null;
  if (params.fornecedor_id) {
    const { data } = await supabase
      .from("fornecedores")
      .select("id,razao_social,nome_fantasia")
      .eq("id", params.fornecedor_id)
      .eq("unidade_id", unidadeId)
      .maybeSingle();
    supplier = data;
  } else {
    const { data } = await supabase
      .from("fornecedores")
      .select("id,razao_social,nome_fantasia")
      .eq("unidade_id", unidadeId)
      .or(
        `razao_social.ilike.%${params.fornecedor_nome}%,nome_fantasia.ilike.%${params.fornecedor_nome}%`,
      )
      .limit(5);
    if ((data || []).length === 1) supplier = data[0];
    else if ((data || []).length > 1) {
      return {
        question: `Encontrei mais de um fornecedor: ${data.map((row: any) => row.nome_fantasia || row.razao_social).join(", ")}. Qual é o correto?`,
      };
    }
  }
  if (!supplier)
    return {
      question: `Não encontrei o fornecedor "${params.fornecedor_nome}". Confirme o nome ou cadastre o fornecedor antes da compra.`,
    };
  params.fornecedor_id = supplier.id;
  params.fornecedor_nome = supplier.nome_fantasia || supplier.razao_social;

  const resolvedItems: any[] = [];
  let subtotal = 0;
  for (const item of params.itens) {
    const { data: products } = await supabase
      .from("produtos")
      .select("id,nome")
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .ilike("nome", `%${item.produto_nome}%`)
      .limit(8);
    if (!products?.length)
      return {
        question: `Não encontrei o produto "${item.produto_nome}". Qual produto cadastrado devo usar?`,
      };
    if (products.length > 1) {
      return {
        question: `Qual produto exatamente? Encontrei: ${products.map((row: any) => row.nome).join(", ")}.`,
      };
    }
    const quantity = Number(item.quantidade || 0);
    const unitPrice = Number(item.preco_unitario);
    if (!(quantity > 0))
      return {
        question: `Qual foi a quantidade comprada de ${products[0].nome}?`,
      };
    resolvedItems.push({
      produto_id: products[0].id,
      produto_nome: products[0].nome,
      quantidade: quantity,
      preco_unitario: unitPrice,
    });
    subtotal += quantity * unitPrice;
  }

  const bankingMethods = [
    "pix",
    "ted",
    "debito",
    "vale_central_gas",
    "vale_ultragaz",
  ];
  if (
    params.situacao_pagamento === "avista" &&
    bankingMethods.includes(params.forma_pagamento)
  ) {
    if (!params.conta_bancaria_nome)
      return { question: "De qual banco/conta saiu o pagamento?" };
    const { data: accounts } = await supabase
      .from("contas_bancarias")
      .select("id,nome,banco")
      .eq("unidade_id", unidadeId)
      .eq("ativo", true)
      .or(
        `nome.ilike.%${params.conta_bancaria_nome}%,banco.ilike.%${params.conta_bancaria_nome}%`,
      )
      .limit(5);
    if ((accounts || []).length !== 1) {
      const names = (accounts || [])
        .map((row: any) => `${row.banco || "Banco"} · ${row.nome}`)
        .join(", ");
      return {
        question: names
          ? `Qual conta é a correta? ${names}`
          : `Não encontrei a conta "${params.conta_bancaria_nome}". Qual conta bancária devo usar?`,
      };
    }
    params.conta_bancaria_id = accounts[0].id;
    params.conta_bancaria_nome = `${accounts[0].banco || "Banco"} · ${accounts[0].nome}`;
  }

  params.itens = resolvedItems;
  params.valor_total_confirmado = Number(
    (subtotal + Number(params.valor_frete || 0)).toFixed(2),
  );
  params.idempotency_key ||= crypto.randomUUID();
  const itemsText = resolvedItems
    .map(
      (item) =>
        `${item.quantidade}x ${item.produto_nome} a R$ ${item.preco_unitario.toFixed(2)}`,
    )
    .join(", ");
  const paymentText =
    params.situacao_pagamento === "aprazo"
      ? `a prazo via ${params.forma_pagamento}, vencimento ${params.data_vencimento}`
      : `à vista via ${params.forma_pagamento}${params.conta_bancaria_nome ? ` (${params.conta_bancaria_nome})` : ""}`;
  return {
    params,
    preview: `Compra de ${params.fornecedor_nome}: ${itemsText}. Total R$ ${params.valor_total_confirmado.toFixed(2)}; ${paymentText}.`,
  };
}

function isTodaySalesIntent(message: string): boolean {
  const normalized = message
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return (
    /\b(vendas?|faturamento|pedidos?)\b/.test(normalized) &&
    /\b(hoje|dia)\b/.test(normalized)
  );
}

// Consulta tipada (sem RPC) alinhada ao Dashboard: pedidos da unidade com
// data_entrega de hoje (ou created_at de hoje quando data_entrega é nula)
// e status de venda concluída (entregue, finalizado, pago_cartao).
async function getTodaySalesSummary(supabase: any, unidadeId: string) {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nextDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const startIso = `${today}T00:00:00-03:00`;
  const nextIso = `${nextDate}T00:00:00-03:00`;

  const { data, error } = await supabase
    .from("pedidos")
    .select("valor_total")
    .eq("unidade_id", unidadeId)
    .in("status", ["entregue", "finalizado", "pago_cartao"])
    .or(
      `and(data_entrega.gte.${today},data_entrega.lt.${nextDate}),and(data_entrega.is.null,created_at.gte.${startIso},created_at.lt.${nextIso})`,
    );
  if (error) throw new Error(error.message);

  const rows = data || [];
  const pedidos = rows.length;
  const faturamento = rows.reduce(
    (sum: number, row: any) => sum + Number(row.valor_total || 0),
    0,
  );
  return {
    pedidos,
    faturamento,
    ticket_medio: pedidos > 0 ? faturamento / pedidos : 0,
  };
}

function buildSafeQuery(
  message: string,
  unidadeId: string,
): { description: string; sql: string } | null {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (isTodaySalesIntent(message)) {
    // Tratado por getTodaySalesSummary via API tipada (sem RPC).
    return null;
  }

  if (/\b(estoque|ruptura|baixo|critico|critico)\b/.test(normalized)) {
    return {
      description: "Produtos com estoque baixo",
      sql: `
        select nome, categoria, estoque, estoque_minimo
        from produtos
        where unidade_id = '${unidadeId}'
          and ativo = true
          and coalesce(estoque, 0) <= coalesce(estoque_minimo, 0)
        order by coalesce(estoque, 0) asc, nome asc
        limit 20
      `,
    };
  }

  if (/\b(contas?|vencid[ao]s?|atras[ao])\b/.test(normalized)) {
    return {
      description: "Contas vencidas a pagar e a receber",
      sql: `
        select 'pagar' as tipo, fornecedor as pessoa, descricao, valor, vencimento, status
        from contas_pagar
        where unidade_id = '${unidadeId}'
          and status <> 'pago'
          and vencimento < current_date
        union all
        select 'receber' as tipo, cliente as pessoa, descricao, valor, vencimento, status
        from contas_receber
        where unidade_id = '${unidadeId}'
          and status <> 'pago'
          and vencimento < current_date
        order by vencimento asc
        limit 30
      `,
    };
  }

  return null;
}

function validateGeneratedSql(
  sqlQuery: string,
  unidadeId: string,
): string | null {
  const normalized = sqlQuery.trim();
  const upper = normalized.toUpperCase();
  const blocked = "Consulta rejeitada: filtro de unidade obrigatorio.";
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(unidadeId)) return blocked;
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) return blocked;
  if (
    normalized.includes(";") ||
    normalized.includes("--") ||
    normalized.includes("/*") ||
    normalized.includes("*/")
  ) {
    return blocked;
  }
  if (
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|MERGE|CALL|DO|EXECUTE|COPY|SET|RESET|VACUUM|ANALYZE|LOCK|LISTEN|NOTIFY|BEGIN|COMMIT|ROLLBACK|SAVEPOINT)\b/i.test(
      normalized,
    )
  ) {
    return blocked;
  }
  // Must contain a WHERE clause
  if (!/\bWHERE\b/i.test(normalized)) return blocked;
  // Must contain an equality predicate to caller's unidade_id (quoted literal)
  const eq = new RegExp(
    `unidade_id\\s*=\\s*'${unidadeId.replace(/-/g, "\\-")}'`,
    "i",
  );
  if (!eq.test(normalized)) return blocked;
  // Reject any other UUIDs anywhere in the query (prevents cross-tenant literals)
  const foreignUuids =
    normalized.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ) || [];
  for (const u of foreignUuids) {
    if (u.toLowerCase() !== unidadeId.toLowerCase()) return blocked;
  }
  // Require one unidade_id filter reference per FROM/JOIN target to prevent
  // unscoped joins leaking cross-tenant rows.
  const fromJoinCount = (normalized.match(/\b(FROM|JOIN)\b/gi) || []).length;
  const unidadeIdMentions = (normalized.match(/\bunidade_id\b/gi) || []).length;
  if (unidadeIdMentions < fromJoinCount) return blocked;
  // Disallow subqueries / CTEs which our simple validator cannot fully analyze
  if (/\bSELECT\b[\s\S]*\bSELECT\b/i.test(normalized)) return blocked;
  return null;
}

async function logAiAction(
  supabase: any,
  entry: {
    user_id: string;
    empresa_id: string | null;
    unidade_id: string;
    action: string;
    params: Record<string, unknown>;
    result: string;
    success: boolean;
  },
) {
  try {
    await supabase.from("ai_action_logs").insert(entry);
  } catch (e) {
    console.warn("ai action audit log failed:", e);
  }
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

async function executeAction(
  supabase: any,
  action: string,
  params: any,
  unidade_id: string,
  empresa_id: string | null,
  lastUserMessage = "",
): Promise<string> {
  try {
    if (!unidade_id)
      return "Acao rejeitada: selecione uma unidade antes de alterar dados.";

    switch (action) {
      case "cadastrar_produto": {
        const {
          nome,
          preco,
          categoria,
          tipo_botijao,
          estoque,
          custo,
          estoque_minimo,
          descricao,
          codigo_barras,
        } = params;
        const { data, error } = await supabase
          .from("produtos")
          .insert({
            nome,
            preco: preco || 0,
            categoria,
            tipo_botijao: tipo_botijao || null,
            estoque: estoque || 0,
            preco_custo: custo || null,
            estoque_minimo: estoque_minimo || null,
            descricao: descricao || null,
            codigo_barras: codigo_barras || null,
            ativo: true,
            unidade_id,
          })
          .select("id, nome, preco")
          .single();
        if (error) throw error;
        return `✅ Produto "${data.nome}" cadastrado com sucesso (ID: ${data.id}, Preço: R$ ${data.preco?.toFixed(2)})`;
      }

      case "cadastrar_funcionario": {
        const {
          nome,
          cargo,
          salario,
          setor,
          cpf,
          telefone,
          email,
          endereco,
          data_admissao,
          tipo_contrato,
          jornada_semanal,
        } = params;
        const { data, error } = await supabase
          .from("funcionarios")
          .insert({
            nome,
            cargo,
            salario: salario || 0,
            setor: setor || null,
            cpf: cpf || null,
            telefone: telefone || null,
            email: email || null,
            endereco: endereco || null,
            data_admissao:
              data_admissao || new Date().toISOString().split("T")[0],
            tipo_contrato: tipo_contrato || "clt",
            jornada_semanal: jornada_semanal || 44,
            ativo: true,
            unidade_id,
          })
          .select("id, nome, cargo")
          .single();
        if (error) throw error;
        return `✅ Funcionário "${data.nome}" (${data.cargo}) cadastrado com sucesso (ID: ${data.id})`;
      }

      case "cadastrar_cliente": {
        const {
          nome,
          telefone,
          cpf,
          email,
          endereco,
          bairro,
          cidade,
          numero,
          cep,
          tipo,
        } = params;
        if (!empresa_id)
          return "Acao rejeitada: empresa nao identificada para a unidade atual.";
        // Normaliza telefone: remove não-dígitos e prefixo de país "55" se vier com 12-13 dígitos
        let telefoneNormalizado: string | null = null;
        if (telefone) {
          let digits = String(telefone).replace(/\D/g, "");
          // Remove DDI 55 (Brasil) quando excede o tamanho local
          if (digits.length === 13 && digits.startsWith("55"))
            digits = digits.slice(2);
          else if (digits.length === 12 && digits.startsWith("55"))
            digits = digits.slice(2);
          // Mantém os últimos 11 (DDD + 9 dígitos) para garantir
          if (digits.length > 11) digits = digits.slice(-11);
          telefoneNormalizado = digits || null;
        }
        const { data, error } = await supabase
          .from("clientes")
          .insert({
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
          })
          .select("id, nome, telefone")
          .single();
        if (error) throw error;
        return `✅ Cliente "${data.nome}" cadastrado com sucesso (ID: ${data.id}${data.telefone ? `, Tel: ${data.telefone}` : ""})`;
      }

      case "cadastrar_fornecedor": {
        const {
          razao_social,
          nome_fantasia,
          cnpj,
          tipo,
          telefone,
          email,
          cidade,
          estado,
        } = params;
        const { data, error } = await supabase
          .from("fornecedores")
          .insert({
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
          })
          .select("id, razao_social")
          .single();
        if (error) throw error;
        return `✅ Fornecedor "${data.razao_social}" cadastrado com sucesso (ID: ${data.id})`;
      }

      case "registrar_compra": {
        const {
          fornecedor_id,
          fornecedor_nome,
          itens,
          valor_frete,
          numero_nota_fiscal,
          data_compra,
          observacoes,
          situacao_pagamento,
          forma_pagamento,
          conta_bancaria_id,
          data_vencimento,
          parcelas,
          numero_cheque,
          banco_cheque,
          idempotency_key,
        } = params;

        if (!fornecedor_id || !situacao_pagamento || !forma_pagamento) {
          return "Acao rejeitada: confirme fornecedor, situação e forma de pagamento.";
        }
        if (idempotency_key) {
          const marker = `[AI:${idempotency_key}]`;
          const { data: existing } = await supabase
            .from("compras")
            .select("id")
            .eq("unidade_id", unidade_id)
            .ilike("observacoes", `%${marker}%`)
            .maybeSingle();
          if (existing)
            return `Compra já registrada anteriormente (ID: ${existing.id.substring(0, 8)}).`;
        }

        // Find or identify fornecedor
        let fId = fornecedor_id;
        if (!fId && fornecedor_nome) {
          const { data: forn } = await supabase
            .from("fornecedores")
            .select("id")
            .ilike("razao_social", `%${fornecedor_nome}%`)
            .eq("unidade_id", unidade_id)
            .limit(1)
            .single();
          fId = forn?.id || null;
        }

        // Resolve product IDs
        const resolvedItens = [];
        let valorTotal = 0;
        for (const item of itens || []) {
          const { data: prod } = item.produto_id
            ? await supabase
                .from("produtos")
                .select("id,nome")
                .eq("id", item.produto_id)
                .eq("unidade_id", unidade_id)
                .maybeSingle()
            : await supabase
                .from("produtos")
                .select("id,nome")
                .ilike("nome", `%${item.produto_nome}%`)
                .eq("unidade_id", unidade_id)
                .limit(1)
                .maybeSingle();
          if (!prod)
            return `Acao rejeitada: produto "${item.produto_nome}" não encontrado.`;
          resolvedItens.push({
            produto_id: prod?.id || null,
            produto_nome: prod?.nome || item.produto_nome,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
          });
          valorTotal += item.quantidade * item.preco_unitario;
        }

        const compraDate =
          data_compra ||
          new Date().toLocaleDateString("en-CA", {
            timeZone: "America/Sao_Paulo",
          });
        const paymentForm =
          situacao_pagamento === "aprazo" ? "a_prazo" : forma_pagamento;
        const paymentOrigin =
          situacao_pagamento === "aprazo" || forma_pagamento === "credito"
            ? "fatura"
            : forma_pagamento === "dinheiro"
              ? "caixa"
              : "banco";
        const marker = idempotency_key ? ` [AI:${idempotency_key}]` : "";
        const { data: compra, error: compraErr } = await supabase
          .from("compras")
          .insert({
            fornecedor_id: fId,
            valor_total: valorTotal + (valor_frete || 0),
            valor_frete: valor_frete || 0,
            status: "recebido",
            data_compra: compraDate,
            data_recebimento: compraDate,
            numero_nota_fiscal: numero_nota_fiscal || null,
            observacoes: `${observacoes || "Compra via Assistente IA"}${marker}`,
            forma_pagamento: paymentForm,
            origem_pagamento: paymentOrigin,
            conta_bancaria_id: conta_bancaria_id || null,
            parcelas: Math.max(1, Number(parcelas || 1)),
            data_pagamento:
              situacao_pagamento === "avista" &&
              !["credito", "cheque"].includes(forma_pagamento)
                ? compraDate
                : null,
            data_vencimento: data_vencimento || null,
            pago:
              situacao_pagamento === "avista" &&
              !["credito", "cheque"].includes(forma_pagamento),
            unidade_id,
          })
          .select("id")
          .single();
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
            const { data: currentProd } = await supabase
              .from("produtos")
              .select("estoque")
              .eq("id", item.produto_id)
              .eq("unidade_id", unidade_id)
              .single();
            if (currentProd) {
              await supabase
                .from("produtos")
                .update({
                  estoque: (currentProd.estoque || 0) + item.quantidade,
                })
                .eq("id", item.produto_id)
                .eq("unidade_id", unidade_id);
            }
          }
        }

        const descricaoFinanceira = `Compra ${numero_nota_fiscal ? `NF ${numero_nota_fiscal}` : compra.id.substring(0, 8)} - ${fornecedor_nome || "Fornecedor"}`;
        if (situacao_pagamento === "avista" && forma_pagamento === "dinheiro") {
          const { error } = await supabase.from("movimentacoes_caixa").insert({
            tipo: "saida",
            categoria: "compras",
            valor: valorTotal + Number(valor_frete || 0),
            descricao: descricaoFinanceira,
            status: "aprovado",
            unidade_id,
            compra_id: compra.id,
          });
          if (error) throw error;
        } else if (
          situacao_pagamento === "avista" &&
          [
            "pix",
            "ted",
            "debito",
            "boleto",
            "vale_central_gas",
            "vale_ultragaz",
          ].includes(forma_pagamento)
        ) {
          if (!conta_bancaria_id)
            throw new Error("Conta bancária não informada para o pagamento.");
          const { data: account } = await supabase
            .from("contas_bancarias")
            .select("saldo_atual")
            .eq("id", conta_bancaria_id)
            .eq("unidade_id", unidade_id)
            .maybeSingle();
          if (!account) throw new Error("Conta bancária não encontrada.");
          const amount = valorTotal + Number(valor_frete || 0);
          const balanceAfter = Number(account.saldo_atual || 0) - amount;
          const { error } = await supabase
            .from("movimentacoes_bancarias")
            .insert({
              conta_bancaria_id,
              tipo: "saida",
              categoria: "compras",
              valor: amount,
              descricao: descricaoFinanceira,
              data: compraDate,
              saldo_apos: balanceAfter,
              referencia_id: compra.id,
              referencia_tipo: "compra",
              unidade_id,
            });
          if (error) throw error;
          await supabase
            .from("contas_bancarias")
            .update({ saldo_atual: balanceAfter })
            .eq("id", conta_bancaria_id)
            .eq("unidade_id", unidade_id);
        } else {
          const amount = valorTotal + Number(valor_frete || 0);
          const count =
            forma_pagamento === "credito"
              ? Math.max(1, Number(parcelas || 1))
              : 1;
          const installment = Number((amount / count).toFixed(2));
          const groupId = count > 1 ? crypto.randomUUID() : null;
          const rows = Array.from({ length: count }).map((_, index) => {
            const due = new Date(`${data_vencimento || compraDate}T12:00:00`);
            if (count > 1) due.setMonth(due.getMonth() + index);
            return {
              descricao:
                count > 1
                  ? `${descricaoFinanceira} (${index + 1}/${count})`
                  : descricaoFinanceira,
              fornecedor: fornecedor_nome || "Fornecedor",
              valor:
                index === count - 1
                  ? Number((amount - installment * (count - 1)).toFixed(2))
                  : installment,
              vencimento: due.toISOString().slice(0, 10),
              categoria: "compras",
              status: "pendente",
              unidade_id,
              compra_id: compra.id,
              forma_pagamento,
              conta_bancaria_id: conta_bancaria_id || null,
              parcela_numero: count > 1 ? index + 1 : null,
              parcela_total: count > 1 ? count : null,
              grupo_parcela_id: groupId,
            };
          });
          const { error } = await supabase.from("contas_pagar").insert(rows);
          if (error) throw error;
          if (forma_pagamento === "cheque") {
            const { error: checkError } = await supabase
              .from("cheques")
              .insert({
                numero_cheque,
                banco_emitente: banco_cheque || null,
                valor: amount,
                data_emissao: compraDate,
                data_vencimento: data_vencimento || compraDate,
                status: "emitido",
                unidade_id,
                compra_id: compra.id,
              });
            if (checkError) throw checkError;
          }
        }

        const itensStr = resolvedItens
          .map(
            (i) =>
              `${i.quantidade}x ${i.produto_nome} @ R$ ${i.preco_unitario.toFixed(2)}`,
          )
          .join(", ");
        return `✅ Compra registrada (ID: ${compra.id.substring(0, 8)}): ${itensStr}. Total: R$ ${(valorTotal + Number(valor_frete || 0)).toFixed(2)}. Estoque e financeiro atualizados.`;
      }

      case "registrar_despesa": {
        const { fornecedor, descricao, valor, vencimento, categoria, status } =
          params;
        const { data, error } = await supabase
          .from("contas_pagar")
          .insert({
            fornecedor: fornecedor || "Não informado",
            descricao,
            valor,
            vencimento,
            categoria: categoria || "outros",
            status: status || "pendente",
            unidade_id,
          })
          .select("id, descricao, valor")
          .single();
        if (error) throw error;
        return `✅ Despesa "${data.descricao}" registrada: R$ ${data.valor.toFixed(2)} (vencimento: ${vencimento}, ID: ${data.id.substring(0, 8)})`;
      }

      case "criar_pedido": {
        let {
          cliente_id,
          cliente_nome,
          cliente_telefone,
          itens,
          forma_pagamento,
          endereco_entrega,
          observacoes,
          troco_para,
          data_entrega,
          hora_entrega,
          ja_entregue,
          tipo_entrega,
          entregador_nome,
          idempotency_key,
        } = params;

        if (!forma_pagamento || typeof ja_entregue !== "boolean") {
          return "Acao rejeitada: confirme a forma de pagamento e se o pedido ja foi entregue.";
        }
        if (idempotency_key) {
          const marker = `[AI:${idempotency_key}]`;
          const { data: existing } = await supabase
            .from("pedidos")
            .select("id,numero_sequencial")
            .eq("unidade_id", unidade_id)
            .ilike("observacoes", `%${marker}%`)
            .maybeSingle();
          if (existing)
            return `Pedido já criado anteriormente (#${existing.numero_sequencial || existing.id.substring(0, 8)}).`;
        }

        // Fallback determinístico: se LLM não preencheu data/hora mas o usuário pediu agendamento, extrair da mensagem
        if (!data_entrega) {
          const msg = (lastUserMessage || "").toLowerCase();
          const isAgendaIntent =
            /\b(agend[ae]|amanh[ãa]|depois de amanh[ãa]|hoje|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|dia\s+\d{1,2}|\d{1,2}\/\d{1,2})\b/.test(
              msg,
            );
          if (isAgendaIntent) {
            const now = new Date(
              new Date().toLocaleString("en-US", {
                timeZone: "America/Sao_Paulo",
              }),
            );
            let target: Date | null = null;
            if (/depois de amanh[ãa]/.test(msg)) {
              target = new Date(now);
              target.setDate(target.getDate() + 2);
            } else if (/amanh[ãa]/.test(msg)) {
              target = new Date(now);
              target.setDate(target.getDate() + 1);
            } else if (/\bhoje\b/.test(msg)) {
              target = new Date(now);
            } else {
              const weekdays: Record<string, number> = {
                domingo: 0,
                segunda: 1,
                terça: 2,
                terca: 2,
                quarta: 3,
                quinta: 4,
                sexta: 5,
                sábado: 6,
                sabado: 6,
              };
              for (const [k, v] of Object.entries(weekdays)) {
                if (new RegExp(`\\b${k}\\b`).test(msg)) {
                  target = new Date(now);
                  const diff = (v - target.getDay() + 7) % 7 || 7;
                  target.setDate(target.getDate() + diff);
                  break;
                }
              }
              if (!target) {
                const m = msg.match(/\b(?:dia\s+)?(\d{1,2})(?:\/(\d{1,2}))?\b/);
                if (m) {
                  const d = parseInt(m[1], 10);
                  const mo = m[2] ? parseInt(m[2], 10) - 1 : now.getMonth();
                  if (d >= 1 && d <= 31) {
                    target = new Date(now.getFullYear(), mo, d);
                    if (target < now)
                      target.setFullYear(target.getFullYear() + 1);
                  }
                }
              }
              // Fallback: usuário pediu "agenda" sem especificar data → assume amanhã
              if (!target && /\bagend[ae]/.test(msg)) {
                target = new Date(now);
                target.setDate(target.getDate() + 1);
              }
            }
            if (target) {
              const y = target.getFullYear();
              const m = String(target.getMonth() + 1).padStart(2, "0");
              const d = String(target.getDate()).padStart(2, "0");
              data_entrega = `${y}-${m}-${d}`;
            }
          }
        }
        if (!hora_entrega) {
          const msg = (lastUserMessage || "").toLowerCase();
          const horaM = msg.match(/\b(\d{1,2})(?::|h)\s*(\d{2})?\b/);
          if (horaM) {
            const hh = String(Math.min(23, parseInt(horaM[1], 10))).padStart(
              2,
              "0",
            );
            const mm = String(
              horaM[2] ? Math.min(59, parseInt(horaM[2], 10)) : 0,
            ).padStart(2, "0");
            hora_entrega = `${hh}:${mm}`;
          } else if (/manh[ãa]/.test(msg)) hora_entrega = "09:00";
          else if (/tarde/.test(msg)) hora_entrega = "14:00";
          else if (/noite/.test(msg)) hora_entrega = "18:00";
        }
        console.log("[criar_pedido] agendamento", {
          data_entrega,
          hora_entrega,
        });

        // Resolve client: id > telefone > nome
        let cliente: any = null;
        if (cliente_id) {
          const { data } = await supabase
            .from("clientes")
            .select("id, nome, telefone, endereco, numero, bairro")
            .eq("id", cliente_id)
            .eq("empresa_id", empresa_id)
            .maybeSingle();
          cliente = data;
        }
        if (!cliente && cliente_telefone) {
          const tel = String(cliente_telefone).replace(/\D/g, "");
          if (tel.length >= 8) {
            const { data } = await supabase
              .from("clientes")
              .select("id, nome, telefone, endereco, numero, bairro")
              .ilike("telefone", `%${tel.slice(-8)}%`)
              .eq("empresa_id", empresa_id)
              .limit(1)
              .maybeSingle();
            cliente = data;
          }
        }
        if (!cliente && cliente_nome) {
          const { data } = await supabase
            .from("clientes")
            .select("id, nome, telefone, endereco, numero, bairro")
            .ilike("nome", `%${cliente_nome}%`)
            .eq("empresa_id", empresa_id)
            .limit(1)
            .maybeSingle();
          cliente = data;
        }

        // Resolve products and calculate total
        let valorTotal = 0;
        const pedidoItens: any[] = [];
        for (const item of itens || []) {
          const { data: prod } = item.produto_id
            ? await supabase
                .from("produtos")
                .select("id, nome, preco")
                .eq("id", item.produto_id)
                .eq("unidade_id", unidade_id)
                .maybeSingle()
            : await supabase
                .from("produtos")
                .select("id, nome, preco")
                .ilike("nome", `%${item.produto_nome}%`)
                .eq("unidade_id", unidade_id)
                .limit(1)
                .maybeSingle();
          if (!prod)
            return `Acao rejeitada: produto "${item.produto_nome}" nao encontrado na unidade atual.`;
          const preco =
            item.preco_unitario != null
              ? Number(item.preco_unitario)
              : Number(prod.preco || 0);
          pedidoItens.push({
            produto_id: prod?.id || null,
            produto_nome: prod?.nome || item.produto_nome,
            quantidade: item.quantidade,
            preco_unitario: preco,
          });
          valorTotal += item.quantidade * preco;
        }

        // Endereço: usa o passado, senão monta do cliente
        let enderecoFinal = endereco_entrega || null;
        if (!enderecoFinal && cliente) {
          const partes = [
            cliente.endereco,
            cliente.numero,
            cliente.bairro,
          ].filter(Boolean);
          if (partes.length) enderecoFinal = partes.join(", ");
        }

        // Agendamento
        const agendado = !!data_entrega;
        let dataAgendamentoIso: string | null = null;
        if (agendado) {
          const hora =
            hora_entrega && /^\d{1,2}:\d{2}$/.test(hora_entrega)
              ? hora_entrega
              : "08:00";
          // Brasil = UTC-3, salvamos em UTC somando 3h
          const local = new Date(
            `${data_entrega}T${hora.padStart(5, "0")}:00-03:00`,
          );
          if (!isNaN(local.getTime())) dataAgendamentoIso = local.toISOString();
        }

        let entregadorId: string | null = null;
        let responsavelAcerto: string | null = null;
        if (ja_entregue && tipo_entrega === "entregador") {
          const { data: drivers } = await supabase
            .from("entregadores")
            .select("id,nome")
            .eq("unidade_id", unidade_id)
            .eq("ativo", true)
            .ilike("nome", `%${entregador_nome || ""}%`)
            .limit(2);
          if (!drivers?.length)
            return `Acao rejeitada: entregador "${entregador_nome}" nao encontrado.`;
          if (drivers.length > 1)
            return `Acao rejeitada: ha mais de um entregador parecido com "${entregador_nome}". Informe o nome completo.`;
          entregadorId = drivers[0].id;
        } else if (ja_entregue && tipo_entrega === "portaria") {
          responsavelAcerto = "portaria";
        }

        const marker = idempotency_key ? ` [AI:${idempotency_key}]` : "";
        const insertPayload: any = {
          cliente_id: cliente?.id || null,
          entregador_id: entregadorId,
          valor_total: valorTotal,
          forma_pagamento,
          status: ja_entregue ? "entregue" : "pendente",
          canal_venda: "assistente",
          responsavel_acerto: responsavelAcerto,
          endereco_entrega: enderecoFinal,
          observacoes: `${observacoes || `Pedido via Assistente IA${cliente?.nome ? ` - ${cliente.nome}` : cliente_nome ? ` - ${cliente_nome}` : ""}${cliente_telefone ? ` (${cliente_telefone})` : ""}`}${marker}`,
          troco_para: troco_para || null,
          unidade_id,
          agendado,
          data_agendamento: dataAgendamentoIso,
          data_entrega:
            data_entrega ||
            (ja_entregue
              ? new Date().toLocaleDateString("en-CA", {
                  timeZone: "America/Sao_Paulo",
                })
              : null),
        };

        const { data: pedido, error: pedidoErr } = await supabase
          .from("pedidos")
          .insert(insertPayload)
          .select("id")
          .single();
        if (pedidoErr) throw pedidoErr;

        for (const item of pedidoItens) {
          const { error: itemErr } = await supabase
            .from("pedido_itens")
            .insert({
              pedido_id: pedido.id,
              produto_id: item.produto_id,
              quantidade: item.quantidade,
              preco_unitario: item.preco_unitario,
            });
          if (itemErr) {
            await supabase.from("pedidos").delete().eq("id", pedido.id);
            throw itemErr;
          }
        }

        // Replicate the stock side effects used by Nova Venda so assistant orders
        // cannot leave the operational stock out of sync.
        for (const item of pedidoItens) {
          if (!item.produto_id) continue;
          const { data: stockProduct } = await supabase
            .from("produtos")
            .select("id,estoque,categoria,tipo_botijao,botijao_par_id")
            .eq("id", item.produto_id)
            .eq("unidade_id", unidade_id)
            .maybeSingle();
          if (!stockProduct) continue;
          await supabase
            .from("produtos")
            .update({
              estoque: Math.max(
                0,
                Number(stockProduct.estoque || 0) -
                  Number(item.quantidade || 0),
              ),
            })
            .eq("id", stockProduct.id)
            .eq("unidade_id", unidade_id);
          await supabase.from("movimentacoes_estoque").insert({
            produto_id: stockProduct.id,
            tipo: "saida",
            quantidade: item.quantidade,
            observacoes: `Baixa automática por venda via Assistente IA — pedido ${pedido.id.substring(0, 8)}`,
            unidade_id,
          });
          if (
            ["gas", "agua"].includes(stockProduct.categoria) &&
            stockProduct.tipo_botijao === "cheio" &&
            stockProduct.botijao_par_id
          ) {
            const { data: emptyProduct } = await supabase
              .from("produtos")
              .select("id,estoque")
              .eq("id", stockProduct.botijao_par_id)
              .eq("unidade_id", unidade_id)
              .maybeSingle();
            if (emptyProduct) {
              await supabase
                .from("produtos")
                .update({
                  estoque:
                    Number(emptyProduct.estoque || 0) +
                    Number(item.quantidade || 0),
                })
                .eq("id", emptyProduct.id)
                .eq("unidade_id", unidade_id);
            }
          }
        }

        const itensStr = pedidoItens
          .map((i) => `${i.quantidade}x ${i.produto_nome}`)
          .join(", ");
        const clienteStr = cliente?.nome
          ? ` para ${cliente.nome}`
          : cliente_nome
            ? ` para ${cliente_nome} (não cadastrado)`
            : "";
        const agendaStr = agendado
          ? ` 📅 AGENDADO para ${data_entrega} às ${hora_entrega || "08:00"}`
          : "";
        const statusStr = ja_entregue
          ? " Entrega registrada e aguardando o acerto diário."
          : "";
        return `✅ Pedido criado (#${pedido.id.substring(0, 8)})${clienteStr}: ${itensStr}. Total: R$ ${valorTotal.toFixed(2)}.${agendaStr}${statusStr}`;
      }

      case "atualizar_status_pedido": {
        const { pedido_id, novo_status } = params;
        const { error } = await supabase
          .from("pedidos")
          .update({ status: novo_status })
          .eq("id", pedido_id)
          .eq("unidade_id", unidade_id);
        if (error) throw error;
        return `✅ Pedido ${pedido_id.substring(0, 8)} atualizado para "${novo_status}"`;
      }

      case "registrar_movimentacao_estoque": {
        const { produto_nome, tipo, quantidade, observacoes } = params;
        const { data: prod } = await supabase
          .from("produtos")
          .select("id, nome, estoque")
          .ilike("nome", `%${produto_nome}%`)
          .eq("unidade_id", unidade_id)
          .limit(1)
          .single();
        if (!prod)
          return `❌ Produto "${produto_nome}" não encontrado na unidade atual`;

        await supabase.from("movimentacoes_estoque").insert({
          produto_id: prod.id,
          tipo,
          quantidade,
          observacoes: observacoes || `${tipo} via Assistente IA`,
          unidade_id,
        });

        const novoEstoque =
          tipo === "entrada"
            ? (prod.estoque || 0) + quantidade
            : (prod.estoque || 0) - quantidade;
        await supabase
          .from("produtos")
          .update({ estoque: Math.max(0, novoEstoque) })
          .eq("id", prod.id)
          .eq("unidade_id", unidade_id);

        return `✅ ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} de ${quantidade}x "${prod.nome}" registrada. Estoque: ${prod.estoque || 0} → ${Math.max(0, novoEstoque)}`;
      }

      case "cadastrar_veiculo": {
        const { placa, modelo, marca, ano, tipo, km_atual } = params;
        const { data, error } = await supabase
          .from("veiculos")
          .insert({
            placa: placa.toUpperCase(),
            modelo,
            marca: marca || null,
            ano: ano || null,
            tipo: tipo || "caminhonete",
            status: "disponivel",
            km_atual: km_atual || 0,
            unidade_id,
          })
          .select("id, placa, modelo")
          .single();
        if (error) throw error;
        return `✅ Veículo "${data.modelo}" (${data.placa}) cadastrado com sucesso (ID: ${data.id.substring(0, 8)})`;
      }

      case "registrar_manutencao": {
        const { veiculo_placa, tipo, descricao, valor, data, km, oficina } =
          params;
        let veiculoId = null;
        if (veiculo_placa) {
          const { data: vei } = await supabase
            .from("veiculos")
            .select("id")
            .ilike("placa", `%${veiculo_placa}%`)
            .eq("unidade_id", unidade_id)
            .limit(1)
            .single();
          veiculoId = vei?.id || null;
        }
        const { data: man, error } = await supabase
          .from("manutencoes")
          .insert({
            veiculo_id: veiculoId,
            tipo: tipo || "corretiva",
            descricao,
            valor,
            data: data || new Date().toISOString().split("T")[0],
            status: "pendente",
            km: km || null,
            oficina: oficina || null,
            unidade_id,
          })
          .select("id")
          .single();
        if (error) throw error;
        return `✅ Manutenção registrada (ID: ${man.id.substring(0, 8)}): ${descricao} — R$ ${valor.toFixed(2)}`;
      }

      case "registrar_conta_receber": {
        const { cliente, descricao, valor, vencimento, forma_pagamento } =
          params;
        const { data, error } = await supabase
          .from("contas_receber")
          .insert({
            cliente,
            descricao,
            valor,
            vencimento,
            status: "pendente",
            forma_pagamento: forma_pagamento || null,
            unidade_id,
          })
          .select("id")
          .single();
        if (error) throw error;
        return `✅ Conta a receber registrada: "${descricao}" — R$ ${valor.toFixed(2)} de ${cliente} (venc: ${vencimento})`;
      }

      case "atualizar_preco_produto": {
        const { produto_nome, novo_preco } = params;
        const { data: prod } = await supabase
          .from("produtos")
          .select("id, nome, preco")
          .ilike("nome", `%${produto_nome}%`)
          .eq("unidade_id", unidade_id)
          .limit(1)
          .single();
        if (!prod)
          return `❌ Produto "${produto_nome}" não encontrado na unidade atual`;
        const precoAntigo = prod.preco;
        await supabase
          .from("produtos")
          .update({ preco: novo_preco })
          .eq("id", prod.id)
          .eq("unidade_id", unidade_id);
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
