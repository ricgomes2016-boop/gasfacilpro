import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AsaasCustomer {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  externalReference?: string;
}

interface AsaasCharge {
  customer: string; // Asaas customer ID
  billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  fine?: { value: number; type: 'FIXED' | 'PERCENTAGE' };
  interest?: { value: number; type: 'FIXED' | 'PERCENTAGE' };
  discount?: { value: number; dueDateLimitDays: number; type: 'FIXED' | 'PERCENTAGE' };
}

function getAsaasBaseUrl(sandbox: boolean): string {
  return sandbox
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/api/v3';
}

async function asaasFetch(path: string, apiKey: string, sandbox: boolean, options: RequestInit = {}) {
  const baseUrl = getAsaasBaseUrl(sandbox);
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey,
      ...(options.headers || {}),
    },
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Asaas API error:', JSON.stringify(data));
    throw new Error(data.errors?.[0]?.description || data.message || 'Erro na API Asaas');
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get empresa config for Asaas
    const { data: profile } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.empresa_id) {
      return new Response(JSON.stringify({ error: 'Empresa não encontrada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: config } = await supabase
      .from("configuracoes_empresa")
      .select("asaas_api_key, asaas_sandbox")
      .eq("empresa_id", profile.empresa_id)
      .single();

    const apiKey = config?.asaas_api_key;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API Key do Asaas não configurada. Vá em Configurações → Integrações para configurar.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sandbox = config?.asaas_sandbox ?? true;
    const body = await req.json();
    const { action, ...params } = body;

    // ========== CUSTOMERS ==========
    if (action === 'create_customer') {
      const customerData: AsaasCustomer = {
        name: params.name,
        cpfCnpj: params.cpfCnpj,
        email: params.email,
        phone: params.phone,
        mobilePhone: params.mobilePhone,
        externalReference: params.externalReference,
      };

      const result = await asaasFetch('/customers', apiKey, sandbox, {
        method: 'POST',
        body: JSON.stringify(customerData),
      });

      return new Response(JSON.stringify({ success: true, customer: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list_customers') {
      const query = params.cpfCnpj ? `?cpfCnpj=${params.cpfCnpj}` : params.name ? `?name=${encodeURIComponent(params.name)}` : '';
      const result = await asaasFetch(`/customers${query}`, apiKey, sandbox);

      return new Response(JSON.stringify({ success: true, customers: result.data, totalCount: result.totalCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== CHARGES (COBRANÇAS) ==========
    if (action === 'create_charge') {
      const chargeData: AsaasCharge = {
        customer: params.customer,
        billingType: params.billingType || 'BOLETO',
        value: params.value,
        dueDate: params.dueDate,
        description: params.description,
        externalReference: params.externalReference,
      };

      if (params.fine) chargeData.fine = params.fine;
      if (params.interest) chargeData.interest = params.interest;
      if (params.discount) chargeData.discount = params.discount;

      const result = await asaasFetch('/payments', apiKey, sandbox, {
        method: 'POST',
        body: JSON.stringify(chargeData),
      });

      return new Response(JSON.stringify({ success: true, charge: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list_charges') {
      const queryParams = new URLSearchParams();
      if (params.customer) queryParams.set('customer', params.customer);
      if (params.status) queryParams.set('status', params.status);
      if (params.billingType) queryParams.set('billingType', params.billingType);
      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const result = await asaasFetch(`/payments${qs}`, apiKey, sandbox);

      return new Response(JSON.stringify({ success: true, charges: result.data, totalCount: result.totalCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_charge') {
      if (!params.id) {
        return new Response(JSON.stringify({ error: 'ID da cobrança obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await asaasFetch(`/payments/${params.id}`, apiKey, sandbox);

      return new Response(JSON.stringify({ success: true, charge: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get boleto barcode / bankSlip URL
    if (action === 'get_boleto_url') {
      if (!params.id) {
        return new Response(JSON.stringify({ error: 'ID da cobrança obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await asaasFetch(`/payments/${params.id}/identificationField`, apiKey, sandbox);

      return new Response(JSON.stringify({ success: true, boleto: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get PIX QR Code
    if (action === 'get_pix_qrcode') {
      if (!params.id) {
        return new Response(JSON.stringify({ error: 'ID da cobrança obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await asaasFetch(`/payments/${params.id}/pixQrCode`, apiKey, sandbox);

      return new Response(JSON.stringify({ success: true, pix: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete/cancel charge
    if (action === 'delete_charge') {
      if (!params.id) {
        return new Response(JSON.stringify({ error: 'ID da cobrança obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await asaasFetch(`/payments/${params.id}`, apiKey, sandbox, { method: 'DELETE' });

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== BALANCE ==========
    if (action === 'get_balance') {
      const result = await asaasFetch('/finance/balance', apiKey, sandbox);

      return new Response(JSON.stringify({ success: true, balance: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Ação "${action}" não reconhecida` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Asaas API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
