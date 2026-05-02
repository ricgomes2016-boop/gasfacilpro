// Vonage Voice Webhook → NCCO connect to Vapi SIP
// Public endpoint (no JWT). Vonage calls this when an inbound call hits the number.
// Response is an NCCO array instructing Vonage to bridge the call to Vapi via SIP.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default Vapi inbound SIP URI for our Vonage import.
// This is the format Vapi exposes for BYO/imported numbers when an `authentication`
// block is NOT set on the phone number → it accepts plain INVITEs without digest.
const VAPI_SIP_URI = Deno.env.get('VAPI_SIP_URI') || 'sip:vonage-fortegas@sip.vapi.ai';

const EVENT_URL =
  'https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/vonage-voice-webhook/event';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const isEvent = url.pathname.endsWith('/event');

  let bodyText = '';
  try {
    if (req.method !== 'GET') bodyText = await req.text();
  } catch (_) {}

  console.log('[VONAGE-WEBHOOK]', {
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    body: bodyText?.slice(0, 1500),
  });

  // Event endpoint just acknowledges every call leg event with 200.
  if (isEvent) {
    // Try to extract sip_code/detail for fast diagnosis
    try {
      if (bodyText) {
        const evt = JSON.parse(bodyText);
        if (evt?.sip_code || evt?.detail || evt?.status) {
          console.log('[VONAGE-EVENT-DIAG]', {
            status: evt.status,
            sip_code: evt.sip_code,
            detail: evt.detail,
            direction: evt.direction,
            from: evt.from,
            to: evt.to,
            uuid: evt.uuid,
            conversation_uuid: evt.conversation_uuid,
            duration: evt.duration,
            disconnected_by: evt.disconnected_by,
          });
        }
      }
    } catch (_) {}
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Diagnostic mode now opt-in via ?diag=1. Default = bridge to Vapi SIP.
  const diagnosticOnly = url.searchParams.get('diag') === '1';
  if (diagnosticOnly) {
    const diagnosticNcco = [
      {
        action: 'talk',
        text: 'Teste Vonage concluído com sucesso. A chamada chegou no sistema. Encerrando agora.',
        language: 'pt-BR',
        style: 2,
      },
    ];
    console.log('[VONAGE-DIAG-NCCO]', JSON.stringify(diagnosticNcco));
    return new Response(JSON.stringify(diagnosticNcco), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  // Build NCCO: connect inbound call to Vapi SIP endpoint
  // The "from" must be a valid E.164-ish number that Vapi accepts as caller id.
  let from =
    url.searchParams.get('from') ||
    url.searchParams.get('msisdn') ||
    '551152835921';

  // Vonage sometimes sends without leading +. Normalize to digits only — Vapi tolerates both.
  from = from.replace(/[^\d+]/g, '') || '551152835921';

  // Optional digest auth — only attach if BOTH env vars are set. Many Vapi numbers
  // accept INVITE without auth, and sending wrong creds produces SIP 480/403.
  const SIP_USER = Deno.env.get('VAPI_SIP_USERNAME') || '';
  const SIP_PASS = Deno.env.get('VAPI_SIP_PASSWORD') || '';

  const endpoint: any = {
    type: 'sip',
    uri: VAPI_SIP_URI,
  };
  if (SIP_USER && SIP_PASS) {
    endpoint.username = SIP_USER;
    endpoint.password = SIP_PASS;
  }

  const ncco: any[] = [
    // Tiny audible confirmation so the customer always hears something even
    // if the SIP leg fails. Helps isolate "carrier delivered audio" vs "SIP fail".
    {
      action: 'talk',
      text: 'Conectando você à Bia, um momento.',
      language: 'pt-BR',
      style: 2,
      bargeIn: false,
    },
    {
      action: 'connect',
      from,
      timeout: 45,
      eventUrl: [EVENT_URL],
      eventMethod: 'POST',
      endpoint: [endpoint],
    },
  ];

  // Diagnostic log of the NCCO (without password)
  const safeNcco = JSON.parse(JSON.stringify(ncco));
  if (safeNcco?.[1]?.endpoint?.[0]?.password) safeNcco[1].endpoint[0].password = '***';
  console.log('[VONAGE-WEBHOOK-NCCO]', JSON.stringify(safeNcco));

  return new Response(JSON.stringify(ncco), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
