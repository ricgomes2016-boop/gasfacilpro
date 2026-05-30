import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { UNIDADES_PUBLIC_COLUMNS } from "@/lib/db/sensitiveColumns";

export interface Unidade {
  id: string;
  nome: string;
  tipo: "matriz" | "filial";
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  ativo: boolean;
  latitude: number | null;
  longitude: number | null;
  chave_pix: string | null;
  horario_abertura: string | null;
  horario_fechamento: string | null;
  bairros_atendidos: string | null;
}

interface UnidadeContextType {
  unidades: Unidade[];
  unidadeAtual: Unidade | null;
  loading: boolean;
  setUnidadeAtual: (unidade: Unidade) => void;
  refetch: () => Promise<void>;
}

const UnidadeContext = createContext<UnidadeContextType | undefined>(undefined);

export function UnidadeProvider({ children }: { children: ReactNode }) {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadeAtual, setUnidadeAtualState] = useState<Unidade | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, roles, loading: authLoading } = useAuth();
  const { empresa, loading: empresaLoading } = useEmpresa();

  const isAdminOrGestor = roles.includes("admin") || roles.includes("gestor");

  const fetchUnidades = async () => {
    if (!user) {
      setUnidades([]);
      setUnidadeAtualState(null);
      setLoading(false);
      return;
    }

    try {
      if (isAdminOrGestor) {
        // Admin/gestor sees all active unidades of their empresa
        let query = supabase
          .from("unidades")
          .select(UNIDADES_PUBLIC_COLUMNS)
          .eq("ativo", true)
          .order("tipo", { ascending: true })
          .order("nome");

        // Filter by empresa_id if available
        if (empresa?.id) {
          query = query.eq("empresa_id", empresa.id);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching unidades:", error);
          setLoading(false);
          return;
        }

        const typedData = ((data as any[]) || []).map((u) => ({
          ...u,
          tipo: u.tipo as "matriz" | "filial",
          ativo: u.ativo ?? true,
        })) as Unidade[];

        setUnidades(typedData);
        selectDefault(typedData);
      } else {
        // Regular users only see their assigned unidades
        const { data: userUnidades, error: uuError } = await supabase
          .from("user_unidades")
          .select("unidade_id")
          .eq("user_id", user.id);

        if (uuError) {
          console.error("Error fetching user_unidades:", uuError);
          setLoading(false);
          return;
        }

        const unidadeIds = (userUnidades || []).map((uu) => uu.unidade_id);

        if (unidadeIds.length === 0) {
          setUnidades([]);
          setUnidadeAtualState(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("unidades")
          .select("*")
          .in("id", unidadeIds)
          .eq("ativo", true)
          .order("tipo", { ascending: true })
          .order("nome");

        if (error) {
          console.error("Error fetching unidades:", error);
          setLoading(false);
          return;
        }

        const typedData = (data || []).map((u) => ({
          ...u,
          tipo: u.tipo as "matriz" | "filial",
          ativo: u.ativo ?? true,
        }));

        setUnidades(typedData);
        selectDefault(typedData);
      }
    } catch (error) {
      console.error("Error fetching unidades:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectDefault = (typedData: Unidade[]) => {
    const savedUnidadeId = localStorage.getItem("unidade_atual_id");
    const savedUnidade = typedData.find((u) => u.id === savedUnidadeId);

    if (savedUnidade) {
      setUnidadeAtualState(savedUnidade);
    } else {
      const matriz = typedData.find((u) => u.tipo === "matriz");
      if (matriz) {
        setUnidadeAtualState(matriz);
        localStorage.setItem("unidade_atual_id", matriz.id);
      } else if (typedData.length > 0) {
        setUnidadeAtualState(typedData[0]);
        localStorage.setItem("unidade_atual_id", typedData[0].id);
      }
    }
  };

  useEffect(() => {
    if (!authLoading && !empresaLoading) {
      fetchUnidades();
    }
  }, [user, roles, authLoading, empresa, empresaLoading]);

  const setUnidadeAtual = (unidade: Unidade) => {
    setUnidadeAtualState(unidade);
    localStorage.setItem("unidade_atual_id", unidade.id);
  };

  return (
    <UnidadeContext.Provider
      value={{
        unidades,
        unidadeAtual,
        loading,
        setUnidadeAtual,
        refetch: fetchUnidades,
      }}
    >
      {children}
    </UnidadeContext.Provider>
  );
}

export function useUnidade() {
  const context = useContext(UnidadeContext);
  if (!context) {
    throw new Error("useUnidade must be used within UnidadeProvider");
  }
  return context;
}
