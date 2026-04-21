// Importação inteligente: ZIP/RAR de XMLs, PDFs (notas/boletos), extratos OFX/CSV/PDF, planilhas XLSX/CSV
// Roteia automaticamente para a unidade correta via CNPJ destinatário.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface UnidadeRef { id: string; nome: string; cnpj: string | null; }

const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

function detectFileType(name: string, mime: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".rar")) return "rar";
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".ofx")) return "ofx";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "xlsx";
  if (mime.includes("zip")) return "zip";
  if (mime.includes("xml")) return "xml";
  if (mime.includes("pdf")) return "pdf";
  return "desconhecido";
}

// Parse simples de XML para extrair CNPJ destinatário/emitente, valor, número, chave
function parseXmlMetadata(xml: string): { tipo: string; chave?: string; cnpj_dest?: string; cnpj_emit?: string; numero?: string; serie?: string; valor?: number; data?: string; emit_nome?: string; dest_nome?: string } {
  const get = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i"));
    return m ? m[1].trim() : undefined;
  };
  const getIn = (parent: string, tag: string) => {
    const block = xml.match(new RegExp(`<${parent}[\\s\\S]*?</${parent}>`, "i"));
    if (!block) return undefined;
    const m = block[0].match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i"));
    return m ? m[1].trim() : undefined;
  };

  let tipo = "xml";
  if (xml.includes("<NFe") || xml.includes("infNFe")) tipo = xml.includes("mod>65<") ? "xml_nfce" : "xml_nfe";
  else if (xml.includes("<CTe") || xml.includes("infCte")) tipo = "xml_cte";
  else if (xml.includes("<MDFe") || xml.includes("infMDFe")) tipo = "xml_mdfe";

  const chave = (xml.match(/Id="NFe(\d{44})"/) || xml.match(/Id="CTe(\d{44})"/) || xml.match(/Id="MDFe(\d{44})"/) || [])[1]
    || get("chNFe") || get("chCTe");

  return {
    tipo,
    chave,
    cnpj_emit: getIn("emit", "CNPJ"),
    cnpj_dest: getIn("dest", "CNPJ") || getIn("dest", "CPF"),
    emit_nome: getIn("emit", "xNome"),
    dest_nome: getIn("dest", "xNome"),
    numero: get("nNF") || get("nCT"),
    serie: get("serie"),
    valor: parseFloat(get("vNF") || get("vTPrest") || "0") || undefined,
    data: get("dhEmi") || get("dEmi"),
  };
}

