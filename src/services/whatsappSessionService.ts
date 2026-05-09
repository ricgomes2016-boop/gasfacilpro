/**
 * Serviço de Persistência de Sessões WhatsApp Web
 * 
 * Gerencia sessões de WhatsApp Web com QR Code no Supabase,
 * permitindo reconexão automática e multi-tenant.
 */

import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppWebSession {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  session_id: string;
  phone_number: string | null;
  status: "disconnected" | "connecting" | "qr_ready" | "connected" | "authenticated" | "expired";
  qr_code: string | null;
  device_info: Record<string, any> | null;
  last_activity: string | null;
  connected_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionCreateInput {
  empresa_id: string;
  unidade_id?: string | null;
}

export interface SessionUpdateInput {
  status?: WhatsAppWebSession["status"];
  phone_number?: string | null;
  qr_code?: string | null;
  device_info?: Record<string, any> | null;
  last_activity?: string;
  connected_at?: string | null;
  expires_at?: string | null;
}

/**
 * Classe para gerenciar sessões de WhatsApp Web no Supabase
 */
export class WhatsAppSessionService {
  
  /**
   * Criar nova sessão de WhatsApp Web
   */
  async createSession(input: SessionCreateInput): Promise<WhatsAppWebSession | null> {
    const sessionId = `waweb_${input.empresa_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Expirar sessões anteriores da mesma empresa
    await this.expireOldSessions(input.empresa_id);
    
    const { data, error } = await supabase
      .from("whatsapp_web_sessions")
      .insert({
        empresa_id: input.empresa_id,
        unidade_id: input.unidade_id || null,
        session_id: sessionId,
        status: "connecting",
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutos
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar sessão:", error);
      return null;
    }

    return data as WhatsAppWebSession;
  }

  /**
   * Atualizar sessão existente
   */
  async updateSession(sessionId: string, updates: SessionUpdateInput): Promise<WhatsAppWebSession | null> {
    const { data, error } = await supabase
      .from("whatsapp_web_sessions")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar sessão:", error);
      return null;
    }

    return data as WhatsAppWebSession;
  }

  /**
   * Buscar sessão ativa por empresa
   */
  async getActiveSession(empresaId: string): Promise<WhatsAppWebSession | null> {
    const { data, error } = await supabase
      .from("whatsapp_web_sessions")
      .select("*")
      .eq("empresa_id", empresaId)
      .in("status", ["connected", "authenticated", "qr_ready"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar sessão ativa:", error);
      return null;
    }

    return data as WhatsAppWebSession | null;
  }

  /**
   * Buscar sessão por session_id
   */
  async getSessionById(sessionId: string): Promise<WhatsAppWebSession | null> {
    const { data, error } = await supabase
      .from("whatsapp_web_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar sessão:", error);
      return null;
    }

    return data as WhatsAppWebSession | null;
  }

  /**
   * Marcar sessão como conectada
   */
  async markConnected(sessionId: string, phoneNumber: string): Promise<WhatsAppWebSession | null> {
    return this.updateSession(sessionId, {
      status: "authenticated",
      phone_number: phoneNumber,
      connected_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      expires_at: null, // Sessão conectada não expira
    });
  }

  /**
   * Marcar sessão como desconectada
   */
  async markDisconnected(sessionId: string): Promise<void> {
    await this.updateSession(sessionId, {
      status: "disconnected",
      last_activity: new Date().toISOString(),
    });
  }

  /**
   * Atualizar QR Code da sessão
   */
  async updateQRCode(sessionId: string, qrCode: string): Promise<WhatsAppWebSession | null> {
    return this.updateSession(sessionId, {
      status: "qr_ready",
      qr_code: qrCode,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
  }

  /**
   * Registrar atividade na sessão
   */
  async recordActivity(sessionId: string): Promise<void> {
    await supabase
      .from("whatsapp_web_sessions")
      .update({ last_activity: new Date().toISOString() })
      .eq("session_id", sessionId);
  }

  /**
   * Expirar sessões antigas de uma empresa
   */
  async expireOldSessions(empresaId: string): Promise<void> {
    await supabase
      .from("whatsapp_web_sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("empresa_id", empresaId)
      .in("status", ["connecting", "qr_ready"]);
  }

  /**
   * Listar todas as sessões de uma empresa
   */
  async listSessions(empresaId: string): Promise<WhatsAppWebSession[]> {
    const { data, error } = await supabase
      .from("whatsapp_web_sessions")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Erro ao listar sessões:", error);
      return [];
    }

    return (data || []) as WhatsAppWebSession[];
  }

  /**
   * Verificar se sessão está expirada
   */
  isExpired(session: WhatsAppWebSession): boolean {
    if (!session.expires_at) return false;
    return new Date(session.expires_at) < new Date();
  }

  /**
   * Limpar sessões expiradas (cleanup)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const { data, error } = await supabase
      .from("whatsapp_web_sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .lt("expires_at", new Date().toISOString())
      .in("status", ["connecting", "qr_ready"])
      .select("id");

    if (error) {
      console.error("Erro ao limpar sessões expiradas:", error);
      return 0;
    }

    return data?.length || 0;
  }
}

// Instância singleton
export const whatsappSessionService = new WhatsAppSessionService();
