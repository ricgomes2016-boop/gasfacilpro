/**
 * Helpers de banco de dados para WhatsApp
 * Integração com Supabase
 */

import { supabase } from "./client";

export interface WhatsappConfigData {
  empresa_id: number;
  unidade_id: number;
  business_account_id: string;
  phone_number_id: string;
  phone_number: string;
  access_token: string;
  verify_token: string;
  is_active: boolean;
  display_name?: string;
}

export interface WhatsappContactData {
  empresa_id: number;
  wa_id: string;
  display_name?: string;
  cliente_id?: number;
}

export interface WhatsappConversationData {
  empresa_id: number;
  unidade_id: number;
  contact_id: number;
  config_id: number;
  status: "active" | "closed" | "archived" | "transferred";
  assigned_to_user_id?: number;
  subject?: string;
  order_id?: number;
}

export interface WhatsappMessageData {
  conversation_id: number;
  contact_id: number;
  wa_message_id?: string;
  type: string;
  content: string;
  direction: "inbound" | "outbound";
  sender: string;
  status: "sent" | "delivered" | "read" | "failed" | "pending";
  processed_by_ai?: boolean;
  ai_response?: string;
  ai_confidence?: number;
  ai_intent?: string;
}

/**
 * Obter configuração do WhatsApp
 */
export async function getWhatsappConfig(empresaId: number, unidadeId: number) {
  const { data, error } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .eq("is_active", true)
    .single();

  if (error) {
    console.error("Erro ao obter configuração WhatsApp:", error);
    return null;
  }

  return data;
}

/**
 * Criar ou atualizar configuração do WhatsApp
 */
export async function upsertWhatsappConfig(config: WhatsappConfigData) {
  const { data, error } = await supabase
    .from("whatsapp_config")
    .upsert(config, {
      onConflict: "empresa_id,unidade_id",
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao salvar configuração WhatsApp:", error);
    throw error;
  }

  return data;
}

/**
 * Obter ou criar contato do WhatsApp
 */
export async function getOrCreateContact(
  empresaId: number,
  waId: string,
  displayName?: string
) {
  // Tentar obter contato existente
  const { data: existing } = await supabase
    .from("whatsapp_contacts")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("wa_id", waId)
    .single();

  if (existing) {
    return existing;
  }

  // Criar novo contato
  const { data: newContact, error } = await supabase
    .from("whatsapp_contacts")
    .insert({
      empresa_id: empresaId,
      wa_id: waId,
      display_name: displayName,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar contato WhatsApp:", error);
    throw error;
  }

  return newContact;
}

/**
 * Obter ou criar conversa
 */
export async function getOrCreateConversation(
  empresaId: number,
  unidadeId: number,
  contactId: number,
  configId: number
) {
  // Tentar obter conversa ativa
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("contact_id", contactId)
    .eq("status", "active")
    .single();

  if (existing) {
    return existing;
  }

  // Criar nova conversa
  const { data: newConversation, error } = await supabase
    .from("whatsapp_conversations")
    .insert({
      empresa_id: empresaId,
      unidade_id: unidadeId,
      contact_id: contactId,
      config_id: configId,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar conversa WhatsApp:", error);
    throw error;
  }

  return newConversation;
}

/**
 * Salvar mensagem
 */
export async function saveMessage(message: WhatsappMessageData) {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .insert(message)
    .select()
    .single();

  if (error) {
    console.error("Erro ao salvar mensagem WhatsApp:", error);
    throw error;
  }

  return data;
}

/**
 * Obter mensagens de uma conversa
 */
export async function getConversationMessages(conversationId: number) {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao obter mensagens:", error);
    return [];
  }

  return data || [];
}

/**
 * Obter conversas de uma empresa
 */
export async function getConversations(empresaId: number, unidadeId?: number) {
  let query = supabase
    .from("whatsapp_conversations")
    .select(
      `
      *,
      contact:whatsapp_contacts(*),
      messages:whatsapp_messages(count)
    `
    )
    .eq("empresa_id", empresaId);

  if (unidadeId) {
    query = query.eq("unidade_id", unidadeId);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) {
    console.error("Erro ao obter conversas:", error);
    return [];
  }

  return data || [];
}

/**
 * Atualizar status de conversa
 */
export async function updateConversationStatus(
  conversationId: number,
  status: "active" | "closed" | "archived" | "transferred"
) {
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar status da conversa:", error);
    throw error;
  }

  return data;
}

/**
 * Transferir conversa para atendente
 */
export async function transferConversation(
  conversationId: number,
  userId: number
) {
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .update({
      status: "transferred",
      assigned_to_user_id: userId,
      transferred_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .select()
    .single();

  if (error) {
    console.error("Erro ao transferir conversa:", error);
    throw error;
  }

  return data;
}

/**
 * Atualizar status de mensagem
 */
export async function updateMessageStatus(
  messageId: number,
  status: "sent" | "delivered" | "read" | "failed"
) {
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .update({ status })
    .eq("id", messageId)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar status de mensagem:", error);
    throw error;
  }

  return data;
}

/**
 * Registrar evento
 */
export async function logEvent(
  eventType: string,
  conversationId?: number,
  messageId?: number,
  contactId?: number,
  eventData?: any
) {
  const { error } = await supabase.from("whatsapp_events").insert({
    event_type: eventType,
    conversation_id: conversationId,
    message_id: messageId,
    contact_id: contactId,
    event_data: eventData,
  });

  if (error) {
    console.error("Erro ao registrar evento:", error);
  }
}

/**
 * Obter estatísticas de conversas
 */
export async function getConversationStats(empresaId: number) {
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("status")
    .eq("empresa_id", empresaId);

  if (error) {
    console.error("Erro ao obter estatísticas:", error);
    return {
      total: 0,
      active: 0,
      closed: 0,
      transferred: 0,
    };
  }

  const stats = {
    total: data?.length || 0,
    active: data?.filter((c) => c.status === "active").length || 0,
    closed: data?.filter((c) => c.status === "closed").length || 0,
    transferred: data?.filter((c) => c.status === "transferred").length || 0,
  };

  return stats;
}
