import React, { createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEmpresa } from "./EmpresaContext";
import { useUnidade } from "./UnidadeContext";

/**
 * AppContext consolida múltiplos contextos em um único ponto de acesso
 * Reduz prop drilling e simplifica o gerenciamento de estado global
 */

interface AppContextType {
  auth: ReturnType<typeof useAuth>;
  empresa: ReturnType<typeof useEmpresa>;
  unidade: ReturnType<typeof useUnidade>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const empresa = useEmpresa();
  const unidade = useUnidade();

  const value: AppContextType = {
    auth,
    empresa,
    unidade,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * Hook para acessar o contexto consolidado
 * @example
 * const { auth, empresa, unidade } = useAppContext();
 */
export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext deve ser usado dentro de AppProvider");
  }
  return context;
}

/**
 * Hooks individuais para acesso direto a partes específicas
 */
export function useAppAuth() {
  return useAppContext().auth;
}

export function useAppEmpresa() {
  return useAppContext().empresa;
}

export function useAppUnidade() {
  return useAppContext().unidade;
}
