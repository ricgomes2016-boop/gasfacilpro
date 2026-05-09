import type React from "react";

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

export type StatusKey = Integracao["status"];
export type CategoriaKey = Integracao["categoria"];
