import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ContadorEmpresa {
  empresa_id: string;
  empresa_nome: string;
  empresa_slug: string | null;
  empresa_logo_url: string | null;
  permissoes: { xml?: boolean; despesas?: boolean; financeiro?: boolean; documentos?: boolean };
  total_unidades: number;
}

export interface ContadorUnidade {
  id: string;
  nome: string;
  tipo: string;
  empresa_id: string;
}

interface ContadorContextType {
  empresas: ContadorEmpresa[];
  empresaAtiva: ContadorEmpresa | null;
  unidades: ContadorUnidade[];
  unidadeAtiva: ContadorUnidade | null;
  loading: boolean;
  setEmpresaAtiva: (e: ContadorEmpresa | null) => void;
  setUnidadeAtiva: (u: ContadorUnidade | null) => void;
  refetch: () => Promise<void>;
}

const ContadorContext = createContext<ContadorContextType | undefined>(undefined);

const STORAGE_KEY_EMPRESA = "contador.empresa_ativa";
const STORAGE_KEY_UNIDADE = "contador.unidade_ativa";

export function ContadorProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [empresas, setEmpresas] = useState<ContadorEmpresa[]>([]);
  const [empresaAtiva, setEmpresaAtivaState] = useState<ContadorEmpresa | null>(null);
  const [unidades, setUnidades] = useState<ContadorUnidade[]>([]);
  const [unidadeAtiva, setUnidadeAtivaState] = useState<ContadorUnidade | null>(null);
  const [loading, setLoading] = useState(true);

  const setEmpresaAtiva = useCallback((e: ContadorEmpresa | null) => {
    setEmpresaAtivaState(e);
    if (e) localStorage.setItem(STORAGE_KEY_EMPRESA, e.empresa_id);
    else localStorage.removeItem(STORAGE_KEY_EMPRESA);
    // reset unidade quando empresa muda
    setUnidadeAtivaState(null);
    localStorage.removeItem(STORAGE_KEY_UNIDADE);
  }, []);

  const setUnidadeAtiva = useCallback((u: ContadorUnidade | null) => {
    setUnidadeAtivaState(u);
    if (u) localStorage.setItem(STORAGE_KEY_UNIDADE, u.id);
    else localStorage.removeItem(STORAGE_KEY_UNIDADE);
  }, []);

  const fetchEmpresas = useCallback(async () => {
    if (!user) {
      setEmpresas([]);
      setEmpresaAtivaState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_contador_empresas" as any, { _user_id: user.id });
      if (error) {
        console.error("get_contador_empresas error:", error);
        setEmpresas([]);
      } else {
        const list = (data ?? []) as ContadorEmpresa[];
        setEmpresas(list);
        // Restore from storage or pick first
        const savedId = localStorage.getItem(STORAGE_KEY_EMPRESA);
        const found = list.find((e) => e.empresa_id === savedId) ?? list[0] ?? null;
        setEmpresaAtivaState(found);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchUnidades = useCallback(async (empresaId: string) => {
    const { data, error } = await supabase
      .from("unidades")
      .select("id, nome, tipo, empresa_id")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("nome");
    if (error) {
      console.error("fetch unidades error:", error);
      setUnidades([]);
      return;
    }
    const list = (data ?? []) as ContadorUnidade[];
    setUnidades(list);
    const savedId = localStorage.getItem(STORAGE_KEY_UNIDADE);
    const found = list.find((u) => u.id === savedId);
    if (found) setUnidadeAtivaState(found);
  }, []);

  useEffect(() => {
    if (!authLoading) fetchEmpresas();
  }, [authLoading, fetchEmpresas]);

  useEffect(() => {
    if (empresaAtiva) {
      fetchUnidades(empresaAtiva.empresa_id);
    } else {
      setUnidades([]);
      setUnidadeAtivaState(null);
    }
  }, [empresaAtiva, fetchUnidades]);

  return (
    <ContadorContext.Provider
      value={{
        empresas,
        empresaAtiva,
        unidades,
        unidadeAtiva,
        loading,
        setEmpresaAtiva,
        setUnidadeAtiva,
        refetch: fetchEmpresas,
      }}
    >
      {children}
    </ContadorContext.Provider>
  );
}

export function useContador() {
  const ctx = useContext(ContadorContext);
  if (!ctx) throw new Error("useContador must be used within ContadorProvider");
  return ctx;
}
