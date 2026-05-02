// Vonage Voice Webhook → NCCO connect to Vapi SIP
// Public endpoint (no JWT). Vonage calls this when an inbound call hits the number.
// Response is an NCCO array instructing Vonage to bridge the call to Vapi via SIP.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPI_SIP_URI = 'sip:vonage-fortegas@sip.vapi.ai';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const isEvent = url.pathname.endsWith('/event');

  // Log everything for debugging
  let bodyText = '';
  try {
    if (req.method !== 'GET') bodyText = await req.text();
  } catch (_) {}

  console.log('[VONAGE-WEBHOOK]', {
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    body: bodyText?.slice(0, 1000),
  });

  // Event endpoint just acknowledges
  if (isEvent) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build NCCO: connect inbound call to Vapi SIP endpoint
  const from =
    url.searchParams.get('from') ||
    url.searchParams.get('msisdn') ||
    'anonymous';

  const ncco = [
    {
      action: 'talk',
      text: 'Conectando você ao atendimento. Um momento.',
      language: 'pt-BR',
      style: 2,
      bargeIn: true,
    },
    {
      action: 'connect',
      from,
      endpoint: [
        {
          type: 'sip',
          uri: VAPI_SIP_URI,
          headers: {
            'X-Source': 'vonage-fortegas',
            'X-From': from,
          },
        },
      ],
    },
  ];

  return new Response(JSON.stringify(ncco), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
