import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const normalize = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function bestMatch(
  needle: string,
  list: { id: string; nome: string }[]
): string | null {
  if (!needle) return null;
  const n = normalize(needle);
  if (!n) return null;
  // exact
  for (const it of list) if (normalize(it.nome) === n) return it.id;
  // inclusion
  for (const it of list) {
    const x = normalize(it.nome);
    if (x.includes(n) || n.includes(x)) return it.id;
  }
  // token overlap
  const tokens = n.split(" ").filter((t) => t.length > 2);
  let best: { id: string; score: number } | null = null;
  for (const it of list) {
    const x = normalize(it.nome);
    const score = tokens.reduce((s, t) => (x.includes(t) ? s + 1 : s), 0);
    if (score > 0 && (!best || score > best.score)) best = { id: it.id, score };
  }
  return best?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, erro: "LOVABLE_API_KEY não configurada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { fileBase64, mimeType, parceiros = [], produtos = [] } = body || {};

    if (!fileBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ ok: false, erro: "Arquivo ausente" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sysPrompt = `Você lê Notas de Empenho de órgãos públicos brasileiros (prefeituras, estados, autarquias). Extraia os dados solicitados estritamente do documento. Para datas use formato YYYY-MM-DD. Valores numéricos sempre em ponto decimal (ex: 102.50). Se um campo não estiver claro, retorne null.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "registrar_empenho",
          description: "Registra os dados extraídos da nota de empenho, incluindo todos os itens (produtos) listados",
          parameters: {
            type: "object",
            properties: {
              numero_empenho: { type: "string", description: "Número do empenho, ex: 2747/2026" },
              data_empenho: { type: "string", description: "Data do empenho YYYY-MM-DD" },
              orgao_nome: { type: "string", description: "Nome do órgão público / credor da despesa" },
              itens: {
                type: "array",
                description: "Lista de TODOS os itens/produtos do empenho. Empenhos podem ter múltiplos produtos.",
                items: {
                  type: "object",
                  properties: {
                    produto_descricao: { type: "string", description: "Descrição do produto/item" },
                    quantidade: { type: "number" },
                    valor_unitario: { type: "number" },
                  },
                  required: ["produto_descricao", "quantidade", "valor_unitario"],
                  additionalProperties: false,
                },
              },
              observacoes: { type: "string", description: "Resumo curto do que foi lido" },
            },
            required: ["numero_empenho", "itens"],
            additionalProperties: false,
          },
        },
      },
    ];

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const userContent: any[] = [
      { type: "text", text: "Extraia os campos da Nota de Empenho em anexo." },
    ];
    if (mimeType.startsWith("image/")) {
      userContent.push({ type: "image_url", image_url: { url: dataUrl } });
    } else {
      // PDF / outros → gateway aceita image_url com data URL multimodal
      userContent.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "registrar_empenho" } },
      }),
    });

    if (resp.status === 429) {
      return new Response(
        JSON.stringify({ ok: false, erro: "Limite de requisições da IA atingido. Tente novamente em instantes." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (resp.status === 402) {
      return new Response(
        JSON.stringify({ ok: false, erro: "Créditos de IA esgotados. Adicione saldo em Workspace > Usage." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("Gateway error:", resp.status, t);
      return new Response(
        JSON.stringify({ ok: false, erro: "Falha ao chamar IA" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const json = await resp.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(
        JSON.stringify({ ok: false, erro: "IA não retornou os campos esperados" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let args: any = {};
    try { args = JSON.parse(call.function.arguments || "{}"); } catch { args = {}; }

    const parceiro_id_sugerido = bestMatch(args.orgao_nome || "", parceiros);
    const produto_id_sugerido = bestMatch(args.produto_descricao || "", produtos);

    return new Response(
      JSON.stringify({
        ok: true,
        dados: {
          numero_empenho: args.numero_empenho ?? "",
          data_empenho: args.data_empenho ?? null,
          orgao_nome: args.orgao_nome ?? "",
          parceiro_id_sugerido,
          produto_descricao: args.produto_descricao ?? "",
          produto_id_sugerido,
          quantidade: Number(args.quantidade) || 0,
          valor_unitario: Number(args.valor_unitario) || 0,
          observacoes: args.observacoes ?? "",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extrair-empenho-ia error:", e);
    return new Response(
      JSON.stringify({ ok: false, erro: e instanceof Error ? e.message : "Erro inesperado" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
