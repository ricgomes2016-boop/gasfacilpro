import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireAuth(req, corsHeaders);
    if (!auth.ok) return auth.response;

    const { empenho_id } = await req.json();
    if (!empenho_id) {
      return new Response(JSON.stringify({ ok: false, error: 'empenho_id obrigatório' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('VITE_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: emp, error } = await supabase
      .from('empenhos')
      .select('*')
      .eq('id', empenho_id)
      .single();

    if (error || !emp) {
      return new Response(JSON.stringify({ ok: false, error: 'Empenho não encontrado' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tenant guard: caller must belong to the same empresa as the empenho's unidade
    if (!auth.isServiceRole) {
      const { data: prof } = await supabase
        .from('profiles').select('empresa_id').eq('user_id', auth.userId).maybeSingle();
      const { data: uni } = await supabase
        .from('unidades').select('empresa_id').eq('id', emp.unidade_id).maybeSingle();
      if (!prof?.empresa_id || !uni?.empresa_id || prof.empresa_id !== uni.empresa_id) {
        return new Response(JSON.stringify({ ok: false, error: 'Acesso negado ao empenho' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const infoComplementar = `Ref. ao Empenho nº ${emp.numero_empenho}`;
    const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');

    // Sem token configurado → modo mock
    if (!focusToken) {
      const mockNumero = String(Math.floor(100000 + Math.random() * 900000));
      const mockChave = '35' + Date.now().toString().padStart(42, '0').slice(0, 42);
      await supabase.from('empenhos').update({
        nfe_id: 'MOCK-' + crypto.randomUUID().slice(0, 8),
        nfe_numero: mockNumero,
        nfe_chave: mockChave,
        nfe_status: 'autorizada_mock',
      }).eq('id', empenho_id);

      return new Response(JSON.stringify({
        ok: true, mock: true,
        numero: mockNumero, chave: mockChave,
        informacoes_adicionais: infoComplementar,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // TODO: integração real com Focus NFe quando token estiver disponível
    // por enquanto registra como pendente para revisão manual
    await supabase.from('empenhos').update({
      nfe_status: 'pendente_emissao',
    }).eq('id', empenho_id);

    return new Response(JSON.stringify({
      ok: true, mock: false, pendente: true,
      informacoes_adicionais: infoComplementar,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
