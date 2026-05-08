/**
 * Serviço para enviar mensagens via Meta Cloud API
 */

export interface SendTextMessageOptions {
  to: string;
  text: string;
  phoneNumberId: string;
  accessToken: string;
}

export interface SendTemplateMessageOptions {
  to: string;
  templateName: string;
  phoneNumberId: string;
  accessToken: string;
  language?: string;
  parameters?: string[];
}

export interface SendMediaMessageOptions {
  to: string;
  type: "image" | "video" | "audio" | "document";
  mediaId?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  phoneNumberId: string;
  accessToken: string;
}

export interface SendLocationMessageOptions {
  to: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  phoneNumberId: string;
  accessToken: string;
}

export interface MarkAsReadOptions {
  messageId: string;
  phoneNumberId: string;
  accessToken: string;
}

/**
 * Envia mensagem de texto
 */
export async function sendTextMessage(
  options: SendTextMessageOptions
): Promise<{ messageId: string; status: string }> {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: options.to,
    type: "text",
    text: {
      body: options.text,
    },
  };

  try {
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${options.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Meta API Error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      messageId: data.messages[0].id,
      status: "sent",
    };
  } catch (error) {
    console.error("Erro ao enviar mensagem de texto:", error);
    throw error;
  }
}

/**
 * Envia mensagem de template
 */
export async function sendTemplateMessage(
  options: SendTemplateMessageOptions
): Promise<{ messageId: string; status: string }> {
  const payload = {
    messaging_product: "whatsapp",
    to: options.to,
    type: "template",
    template: {
      name: options.templateName,
      language: {
        code: options.language || "pt_BR",
      },
      ...(options.parameters && {
        components: [
          {
            type: "body",
            parameters: options.parameters.map((param) => ({
              type: "text",
              text: param,
            })),
          },
        ],
      }),
    },
  };

  try {
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${options.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Meta API Error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      messageId: data.messages[0].id,
      status: "sent",
    };
  } catch (error) {
    console.error("Erro ao enviar template:", error);
    throw error;
  }
}

/**
 * Envia mensagem com mídia
 */
export async function sendMediaMessage(
  options: SendMediaMessageOptions
): Promise<{ messageId: string; status: string }> {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: options.to,
    type: options.type,
    [options.type]: {
      ...(options.mediaId && { id: options.mediaId }),
      ...(options.mediaUrl && { link: options.mediaUrl }),
      ...(options.caption && { caption: options.caption }),
      ...(options.filename && { filename: options.filename }),
    },
  };

  try {
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${options.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Meta API Error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      messageId: data.messages[0].id,
      status: "sent",
    };
  } catch (error) {
    console.error("Erro ao enviar mídia:", error);
    throw error;
  }
}

/**
 * Envia localização
 */
export async function sendLocationMessage(
  options: SendLocationMessageOptions
): Promise<{ messageId: string; status: string }> {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: options.to,
    type: "location",
    location: {
      latitude: options.latitude,
      longitude: options.longitude,
      ...(options.name && { name: options.name }),
      ...(options.address && { address: options.address }),
    },
  };

  try {
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${options.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Meta API Error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      messageId: data.messages[0].id,
      status: "sent",
    };
  } catch (error) {
    console.error("Erro ao enviar localização:", error);
    throw error;
  }
}

/**
 * Marca mensagem como lida
 */
export async function markAsRead(
  options: MarkAsReadOptions
): Promise<{ success: boolean }> {
  const payload = {
    messaging_product: "whatsapp",
    status: "read",
    message_id: options.messageId,
  };

  try {
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${options.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Meta API Error: ${JSON.stringify(error)}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Erro ao marcar como lida:", error);
    throw error;
  }
}
