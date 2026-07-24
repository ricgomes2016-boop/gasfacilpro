const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const publicKey = Deno.env.get("PAGBANK_CONNECT_PUBLIC_KEY") ||
    (Deno.env.get("PAGBANK_CONNECT_PUBLIC_KEY_B64")
      ? atob(Deno.env.get("PAGBANK_CONNECT_PUBLIC_KEY_B64")!)
      : "");
  const createdAt = Number(Deno.env.get("PAGBANK_CONNECT_PUBLIC_KEY_CREATED_AT") || "0");

  if (!publicKey || !createdAt) {
    return new Response(JSON.stringify({ error: "PagBank public key not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ public_key: publicKey, created_at: createdAt }), {
    headers: {
      ...corsHeaders,
      "Cache-Control": "public, max-age=300",
      "Content-Type": "application/json",
    },
  });
});
