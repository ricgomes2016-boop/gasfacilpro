// FCM HTTP v1 helper – signs a JWT from FCM_SERVICE_ACCOUNT_JSON, gets an OAuth
// token, and sends a high-priority notification message that wakes the device
// even with the screen off / app in background.

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

const ANDROID_PUSH_CHANNEL_ID = "gasfacil_alerts_v3";
const ANDROID_PUSH_SOUND = "gasfacil_alert";

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.exp - 60 > Date.now() / 1000) {
    return cachedToken.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64url(sig)}`;

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`FCM token error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  cachedToken = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return cachedToken.token;
}

export interface FcmMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendFcmMessages(messages: FcmMessage[]): Promise<{
  sent: number;
  invalidTokens: string[];
}> {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") ?? "";
  if (!raw || messages.length === 0) {
    if (!raw && messages.length > 0) {
      console.warn("[fcm] FCM_SERVICE_ACCOUNT_JSON ausente; envio nativo ignorado");
    }
    return { sent: 0, invalidTokens: [] };
  }
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(raw);
  } catch {
    console.error("[fcm] FCM_SERVICE_ACCOUNT_JSON inválido");
    return { sent: 0, invalidTokens: [] };
  }

  const accessToken = await getAccessToken(sa);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  let sent = 0;
  const invalidTokens: string[] = [];

  await Promise.all(
    messages.map(async (m) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: m.token,
              notification: { title: m.title, body: m.body },
              data: Object.fromEntries(
                Object.entries(m.data ?? {}).map(([k, v]) => [k, String(v)])
              ),
              android: {
                ttl: "4500s",
                priority: "HIGH",
                notification: {
                  channel_id: ANDROID_PUSH_CHANNEL_ID,
                  icon: "ic_stat_icon",
                  sound: ANDROID_PUSH_SOUND,
                  notification_priority: "PRIORITY_MAX",
                  visibility: "PUBLIC",
                  default_vibrate_timings: true,
                  default_light_settings: true,
                },
              },
              apns: {
                headers: { "apns-priority": "10" },
                payload: { aps: { sound: "default", "content-available": 1 } },
              },
            },
          }),
        });
        if (res.ok) {
          sent++;
        } else {
          const txt = await res.text();
          if (res.status === 404 || res.status === 400 || txt.includes("UNREGISTERED")) {
            invalidTokens.push(m.token);
          } else {
            console.warn("[fcm] envio falhou", res.status, txt);
          }
        }
      } catch (e) {
        console.warn("[fcm] erro envio", e);
      }
    })
  );

  console.info(
    "[fcm] resumo envio",
    JSON.stringify({ requested: messages.length, sent, invalidTokens: invalidTokens.length })
  );

  return { sent, invalidTokens };
}
