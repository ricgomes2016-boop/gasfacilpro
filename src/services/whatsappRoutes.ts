/**
 * Rotas tRPC para WhatsApp
 * Integração entre frontend e backend
 */

import { z } from "zod";
import * as whatsappDb from "@/integrations/supabase/whatsappDb";
import { processMessageWithBIA } from "./whatsappBIAProcessor";
import { sendTextMessage } from "./whatsappSender";

/**
 * Schema de validação para configuração
 */
export const whatsappConfigSchema = z.object({
  businessAccountId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  phoneNumber: z.string().min(1),
  displayName: z.string().optional(),
  accessToken: z.string().min(1),
  verifyToken: z.string().optional(),
});

/**
 * Schema para envio de mensagem
 */
export const sendMessageSchema = z.object({
  conversationId: z.number(),
  content: z.string().min(1),
});

/**
 * Schema para transferência
 */
export const transferConversationSchema = z.object({
  conversationId: z.number(),
  userId: z.number(),
});

/**
 * Tipos para as rotas
 */
export type WhatsappConfigInput = z.infer<typeof whatsappConfigSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type TransferConversationInput = z.infer<typeof transferConversationSchema>;

/**
 * Handlers das rotas (simulados aqui, seriam em um arquivo tRPC real)
 */

export async function handleGetConfigs(empresaId: number) {
  try {
    const config = await whatsappDb.getWhatsappConfig(empresaId, 1);
    return config ? [config] : [];
  } catch (error) {
    console.error("Erro ao obter configurações:", error);
    throw error;
  }
}

export async function handleSaveConfig(
  empresaId: number,
  unidadeId: number,
  input: WhatsappConfigInput
) {
  try {
    const config = await whatsappDb.upsertWhatsappConfig({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      business_account_id: input.businessAccountId,
      phone_number_id: input.phoneNumberId,
      phone_number: input.phoneNumber,
      access_token: input.accessToken,
      verify_token: input.verifyToken || "",
      is_active: true,
      display_name: input.displayName,
    });

    return config;
  } catch (error) {
    console.error("Erro ao salvar configuração:", error);
    throw error;
  }
}

export async function handleGetConversations(
  empresaId: number,
  unidadeId?: number
) {
  try {
    const conversations = await whatsappDb.getConversations(empresaId, unidadeId);
    return conversations;
  } catch (error) {
    console.error("Erro ao obter conversas:", error);
    throw error;
  }
}

export async function handleGetMessages(conversationId: number) {
  try {
    const messages = await whatsappDb.getConversationMessages(conversationId);
    return messages;
  } catch (error) {
    console.error("Erro ao obter mensagens:", error);
    throw error;
  }
}

export async function handleSendMessage(
  empresaId: number,
  input: SendMessageInput,
  userId: number
) {
  try {
    // Obter conversa
    const { data: conversation } = await (async () => {
      const supabase = (await import("@/integrations/supabase/client")).supabase;
      return supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("id", input.conversationId)
        .single();
    })();

    if (!conversation) {
      throw new Error("Conversa não encontrada");
    }

    // Obter contato
    const { data: contact } = await (async () => {
      const supabase = (await import("@/integrations/supabase/client")).supabase;
      return supabase
        .from("whatsapp_contacts")
        .select("*")
        .eq("id", conversation.contact_id)
        .single();
    })();

    if (!contact) {
      throw new Error("Contato não encontrado");
    }

    // Obter configuração
    const config = await whatsappDb.getWhatsappConfig(empresaId, conversation.unidade_id);
    if (!config) {
      throw new Error("Configuração WhatsApp não encontrada");
    }

    // Enviar mensagem via Meta API
    const result = await sendTextMessage({
      to: contact.wa_id,
      text: input.content,
      phoneNumberId: config.phone_number_id,
      accessToken: config.access_token,
    });

    // Salvar mensagem no banco
    const message = await whatsappDb.saveMessage({
      conversation_id: input.conversationId,
      contact_id: conversation.contact_id,
      wa_message_id: result.messageId,
      type: "text",
      content: input.content,
      direction: "outbound",
      sender: "agent",
      status: "sent",
    });

    // Registrar evento
    await whatsappDb.logEvent("message_sent", input.conversationId, message.id);

    return message;
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    throw error;
  }
}

