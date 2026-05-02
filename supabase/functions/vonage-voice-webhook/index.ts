// Vonage Voice Webhook → NCCO connect to Bia voice route
// Public endpoint (no JWT). Vonage calls this when an inbound call hits the number.
// Response is an NCCO array instructing Vonage to bridge the call to Vapi via SIP.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Vapi kept returning SIP 480 unavailable for this route. Keep the URI here only
// for explicit diagnostics/fallback, but default production routing goes through
// the already-working Twilio number that points to twilio-voice-webhook.
const VAPI_SIP_URI = Deno.env.get('VAPI_SIP_URI') || 'sip:vonage-fortegas@sip.vapi.ai';
const TWILIO_BIA_NUMBER = Deno.env.get('TWILIO_BIA_NUMBER') || '14784297119';
const VONAGE_CALLER_ID = Deno.env.get('VONAGE_CALLER_ID') || '551152835921';

const EVENT_URL =
  'https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/vonage-voice-webhook/event';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const isEvent = url.pathname.endsWith('/event');

  let bodyText = '';
  let bodyJson: any = null;
  try {
    if (req.method !== 'GET') {
      bodyText = await req.text();
      try { bodyJson = bodyText ? JSON.parse(bodyText) : null; } catch (_) { bodyJson = null; }
    }
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

  // Build NCCO: connect inbound call to Twilio's Bia route by default.
  // Use ?route=vapi only for controlled SIP diagnostics.
  const route = url.searchParams.get('route') || 'twilio';

  // The "from" must be a valid number accepted by the carrier. For PSTN bridge,
  // use our Vonage DID instead of spoofing the customer's caller id.
  let from =
    route === 'vapi'
      ? (url.searchParams.get('from') || url.searchParams.get('msisdn') || VONAGE_CALLER_ID)
      : VONAGE_CALLER_ID;

  // Vonage sometimes sends without leading +. Normalize to digits only — Vapi tolerates both.
  from = from.replace(/[^\d+]/g, '') || '551152835921';

  // Optional digest auth for Vapi diagnostics — only attach if BOTH env vars are set.
  const SIP_USER = Deno.env.get('VAPI_SIP_USERNAME') || '';
  const SIP_PASS = Deno.env.get('VAPI_SIP_PASSWORD') || '';

  const endpoint: any = route === 'vapi'
    ? { type: 'sip', uri: VAPI_SIP_URI }
    : { type: 'phone', number: TWILIO_BIA_NUMBER };
  if (route === 'vapi' && SIP_USER && SIP_PASS) {
    endpoint.username = SIP_USER;
    endpoint.password = SIP_PASS;
  }

  const ncco: any[] = [
    // Tiny audible confirmation so the customer always hears something even
    // if the SIP leg fails. Helps isolate "carrier delivered audio" vs "SIP fail".
    {
      action: 'talk',
      text: 'Conectando você a Central Gás, um momento.',
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
