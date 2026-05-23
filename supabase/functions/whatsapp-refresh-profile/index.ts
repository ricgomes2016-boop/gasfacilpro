// whatsapp-refresh-profile — Atualiza foto de perfil da loja e do contato.
// Fallback: quando provedor primário da unidade é Meta (não expõe foto de contato),
// tenta usar QUALQUER instância Evolution/Z-API ATIVA da MESMA empresa só para
// buscar a foto. Faz cache da imagem em Storage (whatsapp-avatars) para evitar
// URLs temporárias do WhatsApp (que expiram + têm CORS/hot-link).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveConfig, fetchStoreProfilePicture, fetchContactProfilePicture } from "../_shared/bia-core.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROVIDERS_PRIMARY = ["meta", "evolution", "zapi", "uazapi", "gateway"] as const;
// Ordem para buscar foto de contato (Baileys primeiro)
const CONTACT_PIC_ORDER = ["evolution", "zapi"] as const;

async function cacheImageToStorage(
  supabase: any,
  remoteUrl: string,
  pathInBucket: string,
): Promise<string | null> {
  try {
    const resp = await fetch(remoteUrl, {
      headers: { "User-Agent": "Mozilla/5.0 GasFacilPro" },
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return null;
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.byteLength < 200) return null; // imagem inválida/placeholder
    const { error: upErr } = await supabase.storage
      .from("whatsapp-avatars")
      .upload(pathInBucket, buf, { contentType: ct, upsert: true });
    if (upErr) {
      console.error("upload error:", upErr);
      return null;
    }
    const { data } = supabase.storage.from("whatsapp-avatars").getPublicUrl(pathInBucket);
    // cache-buster pra forçar refresh quando atualizamos
    return data?.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : null;
  } catch (e) {
    console.error("cacheImageToStorage error:", e);
    return null;
  }
}

async function resolveAnyEvolutionForEmpresa(supabase: any, empresaId: string | null) {
  if (!empresaId) return null;
  for (const prov of CONTACT_PIC_ORDER) {
    // Prefere instâncias conectadas; ordena conectado > aguardando > resto
    const { data: rows } = await supabase
      .from("integracoes_whatsapp")
      .select("unidade_id, status_conexao, unidades!inner(empresa_id)")
      .eq("provedor", prov)
      .eq("ativo", true)
      .eq("unidades.empresa_id", empresaId)
      .limit(10);
    const sorted = (rows || []).sort((a: any, b: any) => {
      const score = (s: string) => (s === "conectado" || s === "open" ? 0 : s === "aguardando" ? 1 : 2);
      return score(a.status_conexao) - score(b.status_conexao);
    });
    for (const r of sorted) {
      const cfg = await resolveConfig(supabase, prov as any, r.unidade_id, null);
      if (cfg) return cfg;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const { unidade_id, conversa_id } = body || {};

    if (!unidade_id) {
      return new Response(JSON.stringify({ ok: false, error: "unidade_id é obrigatório" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant guard: a unidade tem que ser da empresa do usuário (super_admin/service ignoram)
    if (!auth.isServiceRole && auth.userId) {
      const [{ data: prof }, { data: uni }] = await Promise.all([
        supabase.from("profiles").select("empresa_id").eq("user_id", auth.userId).maybeSingle(),
        supabase.from("unidades").select("empresa_id").eq("id", unidade_id).maybeSingle(),
      ]);
      const isSuper = (await supabase.from("user_roles").select("role").eq("user_id", auth.userId).eq("role", "super_admin").maybeSingle()).data;
      if (!isSuper && (!prof?.empresa_id || prof.empresa_id !== uni?.empresa_id)) {
        return new Response(JSON.stringify({ ok: false, error: "forbidden_tenant" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (conversa_id) {
        const { data: conv } = await supabase
          .from("ai_conversas").select("empresa_id").eq("id", conversa_id).maybeSingle();
        if (!isSuper && conv?.empresa_id && conv.empresa_id !== prof?.empresa_id) {
          return new Response(JSON.stringify({ ok: false, error: "forbidden_tenant" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Resolve provedor primário da unidade
    let primary: any = null;
    for (const p of PROVIDERS_PRIMARY) {
      primary = await resolveConfig(supabase, p, unidade_id, null);
      if (primary) break;
    }
    if (!primary) {
      return new Response(JSON.stringify({ ok: false, reason: "no_active_integration" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Foto da loja — sempre tenta provedor primário
    let lojaPublicUrl: string | null = null;
    const lojaRemote = await fetchStoreProfilePicture(primary);
    if (lojaRemote) {
      lojaPublicUrl = await cacheImageToStorage(supabase, lojaRemote, `loja/${unidade_id}.jpg`);
      await supabase.from("integracoes_whatsapp")
        .update({ loja_foto_url: lojaPublicUrl || lojaRemote, loja_foto_atualizada_em: new Date().toISOString() })
        .eq("unidade_id", unidade_id)
        .eq("provedor", primary.provedor);
    }

    // 2) Foto do contato — cadeia de fallback
    let contatoPublicUrl: string | null = null;
    let contatoSource: string | null = null;
    let noProviderForContact = false;

    if (conversa_id) {
      const { data: conv } = await supabase
        .from("ai_conversas").select("telefone, unidade_id, empresa_id").eq("id", conversa_id).maybeSingle();

      if (conv?.telefone) {
        // Descobre empresa_id (pode estar null na conversa)
        let empresaId: string | null = conv.empresa_id || null;
        if (!empresaId && conv.unidade_id) {
          const { data: u } = await supabase.from("unidades").select("empresa_id").eq("id", conv.unidade_id).maybeSingle();
          empresaId = u?.empresa_id || null;
        }
        if (!empresaId) {
          const { data: u2 } = await supabase.from("unidades").select("empresa_id").eq("id", unidade_id).maybeSingle();
          empresaId = u2?.empresa_id || null;
        }

        // Ordem de tentativa: 1) primário se for evolution/zapi, 2) fallback evolution/zapi mesma empresa
        const tryConfigs: any[] = [];
        if (primary.provedor === "evolution" || primary.provedor === "zapi") {
          tryConfigs.push(primary);
        }
        const fallback = await resolveAnyEvolutionForEmpresa(supabase, empresaId);
        if (fallback && fallback !== primary) tryConfigs.push(fallback);

        if (tryConfigs.length === 0) {
          noProviderForContact = true;
        }

        let contatoRemote: string | null = null;
        for (const cfg of tryConfigs) {
          contatoRemote = await fetchContactProfilePicture(cfg, conv.telefone);
          if (contatoRemote) { contatoSource = cfg.provedor; break; }
        }

        if (contatoRemote) {
          contatoPublicUrl = await cacheImageToStorage(supabase, contatoRemote, `contato/${conversa_id}.jpg`);
          await supabase.from("ai_conversas")
            .update({
              foto_url: contatoPublicUrl || contatoRemote,
              foto_atualizada_em: new Date().toISOString(),
            })
            .eq("id", conversa_id);
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      loja_foto_url: lojaPublicUrl,
      contato_foto_url: contatoPublicUrl,
      provedor: primary.provedor,
      contato_provedor: contatoSource,
      reason: noProviderForContact ? "no_provider_for_contact_picture" : null,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-refresh-profile error:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
