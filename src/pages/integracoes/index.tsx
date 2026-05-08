import { useState, lazy, Suspense } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Loader2 } from "lucide-react";
import { IntegracoesList } from "./IntegracoesList";
import { IntegracaoForm } from "./IntegracaoForm";
import { IntegracaoTester } from "./IntegracaoTester";
import { useIntegracoes } from "./useIntegracoes";
import { integracoesData } from "./integracoesData";
import type { Integracao } from "./types";

// Lazy load o formulário para melhor performance
const LazyIntegracaoForm = lazy(() =>
  Promise.resolve({ default: IntegracaoForm })
);

export default function Integracoes() {
  const { empresa } = useEmpresa();
  const { unidades, unidadeSelecionada } = useUnidade();
  
  const [selectedIntegracao, setSelectedIntegracao] = useState<Integracao | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [showTester, setShowTester] = useState(false);

  // Hook para gerenciar configurações
  const {
    configs,
    isLoading,
    saveConfig,
    deleteConfig,
    testConnection,
  } = useIntegracoes(unidadeSelecionada?.id || "");

  const configuredIds = Object.keys(configs);

  const handleConfigure = (integracao: Integracao) => {
    setSelectedIntegracao(integracao);
    setFormOpen(true);
    setShowTester(false);
  };

  const handleSaveConfig = async (configData: Record<string, unknown>) => {
    if (!selectedIntegracao) return;
    await saveConfig(selectedIntegracao.id, configData);
    setFormOpen(false);
  };

  const handleTestConnection = async () => {
    if (!selectedIntegracao) return;
    const config = configs[selectedIntegracao.id]?.config_data || {};
    await testConnection(selectedIntegracao.id, config);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <Header
          title="Integrações"
          description="Configure e gerencie integrações com serviços externos"
        />

        {/* Lista de Integrações */}
        <IntegracoesList
          integracoes={integracoesData}
          configuredIds={configuredIds}
          onConfigure={handleConfigure}
          isLoading={isLoading}
        />

        {/* Formulário de Configuração */}
        {formOpen && selectedIntegracao && (
          <Suspense fallback={<div className="flex items-center justify-center p-4"><Loader2 className="animate-spin" /></div>}>
            <LazyIntegracaoForm
              integracao={selectedIntegracao}
              onSave={handleSaveConfig}
              onClose={() => setFormOpen(false)}
              isLoading={isLoading}
            />
          </Suspense>
        )}

        {/* Testador de Conexão */}
        {showTester && selectedIntegracao && (
          <IntegracaoTester
            integracao={selectedIntegracao}
            config={configs[selectedIntegracao.id]?.config_data || {}}
            onTest={handleTestConnection}
            isLoading={isLoading}
          />
        )}
      </div>
    </MainLayout>
  );
}
