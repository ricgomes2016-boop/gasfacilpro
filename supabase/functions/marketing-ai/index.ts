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

    const brand = (brandName || "").toString().trim();
    const brandBlock = brand
      ? `\n\n=== IDENTIDADE DA MARCA (OBRIGATÓRIO) ===\n- Nome da revenda: "${brand}"${cidade ? ` (cidade: ${cidade})` : ""}\n- SEMPRE use exatamente "${brand}" quando precisar citar a marca.\n- NUNCA invente outros nomes como "Gás Express", "Gás Rápido", "Gás Já", "GásFácil" etc.\n- Não escreva nomes de marcas concorrentes.\n${whatsapp ? `- Inclua no CTA o WhatsApp: ${whatsapp}.\n` : ""}${instagram ? `- Marque o Instagram: @${String(instagram).replace(/^@/, "")}.\n` : ""}=========================================`
      : `\n\nIMPORTANTE: NÃO invente nomes de marca (ex.: "Gás Express", "Gás Rápido"). Escreva de forma genérica usando "nossa revenda" ou "nossa loja".`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
            { role: "user", content: imagePrompt || "Crie uma imagem promocional para revenda de gás" },
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
${videoPlatformGuides[platform] || videoPlatformGuides.reels}`;

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
${platformGuides[platform] || ""}`;

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
