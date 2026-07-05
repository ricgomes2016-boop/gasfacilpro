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

  // ============================================================
  // Caller-ID classification
  // ============================================================
  // PSTN forwarding (e.g. GoTo 0800 → Vonage DID) frequently strips the
  // original caller and presents the operator number instead. We detect
  // those known operator numbers and mark the call as "untrusted caller id"
  // so downstream (Twilio → ElevenLabs Bia) doesn't try to match a customer
  // that is actually the operator itself.
  const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');
  const lastN = (s: string, n: number) => onlyDigits(s).slice(-n);

  // Numbers that can never be a real customer caller-id
  const OPERATOR_NUMBERS_LAST10 = new Set<string>([
    lastN(VONAGE_CALLER_ID, 10),  // 1152835921
    '8005900492',                  // GoTo 0800 (08005900492)
    '5900492',                     // sometimes only the suffix is presented
  ]);

  // Vonage may pass the original caller via SIP headers in the body (when the
  // upstream route forwards them) — Diversion, P-Asserted-Identity, Remote-Party-ID.
  const sipHeaderCandidates: string[] = [];
  if (bodyJson) {
    for (const k of Object.keys(bodyJson)) {
      const lower = k.toLowerCase();
      if (
        lower === 'diversion' ||
        lower === 'p-asserted-identity' ||
        lower === 'remote-party-id' ||
        lower.startsWith('sipheader_') ||
        lower.startsWith('x-')
      ) {
        const v = String(bodyJson[k] ?? '');
        const m = v.match(/(?:sip:)?(\+?\d{8,15})/i);
        if (m) sipHeaderCandidates.push(m[1]);
      }
    }
  }
  // Same lookup in query string (some configs pass through)
  for (const [k, v] of url.searchParams.entries()) {
    const lower = k.toLowerCase();
    if (
      lower === 'diversion' ||
      lower === 'p-asserted-identity' ||
      lower === 'remote-party-id' ||
      lower.startsWith('sipheader_')
    ) {
      const m = String(v).match(/(?:sip:)?(\+?\d{8,15})/i);
      if (m) sipHeaderCandidates.push(m[1]);
    }
  }

  const incomingFrom =
    url.searchParams.get('from') ||
    url.searchParams.get('msisdn') ||
    (bodyJson?.from ? String(bodyJson.from) : '') ||
    '';
  const incomingTo =
    url.searchParams.get('to') ||
    (bodyJson?.to ? String(bodyJson.to) : '') ||
    '';

  // Pick the best "real caller". Prefer SIP-header candidates that are NOT
  // operator numbers; fall back to the from field if it isn't an operator.
  let callerReal = '';
  for (const cand of sipHeaderCandidates) {
    if (!OPERATOR_NUMBERS_LAST10.has(lastN(cand, 10))) {
      callerReal = onlyDigits(cand);
      break;
    }
  }
  if (!callerReal && incomingFrom && !OPERATOR_NUMBERS_LAST10.has(lastN(incomingFrom, 10))) {
    callerReal = onlyDigits(incomingFrom);
  }
  const callerConfiavel = !!callerReal;

  console.log('[VONAGE-CALLER-ID]', {
    incomingFrom,
    incomingTo,
    sipHeaderCandidates,
    callerReal,
    callerConfiavel,
  });

  // Build NCCO: connect inbound call to Twilio's Bia route by default.
  // Use ?route=vapi only for controlled SIP diagnostics.
  const route = url.searchParams.get('route') || 'twilio';

  // The "from" we present to the next leg (Twilio).
  // - If we have a trusted real caller-id, forward it.
  // - Otherwise use a sentinel '0000000000' so Twilio + Bia know NOT to
  //   match a customer based on this number.
  let from: string;
  if (route === 'vapi') {
    from = callerReal || incomingFrom || VONAGE_CALLER_ID;
  } else {
    from = callerConfiavel ? callerReal : '0000000000';
  }

  // Normalize to digits only — both Vapi and Twilio tolerate plain digits.
  from = from.replace(/[^\d+]/g, '') || '0000000000';

  // SIP credentials are NEVER embedded in the NCCO response body — this endpoint
  // is public (Vonage callback) and returning them here leaks them to anyone
  // hitting the URL. If the vapi route ever needs authenticated SIP, configure
  // the credentials in the Vonage Application (SIP endpoint credentials) so
  // Vonage itself supplies them out-of-band.
  const endpoint: any = route === 'vapi'
    ? { type: 'sip', uri: VAPI_SIP_URI }
    : { type: 'phone', number: TWILIO_BIA_NUMBER };

  const ncco: any[] = [
    // Encaminhamento direto ao agente da Bia — sem mensagem intermediária.
    {
      action: 'connect',
      from,
      timeout: 45,
      eventUrl: [EVENT_URL],
      eventMethod: 'POST',
      endpoint: [endpoint],
    },
  ];

  console.log('[VONAGE-WEBHOOK-NCCO]', JSON.stringify(ncco));

  return new Response(JSON.stringify(ncco), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