// Extrai texto de PDF (uso simples: pega texto entre BT/ET via heurística leve)
async function pdfToBase64(bytes: Uint8Array): Promise<string> {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Pede para a IA extrair CNPJ + dados estruturados de um documento (PDF/imagem)
async function aiExtractFromDocument(base64: string, mime: string, hint: string): Promise<any> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: `Você é especialista em documentos fiscais brasileiros. Extraia dados estruturados de ${hint}. Retorne APENAS JSON.` },
        { role: "user", content: [
          { type: "text", text: `Extraia: tipo (nota_fiscal/boleto/recibo/extrato/desconhecido), cnpj_emitente, cnpj_destinatario, nome_emitente, nome_destinatario, numero_documento, valor_total (number), data_emissao (YYYY-MM-DD), data_vencimento (YYYY-MM-DD), descricao. Use null para campos ausentes. Retorne JSON puro, sem markdown.` },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
        ]}
      ],
    }),
  });
  if (!resp.ok) throw new Error(`AI error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const txt = data.choices?.[0]?.message?.content || "{}";
  const clean = txt.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(clean); } catch { return {}; }
}

// Pede para IA mapear colunas de CSV/XLSX livre
async function aiMapSpreadsheet(headers: string[], sampleRows: any[][]): Promise<any> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "Você analisa cabeçalhos de planilha e mapeia para campos financeiros. Retorne APENAS JSON." },
        { role: "user", content: `Cabeçalhos: ${JSON.stringify(headers)}\nAmostra: ${JSON.stringify(sampleRows.slice(0, 3))}\n\nMapeie para: { "data": "<nome_coluna>", "descricao": "<nome_coluna>", "valor": "<nome_coluna>", "tipo": "<entrada|saida|despesa>" }. Use null se não encontrar.` }
      ],
    }),
  });
  if (!resp.ok) return {};
  const data = await resp.json();
  const txt = data.choices?.[0]?.message?.content || "{}";
  const clean = txt.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(clean); } catch { return {}; }
}

function matchUnidade(cnpj: string | undefined, unidades: UnidadeRef[]): UnidadeRef | null {
  if (!cnpj) return null;
  const digits = onlyDigits(cnpj);
  return unidades.find(u => onlyDigits(u.cnpj) === digits) || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { fileBase64, fileName, fileMime, empresa_id, unidade_id_padrao, destino = "auto" } = await req.json();
    if (!fileBase64 || !fileName || !empresa_id) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Carrega unidades da empresa para roteamento por CNPJ
    const { data: unidadesData } = await supabase
      .from("unidades")
      .select("id, nome, cnpj")
      .eq("empresa_id", empresa_id)
      .eq("ativo", true);
    const unidades: UnidadeRef[] = unidadesData || [];

    // Decode base64
    const raw = fileBase64.split(",").pop() || fileBase64;
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    const tipo = detectFileType(fileName, fileMime || "");

    // Cria registro de importação
    const { data: imp, error: impErr } = await supabase
      .from("importacoes_inteligentes")
      .insert({
        empresa_id, unidade_id: unidade_id_padrao || null, user_id: user.id,
        destino, arquivo_nome: fileName, arquivo_mime: fileMime, arquivo_tamanho: bytes.length,
        tipo_detectado: tipo, status: "processando",
      })
      .select().single();
    if (impErr) throw impErr;

    // Salva original no storage
    const storagePath = `${empresa_id}/${imp.id}/${fileName}`;
    await supabase.storage.from("contabil-importacoes").upload(storagePath, bytes, {
      contentType: fileMime || "application/octet-stream", upsert: false,
    });
    await supabase.from("importacoes_inteligentes").update({ arquivo_path: storagePath }).eq("id", imp.id);

    const resultados: any[] = [];
    let criados = 0, duplicados = 0, erros = 0;

    const processarXml = async (xml: string, nomeOrig: string) => {
      try {
        const meta = parseXmlMetadata(xml);
        const unidadeMatch = matchUnidade(meta.cnpj_dest, unidades) || matchUnidade(meta.cnpj_emit, unidades);
        const targetUnidade = unidadeMatch?.id || unidade_id_padrao || unidades[0]?.id;
        if (!targetUnidade) { erros++; resultados.push({ nome: nomeOrig, erro: "Sem unidade alvo" }); return; }

        // Chama parse-nfe-xml já existente
        const { data, error } = await supabase.functions.invoke("parse-nfe-xml", {
          body: { xml, filename: nomeOrig, empresa_id, unidade_id: targetUnidade },
        });
        if (error) throw error;
        if (data?.duplicate) duplicados++; else criados++;
        resultados.push({
          nome: nomeOrig, tipo: meta.tipo, chave: meta.chave,
          unidade_id: targetUnidade, unidade_nome: unidadeMatch?.nome,
          cnpj_dest: meta.cnpj_dest, valor: meta.valor, status: data?.duplicate ? "duplicado" : "criado",
          confianca: unidadeMatch ? 1.0 : 0.5,
        });
      } catch (e: any) {
        erros++;
        resultados.push({ nome: nomeOrig, erro: e.message });
      }
    };

    // ZIP: extrair e processar cada XML
    if (tipo === "zip") {
      const zip = await JSZip.loadAsync(bytes);
      const files = Object.values(zip.files).filter((f: any) => !f.dir && f.name.toLowerCase().endsWith(".xml"));
      for (const f of files as any[]) {
        const content = await f.async("string");
        await processarXml(content, f.name);
      }
    } else if (tipo === "rar") {
      // RAR: aviso (não suportado nativamente em Deno) — pedir ZIP
      await supabase.from("importacoes_inteligentes").update({
        status: "erro", mensagem_erro: "Formato RAR não suportado. Por favor, envie ZIP.",
      }).eq("id", imp.id);
      return new Response(JSON.stringify({ error: "RAR não suportado, use ZIP" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (tipo === "xml") {
      const xml = new TextDecoder("utf-8").decode(bytes);
      await processarXml(xml, fileName);
    } else if (tipo === "pdf") {
      // PDF: usa IA para extrair dados; rota para despesas
      const b64 = await pdfToBase64(bytes);
      const extraido = await aiExtractFromDocument(b64, "application/pdf", "PDF de nota fiscal ou boleto");
      const cnpjDest = extraido.cnpj_destinatario || extraido.cnpj_emitente;
      const unidadeMatch = matchUnidade(cnpjDest, unidades);
      const targetUnidade = unidadeMatch?.id || unidade_id_padrao || unidades[0]?.id;
      const confianca = unidadeMatch ? 0.85 : 0.4;

      if (extraido.valor_total && targetUnidade) {
        const { error } = await supabase.from("despesas" as any).insert({
          unidade_id: targetUnidade,
          descricao: extraido.descricao || `${extraido.tipo || "Documento"} ${extraido.numero_documento || fileName}`,
          valor: extraido.valor_total,
          data_vencimento: extraido.data_vencimento || extraido.data_emissao || new Date().toISOString().slice(0, 10),
          status: "pendente",
          observacoes: `Importação automática: ${fileName}`,
        });
        if (error) { erros++; resultados.push({ nome: fileName, erro: error.message }); }
        else { criados++; resultados.push({ nome: fileName, tipo: "despesa", unidade_nome: unidadeMatch?.nome, ...extraido, confianca }); }
      } else {
        resultados.push({ nome: fileName, ...extraido, confianca, status: "revisao" });
      }
    } else if (tipo === "ofx" || tipo === "csv" || tipo === "xlsx") {
      // Para extratos/planilhas: extrai cabeçalhos via texto e marca para revisão manual
      const text = new TextDecoder("utf-8").decode(bytes.slice(0, 4000));
      const linhas = text.split(/\r?\n/).slice(0, 5);
      resultados.push({ nome: fileName, tipo, status: "revisao", preview: linhas, confianca: 0.5 });
    }

    const totalProc = resultados.length;
    const status = erros > 0 && criados === 0 ? "erro" : (resultados.some(r => r.status === "revisao") ? "revisao" : "concluido");

    await supabase.from("importacoes_inteligentes").update({
      status,
      registros_processados: totalProc,
      registros_criados: criados,
      registros_duplicados: duplicados,
      registros_erro: erros,
      dados_extraidos: { resultados },
      processado_em: new Date().toISOString(),
      confianca: resultados.length ? resultados.reduce((s, r) => s + (r.confianca || 0), 0) / resultados.length : null,
    }).eq("id", imp.id);

    return new Response(JSON.stringify({
      importacao_id: imp.id, status,
      total: totalProc, criados, duplicados, erros, resultados,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("importar-inteligente erro:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
