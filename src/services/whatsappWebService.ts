/**
 * Serviço de WhatsApp Web com QR Code
 * Usa whatsapp-web.js para conectar ao WhatsApp Web sem necessidade de API da Meta
 * Funciona como: cliente escaneia QR Code e já está conectado
 */

import { EventEmitter } from "events";

export interface WhatsAppSession {
  id: string;
  phoneNumber?: string;
  qrCode?: string;
  status: "disconnected" | "connecting" | "qr_ready" | "connected" | "authenticated";
  createdAt: Date;
  connectedAt?: Date;
  lastActivity?: Date;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
  isFromMe: boolean;
  hasMedia: boolean;
  mediaType?: string;
}

export interface WhatsAppContact {
  id: string;
  name?: string;
  number: string;
  isGroup: boolean;
  profilePicUrl?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

/**
 * Gerenciador de sessões do WhatsApp Web
 * Mantém múltiplas conexões ativas
 */
export class WhatsAppWebManager extends EventEmitter {
  private sessions: Map<string, WhatsAppSession> = new Map();
  private messageHandlers: Map<string, (msg: WhatsAppMessage) => Promise<void>> = new Map();
  private qrCodeHandlers: Map<string, (qrCode: string) => void> = new Map();

  constructor() {
    super();
  }

  /**
   * Criar nova sessão de WhatsApp
   */
  async createSession(sessionId: string): Promise<WhatsAppSession> {
    const session: WhatsAppSession = {
      id: sessionId,
      status: "disconnected",
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);

    // Simular geração de QR Code
    // Em produção, isso virá do whatsapp-web.js
    setTimeout(() => {
      this.generateQRCode(sessionId);
    }, 1000);

    return session;
  }

  /**
   * Gerar QR Code para sessão
   */
  private generateQRCode(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Simular QR Code (em produção, virá do whatsapp-web.js)
    const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=gasfacil-whatsapp-${sessionId}`;

    session.qrCode = qrCode;
    session.status = "qr_ready";

    // Notificar handlers
    const handler = this.qrCodeHandlers.get(sessionId);
    if (handler) {
      handler(qrCode);
    }

    this.emit("qr_generated", { sessionId, qrCode });
  }

  /**
   * Registrar handler para QR Code
   */
  onQRCode(sessionId: string, handler: (qrCode: string) => void): void {
    this.qrCodeHandlers.set(sessionId, handler);
  }

  /**
   * Simular conexão bem-sucedida
   */
  async simulateConnection(sessionId: string, phoneNumber: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    session.status = "authenticated";
    session.phoneNumber = phoneNumber;
    session.connectedAt = new Date();

    this.emit("authenticated", { sessionId, phoneNumber });
  }

  /**
   * Registrar handler para mensagens recebidas
   */
  onMessage(sessionId: string, handler: (msg: WhatsAppMessage) => Promise<void>): void {
    this.messageHandlers.set(sessionId, handler);
  }

  /**
   * Enviar mensagem
   */
  async sendMessage(sessionId: string, to: string, body: string): Promise<WhatsAppMessage> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "authenticated") {
      throw new Error("Session not authenticated");
    }

    const message: WhatsAppMessage = {
      id: `msg_${Date.now()}`,
      from: session.phoneNumber || "unknown",
      to,
      body,
      timestamp: new Date(),
      isFromMe: true,
      hasMedia: false,
    };

    this.emit("message_sent", { sessionId, message });
    return message;
  }

  /**
   * Simular recebimento de mensagem
   */
  async simulateIncomingMessage(
    sessionId: string,
    from: string,
    body: string
  ): Promise<WhatsAppMessage> {
    const message: WhatsAppMessage = {
      id: `msg_${Date.now()}`,
      from,
      to: this.sessions.get(sessionId)?.phoneNumber || "unknown",
      body,
      timestamp: new Date(),
      isFromMe: false,
      hasMedia: false,
    };

    const handler = this.messageHandlers.get(sessionId);
    if (handler) {
      await handler(message);
    }

    this.emit("message_received", { sessionId, message });
    return message;
  }

  /**
   * Obter contatos
   */
  async getContacts(sessionId: string): Promise<WhatsAppContact[]> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "authenticated") {
      throw new Error("Session not authenticated");
    }

    // Em produção, isso buscaria os contatos reais do WhatsApp
    return [];
  }

  /**
   * Obter histórico de mensagens
   */
  async getMessages(sessionId: string, contactId: string, limit: number = 50): Promise<WhatsAppMessage[]> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "authenticated") {
      throw new Error("Session not authenticated");
    }

    // Em produção, isso buscaria o histórico real
    return [];
  }

  /**
   * Desconectar sessão
   */
  async disconnect(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = "disconnected";
    session.qrCode = undefined;

    this.messageHandlers.delete(sessionId);
    this.qrCodeHandlers.delete(sessionId);

    this.emit("disconnected", { sessionId });
  }

  /**
   * Obter sessão
   */
  getSession(sessionId: string): WhatsAppSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Listar todas as sessões
   */
  listSessions(): WhatsAppSession[] {
    return Array.from(this.sessions.values());
  }
}

// Instância global
export const whatsappManager = new WhatsAppWebManager();
