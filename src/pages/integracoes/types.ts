import { ReactNode } from "react";

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder: string;
}

export interface Integracao {
  id: string;
  nome: string;
  descricao: string;
  icon: React.ElementType;
  status: "conectado" | "disponivel" | "em_breve";
  categoria: "pagamento" | "comunicacao" | "fiscal" | "logistica" | "produtividade";
  configFields?: ConfigField[];
  helpUrl?: string;
  beneficios?: string[];
  isWhatsapp?: boolean;
}

export interface IntegracaoConfig {
  id: string;
  integracao_id: string;
  config_data: Record<string, unknown>;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntegracaoCardProps {
  integracao: Integracao;
  onConfigure: (integracao: Integracao) => void;
  isConfigured: boolean;
  isLoading?: boolean;
}

export interface IntegracaoFormProps {
  integracao: Integracao;
  onSave: (config: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export interface IntegracaoTesterProps {
  integracao: Integracao;
  config: Record<string, unknown>;
  onTest: () => Promise<void>;
  isLoading?: boolean;
}
