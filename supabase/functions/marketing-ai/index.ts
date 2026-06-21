import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      type, platform, topic, tone, imagePrompt,
      empresa_id, unidade_id, save,
      brandName, cidade, whatsapp, instagram,
    } = body;

    const toneGuides: Record<string, string> = {
      informal: "Use linguagem informal, gírias leves e muitos emojis.",
      promocional: "Foco em urgência, escassez e call-to-action forte. Use palavras como 'últimas unidades', 'só hoje', 'aproveite'.",
      profissional: "Tom profissional e amigável. Educado mas acessível, sem gírias.",
    };

    // === Carrega Brand Kit do banco (sobrepõe valores recebidos do cliente) ===
    let brand = (brandName || "").toString().trim();
    let kitCidade = (cidade || "").toString().trim();
    let kitWhats = (whatsapp || "").toString().trim();
    let kitInsta = (instagram || "").toString().trim();
    let kitSlogan = "";
    let kitDescricao = "";
    let kitHashtags = "";
    let kitProibidas = "";
    let kitBairros = "";
    let kitFacebook = "";
    let kitTiktok = "";
    let kitLinkApp = "";
    let kitTomVoz = "";

    if (empresa_id) {
      try {
        const supaUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supa = createClient(supaUrl, serviceKey);

        let kit: any = null;
        if (unidade_id) {
          const { data } = await supa
            .from("marketing_brand_kit").select("*")
            .eq("empresa_id", empresa_id).eq("unidade_id", unidade_id).maybeSingle();
          kit = data;
        }
        if (!kit) {
          const { data } = await supa
            .from("marketing_brand_kit").select("*")
            .eq("empresa_id", empresa_id).is("unidade_id", null).maybeSingle();
          kit = data;
        }
        if (kit) {
          kitSlogan = (kit.slogan || "").toString();
          kitDescricao = (kit.descricao_curta || "").toString();
          kitHashtags = (kit.hashtags_fixas || "").toString();
          kitProibidas = (kit.frases_proibidas || "").toString();
          kitBairros = (kit.bairros_atendidos || "").toString();
          kitFacebook = (kit.facebook || "").toString();
          kitTiktok = (kit.tiktok || "").toString();
          kitLinkApp = (kit.link_app || "").toString();
          kitTomVoz = (kit.tom_voz || "").toString();
          if (!kitWhats && kit.whatsapp) kitWhats = kit.whatsapp;
          if (!kitInsta && kit.instagram) kitInsta = kit.instagram;
        }

        if (!brand || !kitCidade) {
          if (unidade_id) {
            const { data: uni } = await supa
              .from("unidades").select("nome, cidade, telefone")
              .eq("id", unidade_id).maybeSingle();
            if (uni) {
              if (!brand) brand = uni.nome || "";
              if (!kitCidade) kitCidade = uni.cidade || "";
              if (!kitWhats) kitWhats = uni.telefone || "";
            }
          }
          if (!brand) {
            const { data: emp } = await supa
              .from("empresas").select("nome, nome_fantasia, razao_social")
              .eq("id", empresa_id).maybeSingle();
            if (emp) brand = (emp as any).nome_fantasia || emp.nome || (emp as any).razao_social || "";
          }
        }
      } catch (e) {
        console.warn("brand kit load failed", e);
      }
    }

    const brandLines: string[] = [];
    if (brand) {
      brandLines.push(`- Nome da revenda: "${brand}"${kitCidade ? ` (cidade: ${kitCidade})` : ""}`);
      brandLines.push(`- SEMPRE use exatamente "${brand}" quando precisar citar a marca.`);
      brandLines.push(`- NUNCA invente outros nomes (ex.: "Gás Express", "Gás Rápido", "Gás Já", "GásFácil").`);
    }
    if (kitSlogan) brandLines.push(`- Slogan/identidade: "${kitSlogan}"`);
    if (kitDescricao) brandLines.push(`- Sobre a revenda: ${kitDescricao}`);
    if (kitTomVoz) brandLines.push(`- Tom de voz preferido: ${kitTomVoz}`);
    if (kitWhats) brandLines.push(`- WhatsApp para CTA: ${kitWhats}`);
    if (kitInsta) brandLines.push(`- Instagram: @${String(kitInsta).replace(/^@/, "")}`);
    if (kitFacebook) brandLines.push(`- Facebook: ${kitFacebook}`);
    if (kitTiktok) brandLines.push(`- TikTok: @${String(kitTiktok).replace(/^@/, "")}`);
    if (kitBairros) brandLines.push(`- Bairros atendidos: ${kitBairros}`);
    if (kitLinkApp) brandLines.push(`- Link do app/site: ${kitLinkApp}`);
    if (kitHashtags) brandLines.push(`- Hashtags fixas a sempre incluir: ${kitHashtags}`);
    if (kitProibidas) brandLines.push(`- PROIBIDO mencionar / palavras a evitar: ${kitProibidas}`);
    brandLines.push(`- Não escreva nomes de marcas concorrentes.`);

    const brandBlock = brandLines.length
      ? `\n\n=== IDENTIDADE DA MARCA (OBRIGATÓRIO) ===\n${brandLines.join("\n")}\n=========================================`
      : `\n\nIMPORTANTE: NÃO invente nomes de marca. Escreva de forma genérica usando "nossa revenda".`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // === TTS / Narração para Reels & Shorts ===
    if (type === "tts") {
      const text = (body.text || body.input || "").toString().trim();
      const voice = (body.voice || "alloy").toString();
      if (!text) {
        return new Response(JSON.stringify({ error: "Texto vazio" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Cap conservador para evitar 400 do provedor
      const safeText = text.slice(0, 4000);
      const ttsResp = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts",
          input: safeText,
          voice,
          response_format: "mp3",
          instructions: "Voz brasileira clara e amigável, ritmo dinâmico para vídeo curto de marketing. Empolgação moderada, sem exageros.",
        }),
      });
      if (!ttsResp.ok) {
        const status = ttsResp.status;
        const errText = await ttsResp.text().catch(() => "");
        if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: `TTS error: ${status} ${errText.slice(0, 200)}` }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const audioBuffer = await ttsResp.arrayBuffer();
      const audioBytes = new Uint8Array(audioBuffer);

      // Tenta salvar no bucket
      try {
        if (empresa_id) {
          const supaUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supa = createClient(supaUrl, serviceKey);
          const fileName = `audio/${empresa_id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.mp3`;
          const { error: upErr } = await supa.storage.from("marketing-assets").upload(fileName, audioBytes, { contentType: "audio/mpeg", upsert: false });
          if (!upErr) {
            const { data: pub } = supa.storage.from("marketing-assets").getPublicUrl(fileName);
            return new Response(JSON.stringify({ audio_url: pub.publicUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch (e) { console.error("TTS save err:", e); }

      // Fallback: base64
      let binary = "";
      for (let i = 0; i < audioBytes.length; i++) binary += String.fromCharCode(audioBytes[i]);
      const audioB64 = btoa(binary);
      return new Response(JSON.stringify({ audio_url: `data:audio/mpeg;base64,${audioB64}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Análise de Concorrentes (gera ideias de diferencial) ===
    if (type === "competitor_analysis") {
      let concorrentesData: any[] = [];
      let precosData: any[] = [];
      try {
        if (empresa_id) {
          const supaUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supa = createClient(supaUrl, serviceKey);
          let q = supa.from("concorrentes").select("nome, bairro, telefone, observacoes").eq("empresa_id", empresa_id).limit(20);
          if (unidade_id) q = q.eq("unidade_id", unidade_id);
          const { data } = await q;
          concorrentesData = data || [];
          if (concorrentesData.length) {
            const ids = concorrentesData.map((c: any) => c.id).filter(Boolean);
            if (ids.length) {
              const { data: pd } = await supa.from("concorrente_precos").select("concorrente_id, produto, preco, data_coleta").in("concorrente_id", ids).order("data_coleta", { ascending: false }).limit(60);
              precosData = pd || [];
            }
          }
        }
      } catch (e) { console.error("competitor fetch err:", e); }

      const compContext = concorrentesData.length
        ? `Concorrentes mapeados na região:\n${concorrentesData.slice(0, 10).map((c: any) => `- ${c.nome}${c.bairro ? ` (${c.bairro})` : ""}${c.observacoes ? ` — ${c.observacoes}` : ""}`).join("\n")}\n\nPreços recentes coletados:\n${precosData.slice(0, 20).map((p: any) => `- ${p.produto}: R$ ${p.preco}`).join("\n") || "(sem dados de preço)"}`
        : "(Nenhum concorrente cadastrado ainda — gere análise genérica do setor de revenda de gás.)";

      const compResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `Você é um estrategista de marketing para revendas de gás. Analise os concorrentes e proponha diferenciais acionáveis.${brandBlock}` },
            { role: "user", content: `${compContext}\n\nGere:\n1) Diagnóstico em 3 bullets do cenário concorrencial.\n2) 5 ideias de POSTS que destaquem nossos diferenciais SEM citar nomes de concorrentes.\n3) 3 ofertas/promoções para reagir a movimentos de preço.\n4) 1 mensagem de WhatsApp pronta para reativar clientes que podem ter migrado.\n\nFormato: markdown com títulos e listas.` },
          ],
          stream: true,
        }),
      });
      if (!compResp.ok) {
        const status = compResp.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }
      return new Response(compResp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }


    // Image generation
    if (type === "image") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            { role: "user", content: (imagePrompt || "Crie uma imagem promocional para revenda de gás") + (brand ? `\n\nMarca/logo: "${brand}". Se o design tiver texto, use APENAS esse nome. Não escreva outras marcas (ex.: "Gás Express", "Gás Rápido").` : "\n\nNão escreva nenhum nome de marca específico na imagem.") },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }

      const data = await response.json();
      const imgB64Url: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      // Salvar no bucket + tabela se solicitado
      if (save && imgB64Url && empresa_id) {
        try {
          const supaUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supa = createClient(supaUrl, serviceKey);

          // base64 -> bytes
          const base64 = imgB64Url.split(",")[1] || imgB64Url;
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const fileName = `imagens/${empresa_id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;

          const { error: upErr } = await supa.storage
            .from("marketing-assets")
            .upload(fileName, bytes, { contentType: "image/png", upsert: false });
          if (upErr) throw upErr;

          const { data: pub } = supa.storage.from("marketing-assets").getPublicUrl(fileName);
          const publicUrl = pub.publicUrl;

          const { data: row, error: insErr } = await supa
            .from("marketing_imagens")
            .insert({
              empresa_id,
              unidade_id: unidade_id || null,
              url: publicUrl,
              origem: "ia",
              prompt: imagePrompt || null,
              titulo: (imagePrompt || "Imagem IA").slice(0, 80),
            })
            .select()
            .single();
          if (insErr) throw insErr;

          return new Response(JSON.stringify({ image: { url: publicUrl }, record: row }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (saveErr) {
          console.error("Erro ao salvar imagem:", saveErr);
          // devolve a imagem em base64 mesmo assim
          return new Response(JSON.stringify({ image: { url: imgB64Url }, error_save: String(saveErr) }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Video script generation
    if (type === "video_script") {
      const videoPlatformGuides: Record<string, string> = {
        reels: "Instagram Reels: vídeo vertical 9:16, 15 a 60 segundos, ritmo rápido, texto grande na tela.",
        tiktok: "TikTok: vídeo vertical 9:16, 15 a 60 segundos, tom viral e dinâmico, trends e áudio popular.",
        shorts: "YouTube Shorts: vídeo vertical 9:16, até 60 segundos, educativo ou impactante, boa thumbnail.",
      };

      const videoSystemPrompt = `Você é um roteirista profissional de vídeos curtos para revendas de gás (GLP).
Crie roteiros estruturados seguindo estas regras:
- ${toneGuides[tone] || "Tom profissional e acessível."}
- Formato obrigatório para cada cena:
  **Cena [número] ([duração em segundos]s)**
  🎬 Ação visual: [o que aparece na tela]
  🗣️ Fala/Texto: [o que é dito ou mostrado como texto]
  🎵 Trilha: [sugestão de tipo de música ou efeito sonoro]
- Sempre incluir: gancho nos primeiros 3 segundos, CTA no final
- Retorne APENAS o roteiro pronto, sem explicações
${videoPlatformGuides[platform] || videoPlatformGuides.reels}${brandBlock}`;

      const videoResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: videoSystemPrompt },
            { role: "user", content: `Crie um roteiro de vídeo curto sobre: "${topic}"\nPlataforma: ${platform}` },
          ],
          stream: true,
        }),
      });

      if (!videoResponse.ok) {
        const status = videoResponse.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }

      return new Response(videoResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Text content generation
    const platformGuides: Record<string, string> = {
      instagram: "Post para Instagram: use emojis moderados, até 2200 caracteres, inclua 5-10 hashtags relevantes do setor de gás/energia. Formato: legenda + hashtags separadas.",
      facebook: "Post para Facebook: texto mais longo permitido, use emojis com moderação, inclua 2-3 hashtags. Formato conversacional que incentive compartilhamentos.",
      tiktok: "Legenda para TikTok: curta e impactante (até 300 chars), use emojis e hashtags virais. Inclua sugestão de áudio/trend se aplicável.",
      whatsapp: "Mensagem para WhatsApp Business: direta e pessoal, use emojis com moderação, inclua CTA claro (link ou número). Formato: saudação + oferta + CTA. Máximo 500 caracteres.",
    };

    const toneGuide = toneGuides[tone] || toneGuides.profissional;

    const systemPrompt = `Você é um especialista em marketing digital para revendas de gás (GLP). 
Crie conteúdo de marketing de alta qualidade seguindo estas regras:
- ${toneGuide}
- Sempre mencione benefícios para o cliente (entrega rápida, segurança, preço justo)
- Adapte o formato para a plataforma especificada
- Retorne APENAS o conteúdo pronto para publicar, sem explicações adicionais
- Se gerar hashtags, coloque em linha separada no final
${platformGuides[platform] || ""}${brandBlock}`;

    const calendarPrompt = type === "calendar" 
      ? `Liste as 10 próximas datas comemorativas e oportunidades de marketing para uma revenda de gás nos próximos 60 dias. Para cada data, sugira:
- Data e nome do evento/data comemorativa
- Ideia de post (1 frase)
- Plataforma ideal (Instagram, Facebook, WhatsApp ou TikTok)

Formato: lista numerada, clara e objetiva. Considere datas brasileiras, sazonalidade de gás (inverno = mais consumo), e datas comerciais (Black Friday, etc).`
      : `Crie um post sobre o tema: "${topic}"\nPlataforma: ${platform}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: calendarPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("marketing-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
