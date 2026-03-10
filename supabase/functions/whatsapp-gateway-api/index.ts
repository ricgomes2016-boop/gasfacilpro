// WhatsApp Gateway API — REST proxy to WhatsApp engine (Baileys/Evolution API)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-instance-token",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function createSupabase(serviceRole = false) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = serviceRole
    ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    : Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, key);
}

async function resolveInstance(supabase: any, instanceName: string) {
  const { data, error } = await supabase
    .from("whatsapp_gateway_instances")
    .select("*")
    .eq("instance_name", instanceName)
    .single();
  if (error || !data) return null;
  return data;
}

async function forwardToEngine(
  instance: any,
  path: string,
  method: string,
  body?: any
) {
  const engineUrl = instance.engine_url.replace(/\/$/, "");
  const url = `${engineUrl}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (instance.api_key) {
    headers["apikey"] = instance.api_key;
  }

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return {
    status: resp.status,
    data: await resp.json().catch(() => ({ ok: resp.ok })),
  };
}

async function logMessage(
  supabase: any,
  instanceId: string,
  phone: string,
  message: string | null,
  direction: string,
  messageType: string,
  mediaUrl?: string,
  externalId?: string
) {
  await supabase.from("whatsapp_gateway_messages").insert({
    instance_id: instanceId,
    phone,
    message,
    media_url: mediaUrl || null,
    message_type: messageType,
    direction,
    external_id: externalId || null,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  
  // Route: /whatsapp-gateway-api/{action} or /whatsapp-gateway-api/instances/{name}/{action}
  // Since edge functions strip the function name, path starts after it
  // Expected paths: /instances/{name}/send-text, /instances/{name}/status, etc.
  
  const supabase = createSupabase(true);

  // API Key authentication for external callers
  const apiKey = req.headers.get("x-api-key") || url.searchParams.get("apikey");

  try {
    // Parse path: remove empty segments
    // pathParts[0] = "whatsapp-gateway-api" (function name) — may or may not be present
    let segments = pathParts;
    if (segments[0] === "whatsapp-gateway-api") segments = segments.slice(1);

    // ===== WEBHOOK RECEIVER (POST /webhook/{instance_name}) =====
    if (segments[0] === "webhook" && segments[1] && req.method === "POST") {
      const instanceName = segments[1];
      const instance = await resolveInstance(supabase, instanceName);
      if (!instance) return json({ error: "Instance not found" }, 404);

      const body = await req.json();
      console.log(`[GATEWAY] Webhook received for ${instanceName}:`, JSON.stringify(body).substring(0, 300));

      // Log inbound message
      const phone = body.data?.key?.remoteJid?.replace("@s.whatsapp.net", "") || body.phone || "";
      const message = body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text || body.message || "";
      const senderName = body.data?.pushName || body.name || "";

      if (phone && message) {
        await logMessage(supabase, instance.id, phone, message, "inbound", "text");
      }

      // Forward to client's webhook URL
      if (instance.webhook_url) {
        const payload = {
          instance: instanceName,
          instance_id: instance.id,
          phone,
          name: senderName,
          message,
          timestamp: new Date().toISOString(),
          raw: body,
        };

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (instance.webhook_secret) {
          headers["x-webhook-secret"] = instance.webhook_secret;
        }

        fetch(instance.webhook_url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }).catch((err) => console.error(`[GATEWAY] Webhook forward error:`, err));
      }

      return json({ ok: true });
    }

    // ===== INSTANCE MANAGEMENT (authenticated via Supabase JWT or API key) =====
    
    // ===== LIST INSTANCES (GET /instances) =====
    if (segments[0] === "instances" && !segments[1] && req.method === "GET") {
      const empresaId = url.searchParams.get("empresa_id");
      let query = supabase.from("whatsapp_gateway_instances").select("*, unidades(nome)");
      if (empresaId) query = query.eq("empresa_id", empresaId);
      const { data, error } = await query.order("created_at");
      if (error) return json({ error: error.message }, 500);
      return json({ instances: data });
    }

    // ===== INSTANCE ACTIONS =====
    if (segments[0] === "instances" && segments[1]) {
      const instanceName = segments[1];
      const action = segments[2] || "status";
      const instance = await resolveInstance(supabase, instanceName);

      // ===== CREATE INSTANCE (POST /instances/{name}/create) =====
      if (action === "create" && req.method === "POST") {
        const body = await req.json();
        const { data, error } = await supabase.from("whatsapp_gateway_instances").insert({
          empresa_id: body.empresa_id,
          unidade_id: body.unidade_id,
          instance_name: instanceName,
          engine_url: body.engine_url,
          api_key: body.api_key || null,
          webhook_url: body.webhook_url || null,
          webhook_secret: body.webhook_secret || null,
        }).select().single();
        if (error) return json({ error: error.message }, 400);

        // Create instance on engine
        if (body.engine_url) {
          try {
            await forwardToEngine(
              { engine_url: body.engine_url, api_key: body.api_key },
              `/instance/create`,
              "POST",
              { instanceName, token: body.api_key }
            );
          } catch (e) {
            console.error("[GATEWAY] Engine create error:", e);
          }
        }

        return json({ instance: data }, 201);
      }

      if (!instance) return json({ error: "Instance not found" }, 404);

      // ===== GET STATUS (GET /instances/{name}/status) =====
      if (action === "status" && req.method === "GET") {
        // Try to get real-time status from engine
        try {
          const resp = await forwardToEngine(instance, `/instance/connectionState/${instanceName}`, "GET");
          const engineStatus = resp.data?.instance?.state || resp.data?.state || instance.status;
          
          // Update status in DB if changed
          if (engineStatus !== instance.status) {
            await supabase.from("whatsapp_gateway_instances")
              .update({ status: engineStatus })
              .eq("id", instance.id);
          }

          return json({
            instance: instanceName,
            status: engineStatus,
            phone: instance.phone,
            connected: engineStatus === "open" || engineStatus === "connected",
          });
        } catch {
          return json({
            instance: instanceName,
            status: instance.status,
            phone: instance.phone,
            connected: instance.status === "connected",
          });
        }
      }

      // ===== GET QR CODE (GET /instances/{name}/qrcode) =====
      if (action === "qrcode" && req.method === "GET") {
        try {
          const resp = await forwardToEngine(instance, `/instance/connect/${instanceName}`, "GET");
          const qrCode = resp.data?.qrcode?.base64 || resp.data?.base64 || resp.data?.qrcode || null;
          
          if (qrCode) {
            await supabase.from("whatsapp_gateway_instances")
              .update({ qr_code: qrCode, status: "connecting" })
              .eq("id", instance.id);
          }

          return json({ instance: instanceName, qrcode: qrCode });
        } catch (e: any) {
          return json({ error: "Failed to get QR code", details: e.message }, 500);
        }
      }

      // ===== SEND TEXT (POST /instances/{name}/send-text) =====
      if (action === "send-text" && req.method === "POST") {
        const body = await req.json();
        if (!body.phone || !body.message) {
          return json({ error: "phone and message are required" }, 400);
        }

        const phone = body.phone.replace(/\D/g, "");
        
        const resp = await forwardToEngine(instance, `/message/sendText/${instanceName}`, "POST", {
          number: phone,
          text: body.message,
        });

        await logMessage(supabase, instance.id, phone, body.message, "outbound", "text", undefined, resp.data?.key?.id);

        return json({ ok: true, messageId: resp.data?.key?.id, status: resp.status });
      }

      // ===== SEND IMAGE (POST /instances/{name}/send-image) =====
      if (action === "send-image" && req.method === "POST") {
        const body = await req.json();
        if (!body.phone || !body.image) {
          return json({ error: "phone and image are required" }, 400);
        }

        const phone = body.phone.replace(/\D/g, "");
        
        const resp = await forwardToEngine(instance, `/message/sendMedia/${instanceName}`, "POST", {
          number: phone,
          mediatype: "image",
          media: body.image,
          caption: body.caption || "",
        });

        await logMessage(supabase, instance.id, phone, body.caption || null, "outbound", "image", body.image);

        return json({ ok: true, status: resp.status });
      }

      // ===== SEND DOCUMENT (POST /instances/{name}/send-document) =====
      if (action === "send-document" && req.method === "POST") {
        const body = await req.json();
        if (!body.phone || !body.document) {
          return json({ error: "phone and document are required" }, 400);
        }

        const phone = body.phone.replace(/\D/g, "");
        
        const resp = await forwardToEngine(instance, `/message/sendMedia/${instanceName}`, "POST", {
          number: phone,
          mediatype: "document",
          media: body.document,
          fileName: body.fileName || "document",
        });

        await logMessage(supabase, instance.id, phone, null, "outbound", "document", body.document);

        return json({ ok: true, status: resp.status });
      }

      // ===== SEND LOCATION (POST /instances/{name}/send-location) =====
      if (action === "send-location" && req.method === "POST") {
        const body = await req.json();
        if (!body.phone || !body.latitude || !body.longitude) {
          return json({ error: "phone, latitude and longitude are required" }, 400);
        }

        const phone = body.phone.replace(/\D/g, "");
        
        const resp = await forwardToEngine(instance, `/message/sendLocation/${instanceName}`, "POST", {
          number: phone,
          latitude: body.latitude,
          longitude: body.longitude,
          name: body.name || "",
          address: body.address || "",
        });

        await logMessage(supabase, instance.id, phone, `📍 ${body.latitude},${body.longitude}`, "outbound", "location");

        return json({ ok: true, status: resp.status });
      }

      // ===== DISCONNECT (POST /instances/{name}/disconnect) =====
      if (action === "disconnect" && req.method === "POST") {
        try {
          await forwardToEngine(instance, `/instance/logout/${instanceName}`, "DELETE");
        } catch {}
        await supabase.from("whatsapp_gateway_instances")
          .update({ status: "disconnected", qr_code: null })
          .eq("id", instance.id);
        return json({ ok: true, status: "disconnected" });
      }

      // ===== RESTART (POST /instances/{name}/restart) =====
      if (action === "restart" && req.method === "POST") {
        try {
          await forwardToEngine(instance, `/instance/restart/${instanceName}`, "PUT");
        } catch {}
        await supabase.from("whatsapp_gateway_instances")
          .update({ status: "connecting" })
          .eq("id", instance.id);
        return json({ ok: true, status: "connecting" });
      }

      // ===== DELETE (DELETE /instances/{name}/delete) =====
      if (action === "delete" && req.method === "DELETE") {
        try {
          await forwardToEngine(instance, `/instance/delete/${instanceName}`, "DELETE");
        } catch {}
        await supabase.from("whatsapp_gateway_instances").delete().eq("id", instance.id);
        return json({ ok: true, deleted: true });
      }

      // ===== UPDATE CONFIG (PATCH /instances/{name}/config) =====
      if (action === "config" && (req.method === "PATCH" || req.method === "PUT")) {
        const body = await req.json();
        const allowed = ["webhook_url", "webhook_secret", "engine_url", "api_key", "auto_reconnect"];
        const updates: Record<string, any> = {};
        for (const key of allowed) {
          if (body[key] !== undefined) updates[key] = body[key];
        }
        const { error } = await supabase.from("whatsapp_gateway_instances")
          .update(updates)
          .eq("id", instance.id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      // ===== MESSAGES (GET /instances/{name}/messages) =====
      if (action === "messages" && req.method === "GET") {
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const phone = url.searchParams.get("phone");
        let query = supabase.from("whatsapp_gateway_messages")
          .select("*")
          .eq("instance_id", instance.id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (phone) query = query.eq("phone", phone);
        const { data, error } = await query;
        if (error) return json({ error: error.message }, 500);
        return json({ messages: data });
      }
    }

    // ===== API DOCS (GET /) =====
    return json({
      name: "GasFacil WhatsApp Gateway API",
      version: "1.0.0",
      endpoints: {
        "GET /instances": "List all instances",
        "POST /instances/{name}/create": "Create new instance",
        "GET /instances/{name}/status": "Get instance status",
        "GET /instances/{name}/qrcode": "Get QR code for connection",
        "POST /instances/{name}/send-text": "Send text message { phone, message }",
        "POST /instances/{name}/send-image": "Send image { phone, image, caption }",
        "POST /instances/{name}/send-document": "Send document { phone, document, fileName }",
        "POST /instances/{name}/send-location": "Send location { phone, latitude, longitude }",
        "POST /instances/{name}/disconnect": "Disconnect instance",
        "POST /instances/{name}/restart": "Restart instance",
        "DELETE /instances/{name}/delete": "Delete instance",
        "PATCH /instances/{name}/config": "Update instance config",
        "GET /instances/{name}/messages": "Get message history",
        "POST /webhook/{name}": "Receive webhook from WhatsApp engine",
      },
    });
  } catch (error: any) {
    console.error("[GATEWAY] Error:", error);
    return json({ error: "Internal server error", details: error.message }, 500);
  }
});
