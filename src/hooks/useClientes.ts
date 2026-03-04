import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

export interface ClienteDB {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  tipo: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean | null;
  created_at: string;
  updated_at: string;
  total_pedidos?: number;
  ultimo_pedido?: string | null;
}

export type ClienteForm = {
  nome: string;
  telefone: string;
  email: string;
  cpf: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  cep: string;
  tipo: string;
  latitude: number | null;
  longitude: number | null;
};

const emptyForm: ClienteForm = {
  nome: "",
  telefone: "",
  email: "",
  cpf: "",
  endereco: "",
  numero: "",
  bairro: "",
  cidade: "",
  cep: "",
  tipo: "residencial",
  latitude: null,
  longitude: null,
};

const PAGE_SIZE = 15;

export function useClientes() {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroBairro, setFiltroBairro] = useState("todos");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchClientes = useCallback(async () => {
    if (!unidadeAtual) {
      setClientes([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // First get cliente_ids for this unidade
      const { data: cuData, error: cuError } = await supabase
        .from("cliente_unidades")
        .select("cliente_id")
        .eq("unidade_id", unidadeAtual.id);

      if (cuError) throw cuError;

      const clienteIds = (cuData || []).map((cu: any) => cu.cliente_id);

      if (clienteIds.length === 0) {
        setClientes([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      // Get clientes filtered by those IDs
      let query = supabase
        .from("clientes")
        .select("*", { count: "exact" })
        .eq("ativo", true)
        .in("id", clienteIds)
        .order("nome", { ascending: true });

      if (busca) {
        const buscaTexto = busca.trim();
        const buscaDigits = buscaTexto.replace(/\D/g, "");
        const phoneCandidates = Array.from(new Set([
          buscaDigits,
          buscaDigits.slice(-11),
          buscaDigits.slice(-10),
          buscaDigits.slice(-9),
        ].filter((v) => v.length >= 8)));

        const textFilters = [
          `nome.ilike.%${buscaTexto}%`,
          `telefone.ilike.%${buscaTexto}%`,
          `bairro.ilike.%${buscaTexto}%`,
          `endereco.ilike.%${buscaTexto}%`,
          `cpf.ilike.%${buscaTexto}%`,
        ];

        const digitFilters = phoneCandidates.flatMap((candidate) => [
          `telefone.ilike.%${candidate}%`,
          `cpf.ilike.%${candidate}%`,
        ]);

        query = query.or([...textFilters, ...digitFilters].join(","));
      }

      if (filtroBairro && filtroBairro !== "todos") {
        query = query.eq("bairro", filtroBairro);
      }

      const from = (page - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      // Get pedidos count per client
      if (data && data.length > 0) {
        const ids = data.map((c) => c.id);
        const { data: pedidosData } = await supabase
          .from("pedidos")
          .select("cliente_id, created_at")
          .in("cliente_id", ids)
          .order("created_at", { ascending: false });

        const pedidoMap = new Map<string, { count: number; ultimo: string | null }>();
        pedidosData?.forEach((p) => {
          if (!pedidoMap.has(p.cliente_id!)) {
            pedidoMap.set(p.cliente_id!, { count: 0, ultimo: null });
          }
          const entry = pedidoMap.get(p.cliente_id!)!;
          entry.count++;
          if (!entry.ultimo) entry.ultimo = p.created_at;
        });

        const enriched = data.map((c) => ({
          ...c,
          total_pedidos: pedidoMap.get(c.id)?.count || 0,
          ultimo_pedido: pedidoMap.get(c.id)?.ultimo || null,
        }));
        setClientes(enriched);
      } else {
        setClientes([]);
      }

      setTotalCount(count || 0);
    } catch (err) {
      console.error("Erro ao buscar clientes:", err);
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  }, [busca, filtroBairro, page, unidadeAtual?.id]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [busca, filtroBairro, unidadeAtual?.id]);

  const bairros = [...new Set(clientes.map((c) => c.bairro).filter(Boolean))] as string[];

  const salvarCliente = async (form: ClienteForm, editId?: string) => {
    if (!unidadeAtual) {
      toast.error("Selecione uma unidade primeiro");
      return false;
    }

    if (!editId && !empresa?.id) {
      toast.error("Empresa não identificada. Faça login novamente.");
      return false;
    }

    try {
      const payload: any = {
        nome: form.nome,
        telefone: form.telefone || null,
        email: form.email || null,
        cpf: form.cpf || null,
        endereco: form.endereco || null,
        numero: form.numero || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        cep: form.cep || null,
        tipo: form.tipo || "residencial",
        latitude: form.latitude,
        longitude: form.longitude,
      };

      if (!editId) {
        payload.empresa_id = empresa!.id;
      }

      if (editId) {
        const { error } = await supabase.from("clientes").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("Cliente atualizado!");
      } else {
        const { data: newCliente, error } = await supabase
          .from("clientes")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;

        // Associate the new client with the current unidade
        const { error: cuError } = await supabase
          .from("cliente_unidades")
          .insert({ cliente_id: newCliente.id, unidade_id: unidadeAtual.id });
        if (cuError) console.error("Erro ao associar cliente à unidade:", cuError);

        toast.success("Cliente cadastrado!");
      }

      fetchClientes();
      return true;
    } catch (err: any) {
      console.error("Erro ao salvar cliente:", err);
      toast.error(err.message || "Erro ao salvar cliente");
      return false;
    }
  };

  const excluirCliente = async (id: string) => {
    try {
      const { error } = await supabase.from("clientes").update({ ativo: false }).eq("id", id);
      if (error) throw error;
      toast.success("Cliente excluído");
      fetchClientes();
    } catch (err: any) {
      console.error("Erro ao excluir cliente:", err);
      toast.error(err.message || "Erro ao excluir cliente");
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return {
    clientes,
    loading,
    busca,
    setBusca,
    filtroBairro,
    setFiltroBairro,
    bairros,
    page,
    setPage,
    totalPages,
    totalCount,
    salvarCliente,
    excluirCliente,
    emptyForm,
    fetchClientes,
  };
}