export async function handleTransferConversation(
  input: TransferConversationInput
) {
  try {
    const conversation = await whatsappDb.transferConversation(
      input.conversationId,
      input.userId
    );

    // Registrar evento
    await whatsappDb.logEvent(
      "conversation_transferred",
      input.conversationId,
      undefined,
      undefined,
      { transferred_to_user_id: input.userId }
    );

    return conversation;
  } catch (error) {
    console.error("Erro ao transferir conversa:", error);
    throw error;
  }
}

export async function handleCloseConversation(conversationId: number) {
  try {
    const conversation = await whatsappDb.updateConversationStatus(
      conversationId,
      "closed"
    );

    // Registrar evento
    await whatsappDb.logEvent("conversation_closed", conversationId);

    return conversation;
  } catch (error) {
    console.error("Erro ao fechar conversa:", error);
    throw error;
  }
}

export async function handleProcessWebhook(
  empresaId: number,
  payload: any,
  verifyToken: string
) {
  try {
    // Validar token
    const config = await whatsappDb.getWhatsappConfig(empresaId, 1);
    if (!config || config.verify_token !== verifyToken) {
      throw new Error("Token de verificação inválido");
    }

    // Extrair dados da mensagem
    const entry = payload.entry?.[0];
    if (!entry) return null;

    const changes = entry.changes?.[0];
    if (!changes) return null;

    const value = changes.value;
    const messages = value.messages;
    const statuses = value.statuses;

    if (messages) {
      const message = messages[0];
      if (!message || message.type !== "text") return null;

      // Obter ou criar contato
      const contact = await whatsappDb.getOrCreateContact(
        empresaId,
        message.from,
        value.contacts?.[0]?.profile?.name
      );

      // Obter ou criar conversa
      const conversation = await whatsappDb.getOrCreateConversation(
        empresaId,
        1,
        contact.id,
        config.id
      );

      // Processar com BIA
      const processed = await processMessageWithBIA(
        message.text.body,
        contact.display_name || "Cliente",
        message.from
      );

      // Salvar mensagem
      const savedMessage = await whatsappDb.saveMessage({
        conversation_id: conversation.id,
        contact_id: contact.id,
        wa_message_id: message.id,
        type: "text",
        content: message.text.body,
        direction: "inbound",
        sender: message.from,
        status: "delivered",
        processed_by_ai: true,
        ai_response: processed.response,
        ai_confidence: processed.confidence,
        ai_intent: processed.intent,
      });

      // Se deve transferir, atualizar status
      if (processed.shouldTransfer) {
        await whatsappDb.updateConversationStatus(conversation.id, "transferred");
        await whatsappDb.logEvent(
          "auto_transfer_triggered",
          conversation.id,
          savedMessage.id,
          contact.id,
          { reason: processed.transferReason }
        );
      }

      // Enviar resposta automática
      if (!processed.shouldTransfer) {
        await sendTextMessage({
          to: message.from,
          text: processed.response,
          phoneNumberId: config.phone_number_id,
          accessToken: config.access_token,
        });
      }

      return savedMessage;
    }

    if (statuses) {
      const status = statuses[0];
      if (status) {
        // Atualizar status de mensagem
        const { data: message } = await (async () => {
          const supabase = (await import("@/integrations/supabase/client"))
            .supabase;
          return supabase
            .from("whatsapp_messages")
            .select("id")
            .eq("wa_message_id", status.id)
            .single();
        })();

        if (message) {
          await whatsappDb.updateMessageStatus(message.id, status.status);
          await whatsappDb.logEvent(
            "message_status_updated",
            undefined,
            message.id,
            undefined,
            { new_status: status.status }
          );
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Erro ao processar webhook:", error);
    throw error;
  }
}

export async function handleGetStats(empresaId: number) {
  try {
    const stats = await whatsappDb.getConversationStats(empresaId);
    return stats;
  } catch (error) {
    console.error("Erro ao obter estatísticas:", error);
    throw error;
  }
}
