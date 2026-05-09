/**
 * Hook para gerenciar sessão de WhatsApp Web
 * 
 * Integra com:
 * - whatsappSessionService (persistência no Supabase)
 * - whatsappRealtimeService (atualizações em tempo real)
 * - integracoes_whatsapp (configuração do provedor)
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface WhatsAppSessionState {
  isConnected: boolean;
  isLoading: boolean;
  phoneNumber: string | null;
  provedor: string | null;
  instanceId: string | null;
  statusConexao: string | null;
  qrCode: string | null;
  error: string | null;
}

export function useWhatsAppSession(unidadeId?: string | null) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<WhatsAppSessionState>({
    isConnected: false,
    isLoading: true,
    phoneNumber: null,
    provedor: null,
    instanceId: null,
    statusConexao: null,
    qrCode: null,
    error: null,
  });

  // Buscar integração ativa
  const { data: integracao, refetch } = useQuery({
    queryKey: ["whatsapp-session", unidadeId],
    queryFn: async () => {
      let query = supabase
        .from("integracoes_whatsapp")
        .select("*")
        .eq("ativo", true);

      if (unidadeId) {
        query = query.eq("unidade_id", unidadeId);
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  // Atualizar estado com dados da integração
  useEffect(() => {
    if (integracao) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isConnected: integracao.status_conexao === "conectado",
        phoneNumber: integracao.numero_telefone || null,
        provedor: integracao.provedor || null,
        instanceId: integracao.instance_id || null,
        statusConexao: integracao.status_conexao || null,
        qrCode: integracao.qr_code_base64 || null,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [integracao]);

  // Realtime: escutar mudanças
  useEffect(() => {
    if (!integracao?.id) return;

    const channel = supabase
      .channel(`session-watch-${integracao.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "integracoes_whatsapp",
          filter: `id=eq.${integracao.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setState((prev) => ({
            ...prev,
            isConnected: updated.status_conexao === "conectado",
            phoneNumber: updated.numero_telefone || prev.phoneNumber,
            statusConexao: updated.status_conexao || prev.statusConexao,
            qrCode: updated.qr_code_base64 || null,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [integracao?.id]);

  // Reconectar
  const reconnect = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    await refetch();
    setState((prev) => ({ ...prev, isLoading: false }));
  }, [refetch]);

  // Desconectar
  const disconnect = useCallback(async () => {
    if (!integracao) return;

    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      if (integracao.provedor === "evolution") {
        await supabase.functions.invoke("evolution-proxy", {
          body: {
            action: "logout",
            instance_id: integracao.instance_id,
            unidade_id: unidadeId,
          },
        });
      }

      await supabase
        .from("integracoes_whatsapp")
        .update({ status_conexao: "desconectado", qr_code_base64: null })
        .eq("id", integracao.id);

      setState((prev) => ({
        ...prev,
        isConnected: false,
        isLoading: false,
        qrCode: null,
        statusConexao: "desconectado",
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message,
      }));
    }
  }, [integracao, unidadeId]);

  return {
    ...state,
    integracao,
    reconnect,
    disconnect,
    refetch,
  };
}
