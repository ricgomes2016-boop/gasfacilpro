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
    '551152835921';

  // Minimal NCCO: connect directly to Vapi SIP. Avoid `talk` before connect
  // (bargeIn requires a follow-up input action). Avoid SIP custom headers
  // since Vonage validates them strictly.
  const ncco = [
    {
      action: 'connect',
      from: from,
      endpoint: [
        {
          type: 'sip',
          uri: VAPI_SIP_URI,
        },
      ],
    },
  ];

  return new Response(JSON.stringify(ncco), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
