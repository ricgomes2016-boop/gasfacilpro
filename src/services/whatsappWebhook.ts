import crypto from "crypto";

/**
 * Valida a assinatura do webhook da Meta
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest("hex")}`;

  return signature === expectedSignature;
}

/**
 * Tipos de eventos do webhook
 */
export interface WhatsappWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: "text" | "image" | "video" | "audio" | "document" | "location";
          text?: {
            body: string;
          };
          image?: {
            mime_type: string;
            sha256: string;
            id: string;
          };
          video?: {
            mime_type: string;
            sha256: string;
            id: string;
          };
          audio?: {
            mime_type: string;
            sha256: string;
            id: string;
          };
          document?: {
            filename: string;
            mime_type: string;
            sha256: string;
            id: string;
          };
          location?: {
            latitude: number;
            longitude: number;
          };
        }>;
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id?: string;
          errors?: Array<{
            code: number;
            title: string;
            message: string;
            error_data: {
              messaging_product: string;
              details: string;
            };
          }>;
        }>;
      };
      field: string;
    }>;
  }>;
}

/**
 * Extrai dados da mensagem do webhook
 */
export function extractMessageData(payload: WhatsappWebhookPayload) {
  const entry = payload.entry[0];
  if (!entry) return null;

  const changes = entry.changes[0];
  if (!changes) return null;

  const value = changes.value;
  const messages = value.messages;
  const statuses = value.statuses;

  return {
    phoneNumberId: value.metadata.phone_number_id,
    displayPhoneNumber: value.metadata.display_phone_number,
    contact: value.contacts?.[0],
    message: messages?.[0],
    status: statuses?.[0],
  };
}

/**
 * Tipos para resposta de mensagem
 */
export interface SendMessagePayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text" | "template" | "button" | "list" | "location" | "image" | "document";
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: string;
      parameters?: Array<{
        type: string;
        text?: string;
      }>;
    }>;
  };
  interactive?: {
    type: "button" | "list";
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      buttons?: Array<{
        type: "reply";
        reply: {
          id: string;
          title: string;
        };
      }>;
      button?: string;
      sections?: Array<{
        title: string;
        rows: Array<{
          id: string;
          title: string;
          description?: string;
        }>;
      }>;
    };
  };
}

/**
 * Marca mensagem como lida
 */
export interface MarkAsReadPayload {
  messaging_product: "whatsapp";
  status: "read";
  message_id: string;
}
