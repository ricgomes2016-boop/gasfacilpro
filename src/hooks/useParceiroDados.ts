import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ParceiroInfo {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  tipo: string;
  unidade_id: string | null;
}

export interface EmpresaValeInfo {
  nome: string;
  telefone: string | null;
  endereco: string | null;
}

export interface ValeGasParceiro {
  id: string;
  numero: number;
  codigo: string;
  valor: number;
  status: string;
  descricao: string | null;
  consumidor_nome: string | null;
  consumidor_cpf: string | null;
  consumidor_telefone: string | null;
  produto_nome: string | null;
  numero_empenho: string | null;
  data_utilizacao: string | null;
  created_at: string;
}

export function useParceiroDados() {
  const { user } = useAuth();

  const { data: parceiro, isLoading: loadingParceiro } = useQuery({
    queryKey: ["parceiro-info", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vale_gas_parceiros")
        .select("id, nome, cnpj, telefone, tipo, unidade_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as ParceiroInfo;
    },
    enabled: !!user,
  });

  const { data: empresaVale } = useQuery({
    queryKey: ["parceiro-empresa-vale", parceiro?.unidade_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("nome, telefone, endereco, bairro, cidade, estado")
        .eq("id", parceiro!.unidade_id!)
        .single();
      if (error) throw error;
      return {
        nome: data.nome,
        telefone: data.telefone,
        endereco: [data.endereco, data.bairro, data.cidade, data.estado].filter(Boolean).join(" - ") || null,
      } as EmpresaValeInfo;
    },
    enabled: !!parceiro?.unidade_id,
  });

  const { data: vales = [], isLoading: loadingVales, refetch: refetchVales } = useQuery({
    queryKey: ["parceiro-vales", parceiro?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vale_gas")
        .select("id, numero, codigo, valor, status, descricao, consumidor_nome, consumidor_cpf, consumidor_telefone, produto_nome, numero_empenho, data_utilizacao, created_at")
        .eq("parceiro_id", parceiro!.id)
        .order("numero", { ascending: true });
      if (error) throw error;
      return (data || []) as ValeGasParceiro[];
    },
    enabled: !!parceiro?.id,
  });

  const disponiveis = vales.filter((v) => v.status === "disponivel");
  const vendidos = vales.filter((v) => v.status === "vendido");
  const utilizados = vales.filter((v) => v.status === "utilizado");

  return {
    parceiro,
    empresaVale,
    vales,
    disponiveis,
    vendidos,
    utilizados,
    isLoading: loadingParceiro || loadingVales,
    refetchVales,
  };
}
