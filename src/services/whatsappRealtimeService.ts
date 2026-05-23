/**
 * Serviço de Sincronização em Tempo Real para WhatsApp
 * 
 * Usa Supabase Realtime (channels + postgres_changes) para:
 * - Sincronizar mensagens instantaneamente
 * - Notificar sobre novas conversas
 * - Atualizar status de sessões
 * - Broadcast de typing indicators
 */

import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface RealtimeMessage {
  id: string;
  conversa_id: string;
  role: string;
  content: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface RealtimeSessionUpdate {
  session_id: string;
  status: string;
  phone_number?: string;
  qr_code?: string;
}

export interface TypingIndicator {
  conversa_id: string;
  user_id: string;
  user_name: string;
  is_typing: boolean;
}

type MessageHandler = (message: RealtimeMessage) => void;
type SessionHandler = (update: RealtimeSessionUpdate) => void;
type TypingHandler = (indicator: TypingIndicator) => void;
type ConnectionHandler = (status: "connected" | "disconnected" | "error") => void;

/**
 * Gerenciador de conexões em tempo real para WhatsApp
 */
export class WhatsAppRealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private messageHandlers: Set<MessageHandler> = new Set();
  private sessionHandlers: Set<SessionHandler> = new Set();
  private typingHandlers: Set<TypingHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;

  /**
   * Iniciar escuta de mensagens para uma conversa específica
   */
  subscribeToConversation(conversaId: string): void {
    const channelName = `wa-msgs-${conversaId}`;
    
    if (this.channels.has(channelName)) return;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ai_mensagens",
          filter: `conversa_id=eq.${conversaId}`,
        },
        (payload) => {
          const message = payload.new as RealtimeMessage;
          this.notifyMessageHandlers(message);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.notifyConnectionHandlers("connected");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          this.handleDisconnection(channelName);
        }
      });

    this.channels.set(channelName, channel);
  }

  /**
   * Parar escuta de uma conversa
   */
  unsubscribeFromConversation(conversaId: string): void {
    const channelName = `wa-msgs-${conversaId}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  /**
   * Escutar atualizações de sessão (QR Code, status)
   */
  subscribeToSessionUpdates(empresaId: string): void {
    const channelName = `wa-session-${empresaId}`;
    
    if (this.channels.has(channelName)) return;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_web_sessions",
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload) => {
          const update = payload.new as any;
          this.notifySessionHandlers({
            session_id: update.session_id,
            status: update.status,
            phone_number: update.phone_number,
            qr_code: update.qr_code,
          });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
  }

  /**
   * Escutar todas as conversas de UMA empresa (para inbox).
   * O empresaId é OBRIGATÓRIO — proíbe escuta global cross-tenant.
   */
  subscribeToAllConversations(empresaId: string): void {
    if (!empresaId) {
      console.warn("[whatsappRealtime] subscribeToAllConversations chamado sem empresaId — ignorando");
      return;
    }
    const channelName = `wa-empresa-${empresaId}`;

    if (this.channels.has(channelName)) return;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ai_mensagens",
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload) => {
          const message = payload.new as RealtimeMessage;
          this.notifyMessageHandlers(message);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_conversas",
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => {
          // Handlers podem refetch a lista
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
  }

  /**
   * Broadcast de typing indicator
   */
  sendTypingIndicator(conversaId: string, userId: string, userName: string, isTyping: boolean): void {
    const channelName = `wa-typing-${conversaId}`;
    
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = supabase.channel(channelName);
      channel.subscribe();
      this.channels.set(channelName, channel);
    }

    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { conversa_id: conversaId, user_id: userId, user_name: userName, is_typing: isTyping },
    });
  }

  /**
   * Escutar typing indicators de uma conversa
   */
  subscribeToTyping(conversaId: string): void {
    const channelName = `wa-typing-${conversaId}`;
    
    if (this.channels.has(channelName)) return;

    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event: "typing" }, (payload) => {
        this.notifyTypingHandlers(payload.payload as TypingIndicator);
      })
      .subscribe();

    this.channels.set(channelName, channel);
  }

  /**
   * Registrar handler para mensagens
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Registrar handler para atualizações de sessão
   */
  onSessionUpdate(handler: SessionHandler): () => void {
    this.sessionHandlers.add(handler);
    return () => this.sessionHandlers.delete(handler);
  }

  /**
   * Registrar handler para typing indicators
   */
  onTyping(handler: TypingHandler): () => void {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  /**
   * Registrar handler para mudanças de conexão
   */
  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  /**
   * Desconectar todos os canais
   */
  disconnectAll(): void {
    for (const [name, channel] of this.channels) {
      supabase.removeChannel(channel);
    }
    this.channels.clear();
    this.isConnected = false;
    this.notifyConnectionHandlers("disconnected");
  }

  /**
   * Verificar status da conexão
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Obter número de canais ativos
   */
  getActiveChannelsCount(): number {
    return this.channels.size;
  }

  // === Private Methods ===

  private notifyMessageHandlers(message: RealtimeMessage): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (error) {
        console.error("Erro no handler de mensagem:", error);
      }
    }
  }

  private notifySessionHandlers(update: RealtimeSessionUpdate): void {
    for (const handler of this.sessionHandlers) {
      try {
        handler(update);
      } catch (error) {
        console.error("Erro no handler de sessão:", error);
      }
    }
  }

  private notifyTypingHandlers(indicator: TypingIndicator): void {
    for (const handler of this.typingHandlers) {
      try {
        handler(indicator);
      } catch (error) {
        console.error("Erro no handler de typing:", error);
      }
    }
  }

  private notifyConnectionHandlers(status: "connected" | "disconnected" | "error"): void {
    for (const handler of this.connectionHandlers) {
      try {
        handler(status);
      } catch (error) {
        console.error("Erro no handler de conexão:", error);
      }
    }
  }

  private handleDisconnection(channelName: string): void {
    this.isConnected = false;
    this.notifyConnectionHandlers("disconnected");

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
        const channel = this.channels.get(channelName);
        if (channel) {
          supabase.removeChannel(channel);
          this.channels.delete(channelName);
        }
        // Re-subscribe will happen on next interaction
      }, delay);
    } else {
      this.notifyConnectionHandlers("error");
    }
  }
}

// Instância singleton
export const whatsappRealtime = new WhatsAppRealtimeService();
