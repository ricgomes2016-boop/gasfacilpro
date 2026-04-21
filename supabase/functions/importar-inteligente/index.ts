// Importação inteligente: ZIP de XMLs, PDFs (notas/boletos), extratos OFX/CSV/PDF, planilhas XLSX/CSV
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

// Parse XML para extrair CNPJ destinatário/emitente, valor, número, chave
function parseXmlMetadata(xml: string) {
  const get = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    return m ? m[1].trim() : undefined;
  };
  const getIn = (parent: string, tag: string) => {
    const block = xml.match(new RegExp(`<${parent}[\\s\\S]*?</${parent}>`, "i"));
    if (!block) return undefined;
    const m = block[0].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    return m ? m[1].trim() : undefined;
  };

  let tipo = "nfe";
  if (/<NFe[\s>]/i.test(xml) && /modelo>65</i.test(xml)) tipo = "nfce";
  else if (/<CTe[\s>]/i.test(xml)) tipo = "cte";
  else if (/<MDFe[\s>]/i.test(xml)) tipo = "mdfe";

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

// Pede para IA mapear colunas de CSV/XLSX livre ou extrair dados de texto
async function aiExtractFromText(text: string, hint: string): Promise<any> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: `Você é especialista em documentos fiscais brasileiros. Extraia dados estruturados de ${hint}. Retorne APENAS JSON válido, sem markdown.` },
          { role: "user", content: `Conteúdo:\n${text.slice(0, 6000)}\n\nExtraia: tipo (nota_fiscal/boleto/recibo/extrato/desconhecido), cnpj_emitente, cnpj_destinatario, nome_emitente, nome_destinatario, numero_documento, valor_total (number), data_emissao (YYYY-MM-DD), data_vencimento (YYYY-MM-DD), descricao. Use null para campos ausentes.` }
        ],
      }),
    });
    if (!resp.ok) {
      console.error(`AI ${resp.status}: ${await resp.text()}`);
      return {};
    }
    const data = await resp.json();
    const txt = data.choices?.[0]?.message?.content || "{}";
    const clean = txt.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("aiExtractFromText error:", e);
    return {};
  }
}

function matchUnidade(cnpj: string | undefined, unidades: UnidadeRef[]): UnidadeRef | null {
  if (!cnpj) return null;
  const digits = onlyDigits(cnpj);
  if (!digits) return null;
  return unidades.find(u => onlyDigits(u.cnpj) === digits) || null;
}

// Processamento INLINE de XML (sem invocar outra função)
async function processarXmlInline(
  supabase: any,
  xml: string,
  nomeOrig: string,
  empresa_id: string,
  unidade_id: string,
) {
  const meta = parseXmlMetadata(xml);

  // Anti-duplicidade
  if (meta.chave) {
    const { data: existing } = await supabase.from("notas_fiscais")
      .select("id").eq("chave_acesso", meta.chave).maybeSingle();
    if (existing) return { duplicate: true, id: existing.id, meta };
  }

  // Upload XML
  const path = `${empresa_id}/${unidade_id}/${meta.chave ?? `nf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}.xml`;
  const { error: upErr } = await supabase.storage.from("contabil-xmls")
    .upload(path, new Blob([xml], { type: "application/xml" }), { upsert: false });
  if (upErr && !upErr.message.includes("already exists")) {
    console.warn("upload xml:", upErr.message);
  }

    const { data: inserted, error } = await supabase.from("notas_fiscais").insert({
      chave_acesso: meta.chave,
      numero: meta.numero,
      serie: meta.serie,
      tipo: meta.tipo,
      valor_total: meta.valor || 0,
      data_emissao: meta.data ? new Date(meta.data).toISOString() : null,
      remetente_nome: meta.emit_nome,
      remetente_cpf_cnpj: meta.cnpj_emit,
      destinatario_nome: meta.dest_nome,
      destinatario_cpf_cnpj: meta.cnpj_dest,
      xml_url: path,
      xml_conteudo: xml,
      xml_importado: true,
      status: "importado",
      unidade_id,
    }).select("id").single();

  if (error) throw new Error(error.message);
  return { duplicate: false, id: inserted.id, meta };
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
        if (!targetUnidade) {
          erros++;
          resultados.push({ nome: nomeOrig, erro: "Sem unidade alvo (cadastre CNPJ nas unidades)" });
          return;
        }

        const result = await processarXmlInline(supabase, xml, nomeOrig, empresa_id, targetUnidade);
        if (result.duplicate) duplicados++; else criados++;
        resultados.push({
          nome: nomeOrig, tipo: meta.tipo, chave: meta.chave,
          unidade_id: targetUnidade, unidade_nome: unidadeMatch?.nome || "(padrão)",
          cnpj_dest: meta.cnpj_dest, valor: meta.valor,
          status: result.duplicate ? "duplicado" : "criado",
          confianca: unidadeMatch ? 1.0 : 0.5,
        });
      } catch (e: any) {
        erros++;
        resultados.push({ nome: nomeOrig, erro: e.message || String(e) });
      }
    };

    // ZIP: extrair e processar cada XML em lotes paralelos
    if (tipo === "zip") {
      const zip = await JSZip.loadAsync(bytes);
      const files = Object.values(zip.files).filter((f: any) => !f.dir && f.name.toLowerCase().endsWith(".xml"));
      console.log(`ZIP: ${files.length} XMLs encontrados`);

      const BATCH = 8;
      for (let i = 0; i < files.length; i += BATCH) {
        const slice = files.slice(i, i + BATCH);
        await Promise.all(slice.map(async (f: any) => {
          const content = await f.async("string");
          await processarXml(content, f.name);
        }));
      }
    } else if (tipo === "rar") {
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
      // PDF: extração de texto bruta + IA (sem image_url, que não funciona com PDFs)
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      // Heurística: pega trechos legíveis (entre BT/ET ou entre parênteses)
      const matches = text.match(/\(([^)]{2,200})\)/g) || [];
      const textoLegivel = matches.map(m => m.slice(1, -1)).join(" ").slice(0, 4000);

      if (textoLegivel.length > 50) {
        const extraido = await aiExtractFromText(textoLegivel, "PDF de nota fiscal ou boleto");
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
            observacoes: `Importação automática IA: ${fileName}`,
          });
          if (error) {
            erros++;
            resultados.push({ nome: fileName, erro: error.message });
          } else {
            criados++;
            resultados.push({ nome: fileName, tipo: "despesa", unidade_nome: unidadeMatch?.nome || "(padrão)", ...extraido, confianca });
          }
        } else {
          resultados.push({ nome: fileName, ...extraido, confianca, status: "revisao", motivo: "Dados insuficientes para criar despesa automaticamente" });
        }
      } else {
        resultados.push({
          nome: fileName,
          status: "revisao",
          confianca: 0.2,
          motivo: "PDF parece ser escaneado (imagem). Use OCR externo ou converta para texto.",
        });
      }
    } else if (tipo === "ofx" || tipo === "csv" || tipo === "xlsx") {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 8000));
      const linhas = text.split(/\r?\n/).slice(0, 8);
      resultados.push({
        nome: fileName, tipo, status: "revisao",
        preview: linhas, confianca: 0.5,
        motivo: "Extratos e planilhas precisam de revisão manual antes da importação.",
      });
    } else {
      resultados.push({
        nome: fileName, tipo: "desconhecido", status: "revisao", confianca: 0,
        motivo: `Formato não suportado: ${tipo}`,
      });
    }

    const totalProc = resultados.length;
    const status = erros > 0 && criados === 0
      ? "erro"
      : (resultados.some(r => r.status === "revisao") ? "revisao" : "concluido");

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
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
