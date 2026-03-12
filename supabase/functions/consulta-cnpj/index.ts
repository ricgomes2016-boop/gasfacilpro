import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    
    if (!cnpj) {
      return new Response(JSON.stringify({ error: 'CNPJ é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Remove formatting
    const cnpjClean = cnpj.replace(/\D/g, '');
    
    if (cnpjClean.length !== 14) {
      return new Response(JSON.stringify({ error: 'CNPJ inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Query BrasilAPI
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('BrasilAPI error:', errorText);
      return new Response(JSON.stringify({ error: 'CNPJ não encontrado na Receita Federal' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    // Map to our format
    const result = {
      razao_social: data.razao_social || '',
      nome_fantasia: data.nome_fantasia || '',
      email: data.email || '',
      telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}` : '',
      endereco: data.logradouro || '',
      numero: data.numero || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      cidade: data.municipio || '',
      estado: data.uf || '',
      cep: data.cep ? data.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : '',
      situacao_cadastral: data.descricao_situacao_cadastral || '',
      natureza_juridica: data.natureza_juridica || '',
      porte: data.porte || '',
      abertura: data.data_inicio_atividade || '',
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao consultar CNPJ' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
