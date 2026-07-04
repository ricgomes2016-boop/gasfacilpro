import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

function safeEqualBia(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

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

// Upsert chamada: reaproveita uma chamada `recebida` recente da unidade
// (ex.: criada pelo goto-webhook segundos antes) para evitar 2 popups por ligação.
// Se não existir chamada recente, cria uma nova. Retorna o id da chamada usada.
async function upsertChamadaBia(
  supabase: any,
  unidadeId: string,
  payload: {
    telefone?: string | null;
    cliente_id?: string | null;
    cliente_nome?: string | null;
    observacoes: string;
    pedido_gerado_id?: string | null;
  }
): Promise<string | null> {
  try {
    const desdeIso = new Date(Date.now() - 3 * 60 * 1000).toISOString(); // 3 min
    const { data: existente } = await supabase
      .from("chamadas_recebidas")
      .select("id, pedido_gerado_id, cliente_id, cliente_nome, telefone")
      .eq("unidade_id", unidadeId)
      .eq("status", "recebida")
      .gte("created_at", desdeIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existente?.id) {
      const updates: any = {
        tipo: "voip",
        observacoes: payload.observacoes,
      };
      if (payload.telefone) updates.telefone = payload.telefone;
      if (payload.cliente_id) updates.cliente_id = payload.cliente_id;
      if (payload.cliente_nome) updates.cliente_nome = payload.cliente_nome;
      if (payload.pedido_gerado_id) updates.pedido_gerado_id = payload.pedido_gerado_id;

      const { error: updErr } = await supabase
        .from("chamadas_recebidas")
        .update(updates)
        .eq("id", existente.id);
      if (updErr) {
        console.error("[BIA-UPSERT] update error:", updErr);
      } else {
        console.log("[BIA-UPSERT] reusou chamada", existente.id);
      }
      return existente.id;
    }

    const { data: nova, error: insErr } = await supabase
      .from("chamadas_recebidas")
      .insert({
        telefone: payload.telefone ?? null,
        cliente_id: payload.cliente_id ?? null,
        cliente_nome: payload.cliente_nome ?? null,
        tipo: "voip",
        status: "recebida",
        unidade_id: unidadeId,
        observacoes: payload.observacoes,
        pedido_gerado_id: payload.pedido_gerado_id ?? null,
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[BIA-UPSERT] insert error:", insErr);
      return null;
    }
    console.log("[BIA-UPSERT] criou chamada nova", nova?.id);
    return nova?.id ?? null;
  } catch (e) {
    console.error("[BIA-UPSERT] exception:", e);
    return null;
  }
}

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

    // ============== Helper: regras de horário/domingo ==============
    // Espelha src/hooks/useSundayRules.ts (regra do sistema):
    //  - Domingo: fechamento máximo 14:00, sem entrega de água
    //  - Demais dias: usa horario_abertura/horario_fechamento da unidade
    const SUNDAY_MAX_CLOSING = "14:00";
    async function getRegrasFuncionamento() {
      const { data: u } = await supabase
        .from("unidades")
        .select("horario_abertura, horario_fechamento")
        .eq("id", unidade.id)
        .maybeSingle();
      const opening = u?.horario_abertura || "07:00";
      let closing = u?.horario_fechamento || "18:00";

      const now = new Date();
      // Converte para horário de Brasília (UTC-3)
      const brt = new Date(now.getTime() + (-3 * 60 + now.getTimezoneOffset()) * 60000);
      const isSunday = brt.getDay() === 0;
      const currentTime = `${String(brt.getHours()).padStart(2, "0")}:${String(brt.getMinutes()).padStart(2, "0")}`;

      if (isSunday && closing > SUNDAY_MAX_CLOSING) closing = SUNDAY_MAX_CLOSING;

      const isOpen = currentTime >= opening && currentTime < closing;
      return {
        isSunday,
        isOpen,
        opening,
        closing,
        currentTime,
        waterDeliveryAllowed: !isSunday,
      };
    }

    // ============== Helper: tabela de preços (Regras da Bia) ==============
    // Carrega configuracoes_empresa.regras_bia.tabela_precos da empresa fixa.
    // Esta é a FONTE OFICIAL de preços que a Bia deve usar (não mais produtos.preco).
    async function getTabelaPrecosBia(): Promise<Record<string, { preco: number; preco_desconto: number }>> {
      const { data } = await supabase
        .from("configuracoes_empresa")
        .select("regras_bia")
        .eq("empresa_id", empresa.id)
        .maybeSingle();
      const tp = (data?.regras_bia as any)?.tabela_precos || {};
      return {
        gas_p13: tp.gas_p13 || { preco: 0, preco_desconto: 0 },
        gas_p20: tp.gas_p20 || { preco: 0, preco_desconto: 0 },
        gas_p45: tp.gas_p45 || { preco: 0, preco_desconto: 0 },
        agua_20l: tp.agua_20l || { preco: 0, preco_desconto: 0 },
      };
    }

    function chaveTabelaParaProduto(nomeProduto: string): string | null {
      switch (nomeProduto) {
        case "Gás P13": return "gas_p13";
        case "Gás P20": return "gas_p20";
        case "Gás P45": return "gas_p45";
        case "Água Mineral 20L": return "agua_20l";
        default: return null;
      }
    }

    // ============== ACTION: consultar_precos ==============
    // Bia chama isso quando o cliente pergunta "quanto é o gás?".
    // Retorna preços oficiais da tabela das Regras da Bia.
    if (action === "consultar_precos") {
      const tp = await getTabelaPrecosBia();
      const itens = [
        { nome: "Gás P13", preco: tp.gas_p13.preco, preco_desconto: tp.gas_p13.preco_desconto },
        { nome: "Gás P20", preco: tp.gas_p20.preco, preco_desconto: tp.gas_p20.preco_desconto },
        { nome: "Gás P45", preco: tp.gas_p45.preco, preco_desconto: tp.gas_p45.preco_desconto },
        { nome: "Água Mineral 20L", preco: tp.agua_20l.preco, preco_desconto: tp.agua_20l.preco_desconto },
      ].filter((i) => i.preco > 0);

      const fmt = (n: number) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
      const lista = itens
        .map((i) =>
          i.preco_desconto && i.preco_desconto > 0 && i.preco_desconto < i.preco
            ? `${i.nome}: ${fmt(i.preco)} (com desconto ${fmt(i.preco_desconto)})`
            : `${i.nome}: ${fmt(i.preco)}`
        )
        .join("; ");

      return ok({
        precos: itens,
        mensagem: itens.length
          ? `Tabela oficial de preços: ${lista}. REGRAS: (1) Cote SEMPRE o preço NORMAL primeiro. (2) Só ofereça o preço com desconto se o cliente pedir desconto, perguntar "tem desconto?", citar concorrência ou hesitar. (3) NUNCA invente valores — use exclusivamente os números desta lista.`
          : "Tabela de preços não configurada. Peça ao cliente um momento e avise o gestor.",
      });
    }

    // ============== ACTION: verificar_horario ==============
    if (action === "verificar_horario") {
      const r = await getRegrasFuncionamento();
      let mensagem = "";
      if (!r.isOpen) {
        mensagem = r.isSunday
          ? `LOJA FECHADA. Hoje é domingo: funcionamento somente até ${r.closing} (apenas RETIRADA presencial na portaria, SEM entrega). Horário atual: ${r.currentTime}. Informe ao cliente que não é possível atender agora e ofereça registrar para o próximo horário de abertura (${r.opening}).`
          : `LOJA FECHADA. Horário de funcionamento: ${r.opening} às ${r.closing}. Horário atual: ${r.currentTime}. Informe educadamente e ofereça anotar o pedido para o próximo dia útil.`;
      } else if (r.isSunday) {
        mensagem = `LOJA ABERTA, mas é DOMINGO. Regras especiais: (1) Fechamento HOJE às ${r.closing}. (2) NÃO há entrega de água aos domingos — apenas retirada presencial na portaria. (3) Gás pode ser entregue normalmente. Se o cliente pedir água, informe que aos domingos só há retirada presencial até ${r.closing}.`;
      } else {
        mensagem = `Loja aberta. Horário hoje: ${r.opening} às ${r.closing}. Horário atual: ${r.currentTime}. Atendimento normal (gás e água com entrega).`;
      }
      return ok({ ...r, mensagem });
    }

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
        await upsertChamadaBia(supabase, unidade.id, {
          telefone: null,
          cliente_id: null,
          cliente_nome: null,
          observacoes: `📞 Bia perguntando telefone (0800/encaminhamento). Caller bruto: ${telefoneRaw || "vazio"}`,
        });

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

      // Busca cliente + tabela de preços em paralelo (envia preços no 1º turno).
      const [clientesRes, tp] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nome, telefone, endereco, numero, bairro, cidade, cep")
          .eq("empresa_id", empresa.id)
          .or(`telefone.ilike.%${last}%,telefone.ilike.%${last10b}%`)
          .limit(1),
        getTabelaPrecosBia(),
      ]);
      const clientes = clientesRes.data;

      const fmtMoeda = (n: number) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
      const linhasPrecos = [
        { nome: "Gás P13", ...tp.gas_p13 },
        { nome: "Gás P20", ...tp.gas_p20 },
        { nome: "Gás P45", ...tp.gas_p45 },
        { nome: "Água Mineral 20L", ...tp.agua_20l },
      ]
        .filter((i) => i.preco > 0)
        .map((i) =>
          i.preco_desconto && i.preco_desconto > 0 && i.preco_desconto < i.preco
            ? `${i.nome} ${fmtMoeda(i.preco)} (desconto ${fmtMoeda(i.preco_desconto)})`
            : `${i.nome} ${fmtMoeda(i.preco)}`
        )
        .join("; ");
      const blocoPrecos = linhasPrecos
        ? ` TABELA OFICIAL DE PREÇOS: ${linhasPrecos}. Use EXCLUSIVAMENTE estes valores. Cote primeiro o preço NORMAL; só ofereça o preço com desconto se o cliente pedir desconto. NUNCA invente valores.`
        : "";

      await upsertChamadaBia(supabase, unidade.id, {
        telefone,
        cliente_id: clientes?.[0]?.id ?? null,
        cliente_nome: clientes?.[0]?.nome ?? null,
        observacoes: clientes?.[0]
          ? `📞 Bia atendendo ${clientes[0].nome}`
          : "📞 Bia atendendo (cliente novo)",
      });

      if (clientes && clientes.length > 0) {
        const c = clientes[0];
        const enderecoFmt = `${c.endereco || ""}, ${c.numero || "s/n"} - ${c.bairro || ""}`.trim();
        return ok({
          encontrado: true,
          cliente_id: c.id,
          nome: c.nome,
          endereco_completo: enderecoFmt,
          endereco: c.endereco,
          numero: c.numero,
          bairro: c.bairro,
          cidade: c.cidade,
          tabela_precos: tp,
          mensagem:
            `Cliente identificado: ${c.nome}. Endereço cadastrado: ${enderecoFmt}. ` +
            `CONFIRME EM UMA ÚNICA FRASE CURTA: "Confirma a entrega na ${c.endereco || "rua cadastrada"}, número ${c.numero || "[peça o número]"}?". ` +
            `Se o cliente disser SIM/ISSO/CORRETO/IGUAL/MESMO LUGAR, chame criar_pedido passando APENAS cliente_id (NÃO envie endereco/numero/bairro novos — eu uso o cadastro). ` +
            `Só pergunte rua/número/bairro se o cliente disser EXPLICITAMENTE que mudou ou que é entrega em outro lugar. ` +
            `NUNCA crie cliente novo: este já existe.` +
            blocoPrecos,
        });
      }

      return ok({
        encontrado: false,
        tabela_precos: tp,
        mensagem:
          "Cliente novo. Peça apenas o PRIMEIRO NOME (não o nome completo) e o endereço (rua, número, bairro)." +
          blocoPrecos,
      });
    }

    // ============== ACTION: criar_pedido ==============
    if (action === "criar_pedido") {
      const {
        cliente_id,
        nome,
        telefone,
        produto,
        quantidade,
        forma_pagamento,
        usar_desconto,
        preco_unitario: precoUnitarioBody,
        desconto_unitario: descontoUnitarioBody,
      } = body;
      const aplicarDesconto =
        usar_desconto === true ||
        usar_desconto === "true" ||
        usar_desconto === 1 ||
        usar_desconto === "1";
      const precoNegociadoBody = Number(precoUnitarioBody);
      const descontoNegociadoBody = Number(descontoUnitarioBody);
      let { endereco, numero, bairro, cep, referencia } = body;

      if (!produto) return err("Produto é obrigatório");
      const qtdInput = quantidade ?? 1;

      // Resolve / create cliente
      let finalClienteId = cliente_id;
      let finalClienteNome = nome;

      if (finalClienteId) {
        // Cliente já existe — buscar dados cadastrados e reaproveitar endereço
        // se a Bia não enviou um novo. NUNCA criar cliente duplicado.
        const { data: clienteCad } = await supabase
          .from("clientes")
          .select("nome, endereco, numero, bairro, cep, cidade")
          .eq("id", finalClienteId)
          .maybeSingle();
        if (clienteCad) {
          finalClienteNome = finalClienteNome || clienteCad.nome;
          // Se a Bia não passou endereço, usa o cadastrado (cenário "é o mesmo de sempre")
          if (!endereco && clienteCad.endereco) endereco = clienteCad.endereco;
          if (!numero && clienteCad.numero) numero = clienteCad.numero;
          if (!bairro && clienteCad.bairro) bairro = clienteCad.bairro;
          if (!cep && clienteCad.cep) cep = clienteCad.cep;
        }
      } else {
        if (!nome || !telefone) return err("Nome e telefone obrigatórios para cliente novo");
        const telDigits = String(telefone).replace(/\D/g, "");

        // Antes de criar, tenta achar cliente por telefone para evitar duplicação
        if (telDigits.length >= 10) {
          const last10 = telDigits.slice(-10);
          const { data: existente } = await supabase
            .from("clientes")
            .select("id, nome, endereco, numero, bairro, cep")
            .eq("empresa_id", empresa.id)
            .ilike("telefone", `%${last10}%`)
            .limit(1)
            .maybeSingle();
          if (existente?.id) {
            finalClienteId = existente.id;
            finalClienteNome = existente.nome;
            if (!endereco && existente.endereco) endereco = existente.endereco;
            if (!numero && existente.numero) numero = existente.numero;
            if (!bairro && existente.bairro) bairro = existente.bairro;
            if (!cep && existente.cep) cep = existente.cep;
          }
        }

        if (!finalClienteId) {
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
          await supabase.from("cliente_unidades").insert({
            cliente_id: finalClienteId,
            unidade_id: unidade.id,
          });
        }
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

      // ===== Paraleliza: regras + tabela preços + produto lookup =====
      const [regras, tabelaPrecos, prodResult] = await Promise.all([
        getRegrasFuncionamento(),
        getTabelaPrecosBia(),
        supabase
          .from("produtos")
          .select("id, preco, nome, preco_telefone")
          .eq("unidade_id", unidade.id)
          .ilike("nome", nomeProduto)
          .limit(1)
          .maybeSingle(),
      ]);
      const prod = prodResult.data;

      if (!regras.isOpen) {
        return ok({
          sucesso: false,
          fora_horario: true,
          mensagem: regras.isSunday
            ? `NÃO crie o pedido. Loja fechada (domingo, fechamento ${regras.closing}). Informe ao cliente: "Hoje é domingo e já encerramos o atendimento às ${regras.closing}. Posso anotar para amanhã a partir das ${regras.opening}?"`
            : `NÃO crie o pedido. Loja fora do horário (${regras.opening} às ${regras.closing}). Informe educadamente ao cliente e ofereça anotar para o próximo horário de funcionamento.`,
        });
      }
      if (regras.isSunday && nomeProduto === "Água Mineral 20L") {
        return ok({
          sucesso: false,
          domingo_sem_agua: true,
          mensagem: `NÃO crie o pedido de água. Aos DOMINGOS não há entrega de água — apenas RETIRADA presencial na portaria até ${regras.closing}. Informe ao cliente: "Aos domingos não fazemos entrega de água, somente retirada presencial na portaria até as ${regras.closing}. Posso ajudar com gás?"`,
        });
      }

      if (!prod) return err(`Produto ${nomeProduto} não cadastrado na unidade`);

      // Preço base: tabela das Regras da Bia > preco_telefone > preco
      // Se a Bia passar usar_desconto=true, usa o preco_desconto da tabela.
      let precoUnitario = 0;
      const chaveTab = chaveTabelaParaProduto(nomeProduto);
      const linhaTab = chaveTab ? tabelaPrecos[chaveTab] : null;
      if (chaveTab) {
        if (aplicarDesconto && Number(linhaTab?.preco_desconto) > 0) {
          precoUnitario = Number(linhaTab!.preco_desconto);
        } else {
          precoUnitario = Number(linhaTab?.preco || 0);
        }
      }
      if (!precoUnitario) precoUnitario = Number(prod.preco_telefone || prod.preco || 0);

      // === Preço negociado livre: se a Bia mandar preco_unitario ou desconto_unitario,
      // aplica respeitando travas de segurança (não abaixo do preco_desconto da tabela,
      // ou 50% do preço cheio quando não houver preco_desconto).
      const precoBase = precoUnitario;
      const precoCheio = Number(linhaTab?.preco || 0) || precoBase;
      let candidatoNegociado: number | null = null;
      if (Number.isFinite(precoNegociadoBody) && precoNegociadoBody > 0) {
        candidatoNegociado = precoNegociadoBody;
      } else if (Number.isFinite(descontoNegociadoBody) && descontoNegociadoBody > 0) {
        candidatoNegociado = precoBase - descontoNegociadoBody;
      }
      let precoFoiNegociado = false;
      if (candidatoNegociado !== null) {
        const pisoMin = Number(linhaTab?.preco_desconto) > 0
          ? Number(linhaTab!.preco_desconto)
          : precoCheio * 0.5;
        const tetoMax = precoCheio || precoBase;
        const clamped = Math.min(Math.max(candidatoNegociado, pisoMin), tetoMax);
        if (Math.abs(clamped - precoBase) >= 0.01) {
          precoUnitario = Math.round(clamped * 100) / 100;
          precoFoiNegociado = true;
        }
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
      // mais de uma vez na mesma ligação. Janela de 15 minutos cobre ligações longas.
      // Busca por cliente_id OU pelo telefone (caso o cliente tenha sido recriado).
      const desdeIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const telDigitsLookup = String(telefone || "").replace(/\D/g, "");

      let clienteIdsLookup: string[] = [];
      if (finalClienteId) clienteIdsLookup.push(finalClienteId);
      if (telDigitsLookup && telDigitsLookup.length >= 10) {
        const last10c = telDigitsLookup.slice(-10);
        const { data: clientesMesmoTel } = await supabase
          .from("clientes")
          .select("id")
          .eq("empresa_id", empresa.id)
          .ilike("telefone", `%${last10c}%`)
          .limit(5);
        (clientesMesmoTel || []).forEach((c: any) => {
          if (!clienteIdsLookup.includes(c.id)) clienteIdsLookup.push(c.id);
        });
      }

      if (clienteIdsLookup.length > 0) {
        // Considera QUALQUER status (exceto cancelado): pedido anterior pode já ter sido despachado.
        const { data: pedidoExistente } = await supabase
          .from("pedidos")
          .select("id, numero_sequencial, valor_total, status")
          .in("cliente_id", clienteIdsLookup)
          .eq("unidade_id", unidade.id)
          .eq("canal_venda", "telefone_ia")
          .neq("status", "cancelado")
          .gte("created_at", desdeIso)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pedidoExistente) {
          console.log("[ELEVENLABS-BIA] Pedido duplicado evitado, reaproveitando:", pedidoExistente.id);
          const updates: any = {};
          if (enderecoCompleto) updates.endereco_entrega = enderecoCompleto;
          if (numero) updates.numero_entrega = numero;
          if (bairro) updates.bairro_entrega = bairro;
          if (cep) updates.cep_entrega = cep;
          if (formaPgto && formaPgto !== "a_definir") updates.forma_pagamento = formaPgto;
          if (Object.keys(updates).length > 0 && pedidoExistente.status === "pendente") {
            await supabase.from("pedidos").update(updates).eq("id", pedidoExistente.id);
          }
          return ok({
            sucesso: true,
            duplicado: true,
            pedido_id: pedidoExistente.id,
            numero_pedido: pedidoExistente.numero_sequencial,
            produto: nomeProduto,
            quantidade: qty,
            valor_total: pedidoExistente.valor_total,
            mensagem: `Pedido #${pedidoExistente.numero_sequencial} JÁ FOI REGISTRADO nesta ligação (status: ${pedidoExistente.status}). NÃO chame criar_pedido novamente. Apenas confirme verbalmente com o cliente e ENCERRE a chamada se despedindo.`,
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
          observacoes: `Pedido criado pela Bia (IA por telefone).${precoFoiNegociado ? ` [Preço negociado: R$ ${precoUnitario.toFixed(2)}/un]` : (aplicarDesconto ? " [Preço com desconto aplicado]" : "")} ${referencia ? "Ref: " + referencia : ""}`,
        })
        .select("id, numero_sequencial")
        .single();

      if (pedidoErr) {
        console.error("Erro criando pedido:", pedidoErr);
        // Índice único parcial idx_pedidos_telefone_ia_dedupe disparou: trata como duplicado.
        const isDup =
          (pedidoErr as any).code === "23505" ||
          /idx_pedidos_telefone_ia_dedupe|duplicate key/i.test(pedidoErr.message || "");
        if (isDup && finalClienteId) {
          const { data: pedidoDup } = await supabase
            .from("pedidos")
            .select("id, numero_sequencial, valor_total, status")
            .eq("cliente_id", finalClienteId)
            .eq("unidade_id", unidade.id)
            .eq("canal_venda", "telefone_ia")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (pedidoDup) {
            return ok({
              sucesso: true,
              duplicado: true,
              pedido_id: pedidoDup.id,
              numero_pedido: pedidoDup.numero_sequencial,
              produto: nomeProduto,
              quantidade: qty,
              valor_total: pedidoDup.valor_total,
              mensagem: `Pedido #${pedidoDup.numero_sequencial} já existe (bloqueado pelo banco contra duplicação). NÃO crie outro. Confirme verbalmente e finalize a ligação.`,
            });
          }
        }
        return err("Erro ao criar pedido: " + pedidoErr.message);
      }

      // Cria item do pedido — CRÍTICO: pedido NUNCA pode ficar sem item.
      // Se falhar, removemos o pedido recém-criado e retornamos erro para a Bia.
      const { error: itemErr } = await supabase.from("pedido_itens").insert({
        pedido_id: pedido.id,
        produto_id: prod.id,
        quantidade: qty,
        preco_unitario: precoUnitario,
      });
      if (itemErr) {
        console.error("[ELEVENLABS-BIA] Falha ao inserir item, removendo pedido:", pedido.id, itemErr);
        await supabase.from("pedidos").delete().eq("id", pedido.id);
        return err("Erro ao registrar item do pedido: " + itemErr.message);
      }

      // Validação de segurança: confirma que o item existe no banco
      const { count: itensCount } = await supabase
        .from("pedido_itens")
        .select("id", { count: "exact", head: true })
        .eq("pedido_id", pedido.id);
      if (!itensCount || itensCount === 0) {
        console.error("[ELEVENLABS-BIA] Pedido sem itens detectado, removendo:", pedido.id);
        await supabase.from("pedidos").delete().eq("id", pedido.id);
        return err("Pedido não pôde ser registrado (sem itens). Tente novamente.");
      }

      // === Linka a chamada ao pedido (busca janela 15min, qualquer tipo). Se não houver, cria.
      // Usa o helper para garantir consistência: 1 chamada por ligação, sempre linkada.
      try {
        const desdeChamadaIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: chamadaRecente } = await supabase
          .from("chamadas_recebidas")
          .select("id")
          .eq("unidade_id", unidade.id)
          .is("pedido_gerado_id", null)
          .gte("created_at", desdeChamadaIso)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const obs = `✅ Pedido #${pedido.numero_sequencial} criado pela Bia · R$ ${valorTotal.toFixed(2)}`;

        if (chamadaRecente?.id) {
          const { error: updErr } = await supabase
            .from("chamadas_recebidas")
            .update({
              pedido_gerado_id: pedido.id,
              cliente_id: finalClienteId,
              cliente_nome: finalClienteNome || null,
              telefone: String(telefone || "").replace(/\D/g, "") || null,
              tipo: "voip",
              observacoes: obs,
            })
            .eq("id", chamadaRecente.id);
          if (updErr) console.error("[BIA-LINK] update error:", updErr);
          else console.log("[BIA-LINK] linkou pedido", pedido.id, "→ chamada", chamadaRecente.id);
        } else {
          // Sem chamada prévia: cria já linkada
          await upsertChamadaBia(supabase, unidade.id, {
            telefone: String(telefone || "").replace(/\D/g, "") || null,
            cliente_id: finalClienteId,
            cliente_nome: finalClienteNome || null,
            observacoes: obs,
            pedido_gerado_id: pedido.id,
          });
        }
      } catch (linkErr) {
        console.error("[ELEVENLABS-BIA] Erro linkando chamada ao pedido:", linkErr);
      }

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
        preco_unitario: precoUnitario,
        preco_base: precoBase,
        preco_negociado: precoFoiNegociado,
        valor_total: valorTotal,
        forma_pagamento: formaPgto,
        mensagem:
          `Pedido #${pedido.numero_sequencial} criado com sucesso. ${qty}x ${nomeProduto} a R$ ${precoUnitario.toFixed(2)}/un${precoFoiNegociado ? " (preço negociado)" : ""}, total R$ ${valorTotal.toFixed(2)}, pagamento: ${pagamentoLabel}. ` +
          `NÃO pergunte novamente a forma de pagamento — finalize a ligação confirmando o pedido e se despedindo do cliente.`,
      });

    }

    return err("Ação inválida. Use: identificar_cliente ou criar_pedido");
  } catch (e: any) {
    console.error("[ELEVENLABS-BIA] Error:", e);
    return err(e.message || "Erro interno", 500);
  }
});
