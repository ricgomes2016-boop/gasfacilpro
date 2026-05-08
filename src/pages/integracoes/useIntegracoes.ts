import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { IntegracaoConfig } from "./types";

export function useIntegracoes(unidadeId: string) {
  const [configs, setConfigs] = useState<Record<string, IntegracaoConfig>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar configurações existentes
  const loadConfigs = useCallback(async () => {
    if (!unidadeId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: err } = await supabase
        .from("integracao_configs")
        .select("*")
        .eq("unidade_id", unidadeId);

      if (err) throw err;

      const configMap: Record<string, IntegracaoConfig> = {};
      data?.forEach((config) => {
        configMap[config.integracao_id] = config;
      });
      setConfigs(configMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar configurações";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [unidadeId]);

  // Salvar configuração
  const saveConfig = useCallback(
    async (integracaoId: string, configData: Record<string, unknown>) => {
      if (!unidadeId) return;

      try {
        const existing = configs[integracaoId];

        if (existing) {
          // Atualizar
          const { error: err } = await supabase
            .from("integracao_configs")
            .update({
              config_data: configData,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (err) throw err;
        } else {
          // Criar novo
          const { error: err } = await supabase
            .from("integracao_configs")
            .insert([
              {
                integracao_id: integracaoId,
                unidade_id: unidadeId,
                config_data: configData,
                ativo: true,
              },
            ]);

          if (err) throw err;
        }

        // Recarregar
        await loadConfigs();
        toast.success("Configuração salva com sucesso!");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao salvar configuração";
        toast.error(message);
        throw err;
      }
    },
    [unidadeId, configs, loadConfigs]
  );

  // Deletar configuração
  const deleteConfig = useCallback(
    async (integracaoId: string) => {
      if (!unidadeId) return;

      try {
        const config = configs[integracaoId];
        if (!config) return;

        const { error: err } = await supabase
          .from("integracao_configs")
          .delete()
          .eq("id", config.id);

        if (err) throw err;

        setConfigs((prev) => {
          const newConfigs = { ...prev };
          delete newConfigs[integracaoId];
          return newConfigs;
        });

        toast.success("Configuração removida!");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao deletar configuração";
        toast.error(message);
        throw err;
      }
    },
    [unidadeId, configs]
  );

  // Testar conexão
  const testConnection = useCallback(
    async (integracaoId: string, configData: Record<string, unknown>) => {
      try {
        // Aqui você pode implementar testes específicos para cada integração
        // Por exemplo, validar credenciais, fazer chamada à API, etc.
        
        const response = await fetch("/api/integracoes/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            integracaoId,
            config: configData,
          }),
        });

        if (!response.ok) {
          throw new Error("Falha ao testar conexão");
        }

        toast.success("Conexão testada com sucesso!");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao testar conexão";
        toast.error(message);
        return false;
      }
    },
    []
  );

  // Carregar configs ao montar
  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  return {
    configs,
    isLoading,
    error,
    saveConfig,
    deleteConfig,
    testConnection,
    loadConfigs,
  };
}
