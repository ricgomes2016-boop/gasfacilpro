import {
  int,
  varchar,
  text,
  timestamp,
  boolean,
  mysqlEnum,
  mysqlTable,
  json,
  decimal,
} from "drizzle-orm/mysql-core";

/**
 * Configuração da integração WhatsApp Business
 */
export const whatsappConfig = mysqlTable("whatsapp_config", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresa_id").notNull(),
  unidadeId: int("unidade_id").notNull(),
  
  // Credenciais Meta
  businessAccountId: varchar("business_account_id", { length: 255 }).notNull(),
  phoneNumberId: varchar("phone_number_id", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  accessToken: text("access_token").notNull(), // Criptografado
  verifyToken: varchar("verify_token", { length: 255 }).notNull(),
  
  // Status
  isActive: boolean("is_active").default(true),
  isVerified: boolean("is_verified").default(false),
  
  // Metadados
  displayName: varchar("display_name", { length: 255 }),
  profilePictureUrl: text("profile_picture_url"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  lastSyncedAt: timestamp("last_synced_at"),
});

/**
 * Contatos do WhatsApp (clientes que iniciaram conversa)
 */
export const whatsappContacts = mysqlTable("whatsapp_contacts", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresa_id").notNull(),
  
  // Dados do contato
  waId: varchar("wa_id", { length: 20 }).notNull().unique(), // Número WhatsApp
  displayName: varchar("display_name", { length: 255 }),
  profilePictureUrl: text("profile_picture_url"),
  
  // Vinculação com cliente
  clienteId: int("cliente_id"), // FK para tabela de clientes
  
  // Status
  isBlocked: boolean("is_blocked").default(false),
  isFavorite: boolean("is_favorite").default(false),
  
  // Metadados
  lastMessageAt: timestamp("last_message_at"),
  messageCount: int("message_count").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

/**
 * Conversas (threads de mensagens)
 */
export const whatsappConversations = mysqlTable("whatsapp_conversations", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresa_id").notNull(),
  unidadeId: int("unidade_id").notNull(),
  
  // Referências
  contactId: int("contact_id").notNull(), // FK para whatsappContacts
  configId: int("config_id").notNull(), // FK para whatsappConfig
  
  // Status da conversa
  status: mysqlEnum("status", [
    "active",
    "closed",
    "archived",
    "transferred",
  ]).default("active"),
  
  // Atendimento
  assignedToUserId: int("assigned_to_user_id"), // Atendente responsável
  transferredAt: timestamp("transferred_at"),
  transferredToUserId: int("transferred_to_user_id"),
  
  // Dados da conversa
  subject: varchar("subject", { length: 255 }),
  lastMessageAt: timestamp("last_message_at"),
  messageCount: int("message_count").default(0),
  
  // Pedido vinculado (se aplicável)
  orderId: int("order_id"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  closedAt: timestamp("closed_at"),
});

/**
 * Mensagens do WhatsApp
 */
export const whatsappMessages = mysqlTable("whatsapp_messages", {
  id: int("id").autoincrement().primaryKey(),
  
  // Referências
  conversationId: int("conversation_id").notNull(), // FK
  contactId: int("contact_id").notNull(), // FK
  
  // ID da Meta
  waMessageId: varchar("wa_message_id", { length: 255 }).unique(),
  
  // Conteúdo
  type: mysqlEnum("type", [
    "text",
    "image",
    "video",
    "audio",
    "document",
    "location",
    "contact",
    "button",
    "list",
    "template",
    "order",
  ]).default("text"),
  
  content: text("content"), // Texto ou JSON para tipos complexos
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type", { length: 50 }), // image/jpeg, etc
  
  // Metadados
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  sender: varchar("sender", { length: 20 }), // wa_id do remetente
  
  // Status
  status: mysqlEnum("status", [
    "sent",
    "delivered",
    "read",
    "failed",
    "pending",
  ]).default("pending"),
  
  // IA
  processedByAI: boolean("processed_by_ai").default(false),
  aiResponse: text("ai_response"),
  aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }),
  aiIntent: varchar("ai_intent", { length: 100 }), // pedido, dúvida, reclamação, etc
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
});

/**
 * Templates de mensagens pré-aprovadas
 */
export const whatsappTemplates = mysqlTable("whatsapp_templates", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresa_id").notNull(),
  
  // Dados do template
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", [
    "MARKETING",
    "OTP",
    "TRANSACTIONAL",
    "UTILITY",
  ]).notNull(),
  
  // Conteúdo
  headerText: text("header_text"),
  bodyText: text("body_text").notNull(),
  footerText: text("footer_text"),
  buttons: json("buttons"), // Array de botões
  
  // Status na Meta
  metaTemplateId: varchar("meta_template_id", { length: 255 }),
  status: mysqlEnum("status", [
    "PENDING_REVIEW",
    "APPROVED",
    "REJECTED",
    "DISABLED",
  ]).default("PENDING_REVIEW"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  approvedAt: timestamp("approved_at"),
});

/**
 * Histórico de eventos do WhatsApp
 */
export const whatsappEvents = mysqlTable("whatsapp_events", {
  id: int("id").autoincrement().primaryKey(),
  
  // Referências
  conversationId: int("conversation_id"),
  messageId: int("message_id"),
  contactId: int("contact_id"),
  
  // Evento
  eventType: mysqlEnum("event_type", [
    "message_received",
    "message_sent",
    "message_delivered",
    "message_read",
    "message_failed",
    "contact_added",
    "conversation_opened",
    "conversation_closed",
    "transferred_to_human",
    "template_approved",
    "template_rejected",
  ]).notNull(),
  
  // Dados
  eventData: json("event_data"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Tipos exportados
 */
export type WhatsappConfig = typeof whatsappConfig.$inferSelect;
export type InsertWhatsappConfig = typeof whatsappConfig.$inferInsert;

export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = typeof whatsappContacts.$inferInsert;

export type WhatsappConversation = typeof whatsappConversations.$inferSelect;
export type InsertWhatsappConversation = typeof whatsappConversations.$inferInsert;

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = typeof whatsappMessages.$inferInsert;

export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type InsertWhatsappTemplate = typeof whatsappTemplates.$inferInsert;

export type WhatsappEvent = typeof whatsappEvents.$inferSelect;
export type InsertWhatsappEvent = typeof whatsappEvents.$inferInsert;
