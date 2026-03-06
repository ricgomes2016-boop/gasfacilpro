import { createContext, useContext, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Tipos
export type TipoParceiro = "prepago" | "consignado";
export type StatusVale = "disponivel" | "vendido" | "utilizado" | "cancelado";

export interface Parceiro {
  id: string;
  nome: string;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  tipo: TipoParceiro;
  ativo: boolean;
  user_id: string | null;
  created_at: string;
}

export interface ValeGas {
  id: string;
  numero: number;
  codigo: string;
  valor: number;
  parceiro_id: string;
  lote_id: string;
  status: StatusVale;
  descricao: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  produto_id: string | null;
  produto_nome: string | null;
  consumidor_nome: string | null;
  consumidor_endereco: string | null;
  consumidor_telefone: string | null;
  data_utilizacao: string | null;
  entregador_id: string | null;
  entregador_nome: string | null;
  venda_id: string | null;
  created_at: string;
}

export interface LoteVales {
  id: string;
  parceiro_id: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  numero_inicial: number;
  numero_final: number;
  descricao: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  produto_id: string | null;
  produto_nome: string | null;
  data_vencimento_pagamento: string | null;
  status_pagamento: string;
  valor_pago: number;
  gerar_conta_receber: boolean | null;
  observacao: string | null;
  cancelado: boolean;
  created_at: string;
}

export interface AcertoConta {
  id: string;
  parceiro_id: string;
  parceiro_nome: string;
  data_acerto: string;
  quantidade: number;
  valor_total: number;
  status_pagamento: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  observacao: string | null;
}

interface ValeGasContextType {
  parceiros: Parceiro[];
  vales: ValeGas[];
  lotes: LoteVales[];
  acertos: AcertoConta[];
  isLoading: boolean;
  addParceiro: (parceiro: { nome: string; cnpj: string; telefone: string; email: string; endereco: string; tipo: TipoParceiro; ativo: boolean }) => Promise<void>;
  updateParceiro: (id: string, data: Partial<Parceiro>) => Promise<void>;
  emitirLote: (data: { parceiroId: string; quantidade: number; valorUnitario: number; numeroInicial?: number; dataVencimento?: Date; observacao?: string; descricao?: string; clienteId?: string; clienteNome?: string; produtoId?: string; produtoNome?: string; gerarContaReceber?: boolean }) => Promise<LoteVales>;
  cancelarLote: (loteId: string) => Promise<void>;
  registrarPagamentoLote: (loteId: string, valor: number) => Promise<void>;
  registrarVendaConsumidor: (valeId: string, consumidor: { nome: string; endereco: string; telefone: string }) => Promise<void>;
  utilizarVale: (valeId: string, entregadorId: string, entregadorNome: string, vendaId: string) => Promise<{ sucesso: boolean; mensagem: string; vale?: ValeGas }>;
  getValeByNumero: (numero: number) => ValeGas | undefined;
  getValeByCodigo: (codigo: string) => ValeGas | undefined;
  gerarAcerto: (parceiroId: string) => Promise<AcertoConta | null>;
  registrarPagamentoAcerto: (acertoId: string, formaPagamento: string) => Promise<void>;
  getEstatisticasParceiro: (parceiroId: string) => { totalVales: number; valesDisponiveis: number; valesVendidos: number; valesUtilizados: number; valorPendente: number };
  proximoNumeroVale: number;
  refetch: () => void;
}

const ValeGasContext = createContext<ValeGasContextType | undefined>(undefined);

const gerarCodigoVale = (numero: number) => {
  const ano = new Date().getFullYear();
  return `VG-${ano}-${numero.toString().padStart(5, "0")}`;
};

export function ValeGasProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Fetch parceiros
  const { data: parceiros = [], isLoading: loadingParceiros } = useQuery({
    queryKey: ["vale-gas-parceiros"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("vale_gas_parceiros").select("*").order("nome");
      if (error) throw error;
      return (data || []) as Parceiro[];
    },
  });

  // Fetch vales
  const { data: vales = [], isLoading: loadingVales } = useQuery({
    queryKey: ["vale-gas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("vale_gas").select("*").order("numero", { ascending: true });
      if (error) throw error;
      return (data || []) as ValeGas[];
    },
  });

  // Fetch lotes
  const { data: lotes = [], isLoading: loadingLotes } = useQuery({
    queryKey: ["vale-gas-lotes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("vale_gas_lotes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LoteVales[];
    },
  });

  // Fetch acertos
  const { data: acertos = [] } = useQuery({
    queryKey: ["vale-gas-acertos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("vale_gas_acertos").select("*").order("data_acerto", { ascending: false });
      if (error) throw error;
      return (data || []) as AcertoConta[];
    },
  });

  const isLoading = loadingParceiros || loadingVales || loadingLotes;

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["vale-gas-parceiros"] });
    queryClient.invalidateQueries({ queryKey: ["vale-gas"] });
    queryClient.invalidateQueries({ queryKey: ["vale-gas-lotes"] });
    queryClient.invalidateQueries({ queryKey: ["vale-gas-acertos"] });
  }, [queryClient]);

  // Próximo número
  const proximoNumeroVale = vales.length > 0 ? Math.max(...vales.map(v => v.numero)) + 1 : 1;

  // Parceiro CRUD
  const addParceiro = async (parceiro: { nome: string; cnpj: string; telefone: string; email: string; endereco: string; tipo: TipoParceiro; ativo: boolean }) => {
    const { error } = await (supabase as any).from("vale_gas_parceiros").insert(parceiro);
    if (error) throw error;
    refetch();
  };

  const updateParceiro = async (id: string, data: Partial<Parceiro>) => {
    const { error } = await (supabase as any).from("vale_gas_parceiros").update(data).eq("id", id);
    if (error) throw error;
    refetch();
  };

  // Emitir lote
  const emitirLote = async (data: { parceiroId: string; quantidade: number; valorUnitario: number; numeroInicial?: number; dataVencimento?: Date; observacao?: string; descricao?: string; clienteId?: string; clienteNome?: string; produtoId?: string; produtoNome?: string; gerarContaReceber?: boolean }): Promise<LoteVales> => {
    // Fetch the real max number from the DB to avoid race conditions
    let numeroInicial = data.numeroInicial;
    if (!numeroInicial) {
      const { data: maxRow } = await (supabase as any)
        .from("vale_gas")
        .select("numero")
        .order("numero", { ascending: false })
        .limit(1);
      const maxNumero = maxRow?.[0]?.numero || 0;
      numeroInicial = maxNumero + 1;
    }
    const numeroFinal = numeroInicial + data.quantidade - 1;
    const valorTotal = data.quantidade * data.valorUnitario;

    // Insert lote
    const { data: loteData, error: loteError } = await (supabase as any).from("vale_gas_lotes").insert({
      parceiro_id: data.parceiroId,
      quantidade: data.quantidade,
      valor_unitario: data.valorUnitario,
      valor_total: valorTotal,
      numero_inicial: numeroInicial,
      numero_final: numeroFinal,
      descricao: data.descricao || "VALE GÁS",
      cliente_id: data.clienteId || null,
      cliente_nome: data.clienteNome || null,
      produto_id: data.produtoId || null,
      produto_nome: data.produtoNome || null,
      data_vencimento_pagamento: data.dataVencimento ? data.dataVencimento.toISOString().split("T")[0] : null,
      observacao: data.observacao || null,
      gerar_conta_receber: data.gerarContaReceber || false,
    }).select().single();

    if (loteError) throw loteError;

    // Create individual vales
    const novosVales = [];
    for (let i = numeroInicial; i <= numeroFinal; i++) {
      novosVales.push({
        numero: i,
        codigo: gerarCodigoVale(i),
        valor: data.valorUnitario,
        parceiro_id: data.parceiroId,
        lote_id: loteData.id,
        status: "disponivel",
        descricao: data.descricao || "VALE GÁS",
        cliente_id: data.clienteId || null,
        cliente_nome: data.clienteNome || null,
        produto_id: data.produtoId || null,
        produto_nome: data.produtoNome || null,
      });
    }

    // Insert in batches of 100
    for (let i = 0; i < novosVales.length; i += 100) {
      const batch = novosVales.slice(i, i + 100);
      const { error } = await (supabase as any).from("vale_gas").insert(batch);
      if (error) throw error;
    }

    refetch();
    return loteData as LoteVales;
  };

  const cancelarLote = async (loteId: string) => {
    await (supabase as any).from("vale_gas_lotes").update({ cancelado: true }).eq("id", loteId);
    await (supabase as any).from("vale_gas").update({ status: "cancelado" }).eq("lote_id", loteId).eq("status", "disponivel");
    refetch();
  };

  const registrarPagamentoLote = async (loteId: string, valor: number) => {
    const lote = lotes.find(l => l.id === loteId);
    if (!lote) return;
    const novoValorPago = lote.valor_pago + valor;
    const novoStatus = novoValorPago >= lote.valor_total ? "pago" : novoValorPago > 0 ? "parcial" : "pendente";
    await (supabase as any).from("vale_gas_lotes").update({ valor_pago: novoValorPago, status_pagamento: novoStatus }).eq("id", loteId);
    refetch();
  };

  const registrarVendaConsumidor = async (valeId: string, consumidor: { nome: string; endereco: string; telefone: string }) => {
    await (supabase as any).from("vale_gas").update({
      status: "vendido",
      consumidor_nome: consumidor.nome,
      consumidor_endereco: consumidor.endereco,
      consumidor_telefone: consumidor.telefone,
    }).eq("id", valeId);
    refetch();
  };

  const utilizarVale = async (valeId: string, entregadorId: string, entregadorNome: string, vendaId: string) => {
    const vale = vales.find(v => v.id === valeId);
    if (!vale) return { sucesso: false, mensagem: "Vale não encontrado" };
    if (vale.status === "utilizado") return { sucesso: false, mensagem: "Vale já foi utilizado" };
    if (vale.status === "cancelado") return { sucesso: false, mensagem: "Vale cancelado" };

    const { error } = await (supabase as any).from("vale_gas").update({
      status: "utilizado",
      data_utilizacao: new Date().toISOString(),
      entregador_id: entregadorId,
      entregador_nome: entregadorNome,
      venda_id: vendaId,
    }).eq("id", valeId);

    if (error) return { sucesso: false, mensagem: error.message };

    const parceiro = parceiros.find(p => p.id === vale.parceiro_id);
    refetch();
    return { sucesso: true, mensagem: `Vale ${vale.numero} (${parceiro?.nome}) utilizado com sucesso!`, vale: { ...vale, status: "utilizado" as StatusVale } };
  };

  const getValeByNumero = (numero: number) => vales.find(v => v.numero === numero);
  const getValeByCodigo = (codigo: string) => vales.find(v => v.codigo === codigo);

  const gerarAcerto = async (parceiroId: string): Promise<AcertoConta | null> => {
    const parceiro = parceiros.find(p => p.id === parceiroId);
    if (!parceiro || parceiro.tipo !== "consignado") return null;

    // Get acerted vale IDs
    const { data: acertoValesData } = await (supabase as any).from("vale_gas_acerto_vales").select("vale_id");
    const valesJaAcertados = new Set((acertoValesData || []).map((av: any) => av.vale_id));

    const valesParaAcertar = vales.filter(v =>
      v.parceiro_id === parceiroId && v.status === "utilizado" && !valesJaAcertados.has(v.id)
    );

    if (valesParaAcertar.length === 0) return null;

    const valorTotal = valesParaAcertar.reduce((s, v) => s + Number(v.valor), 0);

    const { data: acertoData, error } = await (supabase as any).from("vale_gas_acertos").insert({
      parceiro_id: parceiroId,
      parceiro_nome: parceiro.nome,
      quantidade: valesParaAcertar.length,
      valor_total: valorTotal,
    }).select().single();

    if (error) throw error;

    // Link vales to acerto
    const links = valesParaAcertar.map(v => ({ acerto_id: acertoData.id, vale_id: v.id }));
    await (supabase as any).from("vale_gas_acerto_vales").insert(links);

    refetch();
    return acertoData as AcertoConta;
  };

  const registrarPagamentoAcerto = async (acertoId: string, formaPagamento: string) => {
    await (supabase as any).from("vale_gas_acertos").update({
      status_pagamento: "pago",
      data_pagamento: new Date().toISOString(),
      forma_pagamento: formaPagamento,
    }).eq("id", acertoId);
    refetch();
  };

  const getEstatisticasParceiro = (parceiroId: string) => {
    const valesParceiro = vales.filter(v => v.parceiro_id === parceiroId);
    const valesDisponiveis = valesParceiro.filter(v => v.status === "disponivel").length;
    const valesVendidos = valesParceiro.filter(v => v.status === "vendido").length;
    const valesUtilizados = valesParceiro.filter(v => v.status === "utilizado").length;

    const parceiro = parceiros.find(p => p.id === parceiroId);
    let valorPendente = 0;
    if (parceiro?.tipo === "prepago") {
      const lotesParceiro = lotes.filter(l => l.parceiro_id === parceiroId && !l.cancelado);
      valorPendente = lotesParceiro.reduce((s, l) => s + (Number(l.valor_total) - Number(l.valor_pago)), 0);
    } else {
      // For consignado, pending = utilized but not settled
      valorPendente = valesParceiro.filter(v => v.status === "utilizado").reduce((s, v) => s + Number(v.valor), 0);
    }

    return { totalVales: valesParceiro.length, valesDisponiveis, valesVendidos, valesUtilizados, valorPendente };
  };

  return (
    <ValeGasContext.Provider value={{
      parceiros, vales, lotes, acertos, isLoading,
      addParceiro, updateParceiro,
      emitirLote, cancelarLote, registrarPagamentoLote,
      registrarVendaConsumidor, utilizarVale,
      getValeByNumero, getValeByCodigo,
      gerarAcerto, registrarPagamentoAcerto,
      getEstatisticasParceiro, proximoNumeroVale, refetch,
    }}>
      {children}
    </ValeGasContext.Provider>
  );
}

export function useValeGas() {
  const context = useContext(ValeGasContext);
  if (!context) throw new Error("useValeGas must be used within ValeGasProvider");
  return context;
}
