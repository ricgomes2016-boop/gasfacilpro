/**
 * Hook React para sincronização em tempo real do WhatsApp
 * 
 * Fornece:
 * - Mensagens em tempo real por conversa
 * - Status de conexão
 * - Typing indicators
 * - Auto-reconexão
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { whatsappRealtime, RealtimeMessage, TypingIndicator } from "@/services/whatsappRealtimeService";

interface UseWhatsAppRealtimeOptions {
  conversaId?: string | null;
  empresaId?: string | null;
  autoSubscribe?: boolean;
}

interface UseWhatsAppRealtimeReturn {
  messages: RealtimeMessage[];
  isConnected: boolean;
  typingUsers: TypingIndicator[];
  sendTyping: (userId: string, userName: string, isTyping: boolean) => void;
  clearMessages: () => void;
}

export function useWhatsAppRealtime(options: UseWhatsAppRealtimeOptions = {}): UseWhatsAppRealtimeReturn {
  const { conversaId, empresaId, autoSubscribe = true } = options;
  
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Escutar mudanças de conexão
  useEffect(() => {
    const unsubscribe = whatsappRealtime.onConnectionChange((status) => {
      setIsConnected(status === "connected");
    });
    return unsubscribe;
  }, []);

  // Escutar mensagens da conversa selecionada
  useEffect(() => {
    if (!conversaId || !autoSubscribe) return;

    whatsappRealtime.subscribeToConversation(conversaId);

    const unsubscribe = whatsappRealtime.onMessage((message) => {
      if (message.conversa_id === conversaId) {
        setMessages((prev) => {
          // Evitar duplicatas
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    });

    return () => {
      unsubscribe();
      whatsappRealtime.unsubscribeFromConversation(conversaId);
    };
  }, [conversaId, autoSubscribe]);

  // Escutar typing indicators
  useEffect(() => {
    if (!conversaId) return;

    whatsappRealtime.subscribeToTyping(conversaId);

    const unsubscribe = whatsappRealtime.onTyping((indicator) => {
      if (indicator.conversa_id !== conversaId) return;

      if (indicator.is_typing) {
        setTypingUsers((prev) => {
          const existing = prev.find((t) => t.user_id === indicator.user_id);
          if (existing) return prev;
          return [...prev, indicator];
        });

        // Auto-remove após 5 segundos
        const existingTimeout = typingTimeoutsRef.current.get(indicator.user_id);
        if (existingTimeout) clearTimeout(existingTimeout);

        const timeout = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((t) => t.user_id !== indicator.user_id));
          typingTimeoutsRef.current.delete(indicator.user_id);
        }, 5000);

        typingTimeoutsRef.current.set(indicator.user_id, timeout);
      } else {
        setTypingUsers((prev) => prev.filter((t) => t.user_id !== indicator.user_id));
        const timeout = typingTimeoutsRef.current.get(indicator.user_id);
        if (timeout) {
          clearTimeout(timeout);
          typingTimeoutsRef.current.delete(indicator.user_id);
        }
      }
    });

    return () => {
      unsubscribe();
      // Limpar timeouts
      for (const timeout of typingTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      typingTimeoutsRef.current.clear();
    };
  }, [conversaId]);

  // Escutar atualizações de sessão
  useEffect(() => {
    if (!empresaId) return;
    whatsappRealtime.subscribeToSessionUpdates(empresaId);
    return () => {
      // Cleanup handled by disconnectAll
    };
  }, [empresaId]);

  // Enviar typing indicator
  const sendTyping = useCallback(
    (userId: string, userName: string, isTyping: boolean) => {
      if (!conversaId) return;
      whatsappRealtime.sendTypingIndicator(conversaId, userId, userName, isTyping);
    },
    [conversaId]
  );

  // Limpar mensagens
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isConnected,
    typingUsers,
    sendTyping,
    clearMessages,
  };
}

/**
 * Hook para escutar todas as conversas (inbox) de UMA empresa.
 * Sem empresaId não inscreve — evita vazamento cross-tenant.
 */
export function useWhatsAppInboxRealtime(empresaId?: string | null) {
  const [newMessages, setNewMessages] = useState<RealtimeMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    whatsappRealtime.subscribeToAllConversations(empresaId);

    const unsubMessage = whatsappRealtime.onMessage((message) => {
      setNewMessages((prev) => [...prev.slice(-50), message]);
    });

    const unsubConnection = whatsappRealtime.onConnectionChange((status) => {
      setIsConnected(status === "connected");
    });

    return () => {
      unsubMessage();
      unsubConnection();
    };
  }, [empresaId]);

  const clearNewMessages = useCallback(() => {
    setNewMessages([]);
  }, []);

  return { newMessages, isConnected, clearNewMessages };
}
