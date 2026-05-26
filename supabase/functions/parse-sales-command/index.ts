import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(systemPrompt: string, userPrompt: string, apiKey: string, temperature = 0.1) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function extractJSON(content: string) {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    let userId = "";
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload.sub;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid token format" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUserClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Role check
    const { data: roles } = await supabaseUserClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const allowedRoles = ["admin", "gestor", "operacional", "entregador"];
    if (!roles?.some((r: any) => allowedRoles.includes(r.role))) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { comando, unidade_id } = await req.json();
    if (!comando) {
      return new Response(JSON.stringify({ error: "Comando vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);
    const apiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Pega empresa_id do profile
    const { data: profile } = await sb
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", userId)
      .maybeSingle();

    const empresaId = profile?.empresa_id;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: "Empresa não identificada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ETAPA 1: Extrair pistas + detectar intenção (venda OU consulta de fiado/notinhas)
    const extractPrompt = `Você analisa um comando do operador em português falado/digitado. Retorne APENAS JSON válido:
{
  "intencao": "venda" ou "consulta_fiado" (use "consulta_fiado" quando o operador pergunta sobre fiado, notinhas, débito, dívida, conta, o que cliente deve, quanto deve, o que tem em aberto, etc.),
  "nome": "primeiro nome ou nome completo do cliente, se mencionado, senão null",
  "telefone": "apenas dígitos do telefone, se mencionado, senão null",
  "endereco_rua": "nome da rua/avenida sem número, senão null",
  "numero": "apenas o número do endereço (string só com dígitos), senão null",
  "complemento": "apto, bloco, casa, fundos, etc, senão null",
  "bairro": "nome do bairro, se mencionado, senão null",
  "valor_informado": "número decimal quando o operador disser 'no valor de R$ X', 'por X reais', 'cobrei X', 'fica X' — sem símbolo, use ponto decimal (ex: 125 ou 125.50). null se não mencionado",
  "forma_pagamento_bruta": "texto livre da forma de pagamento se mencionado: cartão, crédito, débito, pix, dinheiro, fiado, etc. null se não mencionado"
}
Exemplos:
- "lança um P13 pra Maria da Rua das Flores 220, cartão, 125 reais" → intencao: "venda", endereco_rua: "Rua das Flores", numero: "220", valor_informado: 125, forma_pagamento_bruta: "cartão"
- "manda um gás na Aparecido Cassiano 115 apto 2, no débito, fica 120" → endereco_rua: "Aparecido Cassiano", numero: "115", complemento: "apto 2", forma_pagamento_bruta: "débito", valor_informado: 120
- "como tá o fiado da Maria?" → intencao: "consulta_fiado"
- "quanto o João deve?" → intencao: "consulta_fiado"
SEMPRE capture o número do endereço, mesmo grudado na rua ("Rua X 115", "Rua X, 115", "Rua X número 115").
Não invente dados. Use null quando incerto.`;

    const cluesContent = await callAI(extractPrompt, comando, apiKey, 0);
    const clues = extractJSON(cluesContent) || {};

    console.log("Pistas extraídas:", clues);

    // ETAPA 2: Buscar candidatos no banco via RPC
    const { data: candidatos, error: rpcError } = await sb.rpc("buscar_clientes_para_ia", {
      _empresa_id: empresaId,
      _unidade_id: unidade_id || null,
      _nome: clues.nome || null,
      _telefone: clues.telefone || null,
      _endereco_rua: clues.endereco_rua || null,
      _numero: clues.numero || null,
      _bairro: clues.bairro || null,
      _limite: 15,
    });

    if (rpcError) console.error("RPC error:", rpcError);

    // ETAPA 2.5: Se intenção é consulta de fiado/notinhas, busca contas a receber e retorna direto
    if (clues.intencao === "consulta_fiado") {
      const candidatosArr = candidatos || [];
      if (candidatosArr.length === 0) {
        return new Response(JSON.stringify({
          tipo: "consulta_fiado",
          mensagem: `Não encontrei nenhum cliente${clues.nome ? ` com o nome "${clues.nome}"` : ""} no cadastro.`,
          clientes: [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const topCandidatos = candidatosArr.slice(0, 3);
      const resultados = await Promise.all(topCandidatos.map(async (c: any) => {
        const { data: contas } = await sb
          .from("contas_receber")
          .select("id, descricao, valor, vencimento, status, forma_pagamento, created_at")
          .eq("cliente_id", c.id)
          .in("status", ["pendente", "vencido", "em_aberto", "parcial"])
          .order("vencimento", { ascending: true })
          .limit(50);

        const total = (contas || []).reduce((s: number, ct: any) => s + Number(ct.valor || 0), 0);
        const hoje = new Date().toISOString().slice(0, 10);
        const vencidas = (contas || []).filter((ct: any) => ct.vencimento && ct.vencimento < hoje);
        const totalVencido = vencidas.reduce((s: number, ct: any) => s + Number(ct.valor || 0), 0);

        return {
          cliente_id: c.id,
          nome: c.nome,
          telefone: c.telefone,
          endereco: `${c.endereco || ''}${c.numero ? ', ' + c.numero : ''}${c.bairro ? ' - ' + c.bairro : ''}`.trim(),
          total_aberto: total,
          total_vencido: totalVencido,
          qtd_titulos: (contas || []).length,
          qtd_vencidos: vencidas.length,
          titulos: (contas || []).slice(0, 10).map((ct: any) => ({
            descricao: ct.descricao,
            valor: Number(ct.valor || 0),
            vencimento: ct.vencimento,
            status: ct.status,
            vencido: ct.vencimento && ct.vencimento < hoje,
          })),
        };
      }));

      const principal = resultados[0];
      let mensagem = "";
      if (principal.qtd_titulos === 0) {
        mensagem = `✅ ${principal.nome} não tem nada em aberto. Está em dia!`;
      } else {
        mensagem = `📋 ${principal.nome} tem ${principal.qtd_titulos} título(s) em aberto somando R$ ${principal.total_aberto.toFixed(2)}`;
        if (principal.qtd_vencidos > 0) {
          mensagem += `, sendo ${principal.qtd_vencidos} vencido(s) (R$ ${principal.total_vencido.toFixed(2)}).`;
        } else {
          mensagem += ` (todos no prazo).`;
        }
        if (principal.titulos.length > 0) {
          mensagem += `\n\nÚltimos:\n` + principal.titulos.slice(0, 5).map((t: any) =>
            `• ${t.vencimento || 's/ venc'} — R$ ${t.valor.toFixed(2)}${t.vencido ? ' ⚠️ vencido' : ''}${t.descricao ? ' — ' + t.descricao : ''}`
          ).join("\n");
        }
      }

      return new Response(JSON.stringify({
        tipo: "consulta_fiado",
        mensagem,
        clientes: resultados,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Carrega produtos (geralmente são poucos)
    const { data: produtos } = await sb
      .from("produtos")
      .select("id, nome, preco, estoque, categoria")
      .eq("ativo", true)
      .or("tipo_botijao.is.null,tipo_botijao.neq.vazio")
      .limit(100);

    const candidatosList = (candidatos || []).length > 0
      ? (candidatos || []).map((c: any) =>
          `- id:${c.id} | "${c.nome}" | tel:${c.telefone || '-'} | ${c.endereco || '-'}, ${c.numero || 's/n'} - ${c.bairro || '-'}`
        ).join("\n")
      : "(nenhum cliente similar encontrado no banco)";

    const produtosList = (produtos || []).map((p: any) =>
      `- "${p.nome}" R$${p.preco} (id: ${p.id})`
    ).join("\n");

    // ETAPA 3: IA escolhe o cliente correto e monta a venda
    const systemPrompt = `Você é um assistente de vendas de uma distribuidora de gás. Interprete o comando do usuário e retorne JSON estruturado para lançar a venda.

PISTAS JÁ EXTRAÍDAS DO COMANDO (use como referência):
${JSON.stringify(clues, null, 2)}

CANDIDATOS DE CLIENTE (já filtrados por similaridade de nome/telefone/endereço):
${candidatosList}

PRODUTOS DISPONÍVEIS:
${produtosList}

REGRAS CRÍTICAS:
1. SEMPRE prefira reutilizar um cliente da lista de candidatos. Se houver candidato cujo NOME e/ou ENDEREÇO bate com o comando, use o id dele em "cliente_id". NÃO crie cliente novo nesse caso.
2. Se NENHUM candidato bater de forma plausível, retorne "cliente_id": null e preencha os campos de endereço com base no comando.
3. Para identificar o produto: "gás", "botijão", "P13" → procure o produto correspondente (geralmente "Gás P13"). "1 gás" significa quantidade 1. Use sempre o produto cheio (não vazio).
4. Quantidade padrão = 1 se não especificada.
5. Forma de pagamento — MAPEAMENTO OBRIGATÓRIO:
   - "cartão" sozinho (sem qualificador) → "cartao_credito"
   - "crédito", "no crédito", "cartão de crédito" → "cartao_credito"
   - "débito", "no débito", "cartão de débito" → "cartao_debito"
   - "pix" → "pix"
   - "dinheiro", "à vista" → "dinheiro"
   - "fiado", "anota", "depois pago" → "fiado"
   - Use null APENAS se nenhuma forma foi mencionada.
6. canal_venda: telefone|whatsapp|balcao|portaria. Padrão "telefone".
7. PREÇO: Se as pistas trazem "valor_informado" preenchido, use esse valor como preco_unitario do(s) item(ns) (divida pelo total de unidades se houver múltiplas quantidades). Caso contrário, use o preço cadastrado do produto.
8. Comandos por voz podem ter erros de transcrição — interprete da melhor forma.
9. Preencha "complemento" se as pistas trouxerem.

Retorne APENAS JSON neste formato:
{
  "cliente_id": "uuid_do_candidato_ou_null",
  "cliente_nome": "nome",
  "cliente_telefone": "telefone ou null",
  "endereco": "rua sem número",
  "numero": "número ou null",
  "complemento": "ou null",
  "bairro": "ou null",
  "cep": "ou null",
  "cidade": "ou null",
  "itens": [{ "produto_id": "uuid", "nome": "nome", "quantidade": 1, "preco_unitario": 125 }],
  "forma_pagamento": "dinheiro|pix|cartao_credito|cartao_debito|fiado|null",
  "canal_venda": "telefone|whatsapp|balcao|portaria",
  "observacoes": "info extra do comando ou string vazia"
}`;

    const finalContent = await callAI(systemPrompt, comando, apiKey, 0.1);
    const parsed = extractJSON(finalContent);

    if (!parsed) {
      return new Response(JSON.stringify({ error: "Não foi possível interpretar o comando", raw: finalContent }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reforço de segurança: se valor_informado existir e a IA não aplicou, sobrescreve preco_unitario
    const valorInformado = Number(clues.valor_informado);
    if (!Number.isNaN(valorInformado) && valorInformado > 0 && Array.isArray(parsed.itens) && parsed.itens.length > 0) {
      const totalQtd = parsed.itens.reduce((s: number, i: any) => s + (Number(i.quantidade) || 1), 0);
      const precoUnit = valorInformado / Math.max(totalQtd, 1);
      parsed.itens = parsed.itens.map((i: any) => ({ ...i, preco_unitario: precoUnit }));
      parsed.preco_manual = true;
    }

    // Reforço: mapeia forma_pagamento_bruta se IA deixou null
    if (!parsed.forma_pagamento && clues.forma_pagamento_bruta) {
      const fp = String(clues.forma_pagamento_bruta).toLowerCase();
      if (fp.includes("débito") || fp.includes("debito")) parsed.forma_pagamento = "cartao_debito";
      else if (fp.includes("crédito") || fp.includes("credito")) parsed.forma_pagamento = "cartao_credito";
      else if (fp.includes("cartão") || fp.includes("cartao")) parsed.forma_pagamento = "cartao_credito";
      else if (fp.includes("pix")) parsed.forma_pagamento = "pix";
      else if (fp.includes("dinheiro") || fp.includes("vista")) parsed.forma_pagamento = "dinheiro";
      else if (fp.includes("fiado") || fp.includes("anota") || fp.includes("depois")) parsed.forma_pagamento = "fiado";
    }

    // Reforço: complemento das pistas se IA não trouxe
    if (!parsed.complemento && clues.complemento) parsed.complemento = clues.complemento;
    if (!parsed.numero && clues.numero) parsed.numero = clues.numero;

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Erro ao processar comando. Tente novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
