import { useState, useMemo } from "react";
import { parseLocalDate } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Search, FileText, Trash2, Eye, Copy, ChevronsUpDown, Check,
  DollarSign, Clock, CheckCircle2, TrendingUp, ReceiptText, Printer, ChevronDown, Pencil
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { imprimirFundepar, type CarimboTamanho } from "@/services/orcamentoFundeparPdfService";
import { imprimirOrcamentoPadrao } from "@/services/orcamentoPadraoPdfService";
import { Switch } from "@/components/ui/switch";
import { useAssinaturaDigital } from "@/hooks/useAssinaturaDigital";
import { ShieldCheck, ShieldAlert } from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", color: "bg-warning/15 text-warning border-warning/30 dark:text-warning", icon: <Clock className="h-3 w-3" /> },
  aprovado: { label: "Aprovado", color: "bg-success/15 text-success border-success/30 dark:text-success", icon: <CheckCircle2 className="h-3 w-3" /> },
  recusado: { label: "Recusado", color: "bg-destructive/15 text-destructive border-destructive/30 dark:text-destructive", icon: <Trash2 className="h-3 w-3" /> },
  convertido: { label: "Convertido", color: "bg-info/15 text-info border-info/30 dark:text-info", icon: <TrendingUp className="h-3 w-3" /> },
  vencido: { label: "Vencido", color: "bg-muted text-muted-foreground border-border", icon: <Clock className="h-3 w-3" /> },
};

interface OrcamentoItem {
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produto_id?: string;
}

export default function Orcamentos() {
  const { user } = useAuth();
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [tabTipo, setTabTipo] = useState<"todos" | "padrao" | "fundepar">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fundeparOpen, setFundeparOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedOrcamento, setSelectedOrcamento] = useState<any>(null);

  // Form state padrão
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteOpen, setClienteOpen] = useState(false);
  const [clienteSearch, setClienteSearch] = useState("");
  const [validade, setValidade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [desconto, setDesconto] = useState(0);
  const [itens, setItens] = useState<OrcamentoItem[]>([
    { descricao: "", quantidade: 1, preco_unitario: 0, subtotal: 0 },
  ]);
  const [produtoOpenIdx, setProdutoOpenIdx] = useState<number | null>(null);

  // Form state Fundepar
  const [fMunicipio, setFMunicipio] = useState("");
  const [fNre, setFNre] = useState("");
  const [fEstabelecimento, setFEstabelecimento] = useState("");
  const [fCnpjEscola, setFCnpjEscola] = useState("");
  const [fFormaPag, setFFormaPag] = useState("À VISTA");
  const [fValidadeIni, setFValidadeIni] = useState("");
  const [fValidadeFim, setFValidadeFim] = useState("");
  const [fObs, setFObs] = useState("");
  const [fItens, setFItens] = useState<OrcamentoItem[]>([
    { descricao: "", quantidade: 1, preco_unitario: 0, subtotal: 0 },
  ]);
  const [fProdutoOpenIdx, setFProdutoOpenIdx] = useState<number | null>(null);
  const [editingFundeparId, setEditingFundeparId] = useState<string | null>(null);
  const [carimboTamanho, setCarimboTamanhoState] = useState<CarimboTamanho>(() => {
    const v = (typeof window !== "undefined" && localStorage.getItem("fundepar_carimbo_tamanho")) as CarimboTamanho | null;
    return v === "compacto" || v === "pequeno" || v === "padrao" ? v : "padrao";
  });
  const setCarimboTamanho = (v: CarimboTamanho) => {
    setCarimboTamanhoState(v);
    try { localStorage.setItem("fundepar_carimbo_tamanho", v); } catch {}
  };
  const [estabOpen, setEstabOpen] = useState(false);
  const [estabSearch, setEstabSearch] = useState("");
  const assinatura = useAssinaturaDigital();

  // Busca de estabelecimento no cadastro de clientes (nome ou CNPJ)
  const { data: estabResultados = [] } = useQuery({
    queryKey: ["estab-clientes", empresa?.id, unidadeAtual?.id, estabSearch],
    enabled: !!empresa?.id && estabSearch.trim().length >= 2,
    queryFn: async () => {
      const termo = estabSearch.trim();
      const digits = termo.replace(/\D/g, "");
      let q = supabase
        .from("clientes")
        .select("id, nome, cnpj, cidade")
        .eq("empresa_id", empresa!.id)
        .eq("ativo", true)
        .limit(20);
      if (digits.length >= 3) {
        q = q.or(`nome.ilike.%${termo}%,cnpj.ilike.%${digits}%`);
      } else {
        q = q.ilike("nome", `%${termo}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Clientes — RPC server-side com debounce
  // Estratégia: busca primeiro na unidade ativa. Se vier vazio e o termo tiver
  // tamanho mínimo, faz fallback para a empresa inteira e marca como "outra unidade".
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-orcamento", empresa?.id, unidadeAtual?.id, clienteSearch],
    enabled: !!empresa?.id,
    queryFn: async () => {
      const termo = (clienteSearch || "").trim();
      const { data, error } = await supabase.rpc("autocomplete_clientes_v2", {
        _empresa_id: empresa!.id,
        _unidade_id: unidadeAtual?.id ?? null,
        _termo: termo || null,
        _limite: 30,
      });
      if (error) throw error;
      const local = (data || []).map((c: any) => ({ ...c, __outraUnidade: false }));
      if (local.length > 0 || termo.length < 2 || !unidadeAtual?.id) return local;

      // Fallback: busca em toda a empresa
      const { data: dataAll } = await supabase.rpc("autocomplete_clientes_v2", {
        _empresa_id: empresa!.id,
        _unidade_id: null,
        _termo: termo,
        _limite: 30,
      });
      return (dataAll || []).map((c: any) => ({ ...c, __outraUnidade: true }));
    },
  });

  // Produtos filtrados por unidade
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-orcamento", unidadeAtual?.id],
    enabled: !!unidadeAtual?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, preco, ativo")
        .eq("ativo", true)
        .eq("unidade_id", unidadeAtual!.id)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ["orcamentos", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("orcamentos").select("*").order("created_at", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: viewItens = [] } = useQuery({
    queryKey: ["orcamento-itens", selectedOrcamento?.id],
    queryFn: async () => {
      if (!selectedOrcamento) return [];
      const { data, error } = await supabase
        .from("orcamento_itens")
        .select("*")
        .eq("orcamento_id", selectedOrcamento.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrcamento,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!unidadeAtual?.id) throw new Error("Selecione uma unidade");
      const valorTotal = itens.reduce((sum, i) => sum + i.subtotal, 0) - desconto;
      const { data: orc, error } = await supabase
        .from("orcamentos")
        .insert({
          tipo: "padrao",
          cliente_id: clienteId || undefined,
          cliente_nome: clienteNome,
          validade: validade || undefined,
          observacoes,
          desconto,
          valor_total: valorTotal,
          created_by: user?.id,
          unidade_id: unidadeAtual.id,
        })
        .select()
        .single();
      if (error) throw error;

      const itensToInsert = itens
        .filter((i) => i.descricao.trim())
        .map((i) => ({
          orcamento_id: orc.id,
          descricao: i.descricao,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          subtotal: i.quantidade * i.preco_unitario,
          produto_id: i.produto_id || undefined,
        }));

      if (itensToInsert.length > 0) {
        const { error: itensError } = await supabase
          .from("orcamento_itens")
          .insert(itensToInsert);
        if (itensError) throw itensError;
      }
      return orc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success("Orçamento criado com sucesso!");
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createFundeparMutation = useMutation({
    mutationFn: async () => {
      if (!unidadeAtual?.id) throw new Error("Selecione uma unidade");
      const valorTotal = fItens.reduce((s, i) => s + i.subtotal, 0);
      let orc: any;

      if (editingFundeparId) {
        const { data, error } = await supabase
          .from("orcamentos")
          .update({
            cliente_nome: fEstabelecimento || "FUNDEPAR",
            municipio: fMunicipio || null,
            nre: fNre || null,
            estabelecimento: fEstabelecimento || null,
            cnpj_escola: fCnpjEscola || null,
            forma_pagamento: fFormaPag || "À VISTA",
            validade_inicio: fValidadeIni || null,
            validade: fValidadeFim || null,
            observacoes: fObs,
            valor_total: valorTotal,
          } as any)
          .eq("id", editingFundeparId)
          .select()
          .single();
        if (error) throw error;
        orc = data;
        await supabase.from("orcamento_itens").delete().eq("orcamento_id", editingFundeparId);
      } else {
        const { data, error } = await supabase
          .from("orcamentos")
          .insert({
            tipo: "fundepar",
            cliente_nome: fEstabelecimento || "FUNDEPAR",
            municipio: fMunicipio || undefined,
            nre: fNre || undefined,
            estabelecimento: fEstabelecimento || undefined,
            cnpj_escola: fCnpjEscola || undefined,
            forma_pagamento: fFormaPag || "À VISTA",
            validade_inicio: fValidadeIni || undefined,
            validade: fValidadeFim || undefined,
            observacoes: fObs,
            desconto: 0,
            valor_total: valorTotal,
            created_by: user?.id,
            unidade_id: unidadeAtual.id,
          } as any)
          .select()
          .single();
        if (error) throw error;
        orc = data;
      }

      const itensToInsert = fItens
        .filter((i) => i.descricao.trim())
        .map((i) => ({
          orcamento_id: orc.id,
          descricao: i.descricao,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          subtotal: i.quantidade * i.preco_unitario,
          produto_id: i.produto_id || undefined,
        }));
      if (itensToInsert.length > 0) {
        const { error: ie } = await supabase.from("orcamento_itens").insert(itensToInsert);
        if (ie) throw ie;
      }

      await imprimirFundepar({
        numero: orc.numero,
        municipio: fMunicipio,
        nre: fNre,
        estabelecimento: fEstabelecimento,
        cnpj_escola: fCnpjEscola,
        forma_pagamento: fFormaPag,
        validade_inicio: fValidadeIni,
        validade: fValidadeFim,
        itens: fItens,
        observacoes: fObs,
        empresa_id: empresa?.id,
        unidade_id: unidadeAtual.id,
        carimbo_tamanho: carimboTamanho,
        assinar: assinatura.ativo,
      });
      return orc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success(editingFundeparId ? "Orçamento Fundepar atualizado!" : "Orçamento Fundepar criado!");
      resetFundepar();
      setFundeparOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orcamentos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success("Status atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orcamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success("Orçamento excluído!");
    },
  });

  const resetForm = () => {
    setClienteId(null);
    setClienteNome("");
    setClienteSearch("");
    setValidade("");
    setObservacoes("");
    setDesconto(0);
    setItens([{ descricao: "", quantidade: 1, preco_unitario: 0, subtotal: 0 }]);
  };

  const resetFundepar = () => {
    setFMunicipio("");
    setFNre("");
    setFEstabelecimento("");
    setFCnpjEscola("");
    setFFormaPag("À VISTA");
    setFValidadeIni("");
    setFValidadeFim("");
    setFObs("");
    setFItens([{ descricao: "", quantidade: 1, preco_unitario: 0, subtotal: 0 }]);
    setEditingFundeparId(null);
  };

  const editFundepar = async (orc: any) => {
    setEditingFundeparId(orc.id);
    setFMunicipio(orc.municipio || "");
    setFNre(orc.nre || "");
    setFEstabelecimento(orc.estabelecimento || orc.cliente_nome || "");
    setFCnpjEscola(orc.cnpj_escola || "");
    setFFormaPag(orc.forma_pagamento || "À VISTA");
    setFValidadeIni(orc.validade_inicio || "");
    setFValidadeFim(orc.validade || "");
    setFObs(orc.observacoes || "");
    const { data: its } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", orc.id);
    const loaded = (its || []).map((i: any) => ({
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      preco_unitario: Number(i.preco_unitario),
      subtotal: Number(i.subtotal),
      produto_id: i.produto_id || undefined,
    }));
    setFItens(loaded.length ? loaded : [{ descricao: "", quantidade: 1, preco_unitario: 0, subtotal: 0 }]);
    setFundeparOpen(true);
  };

  const selectCliente = async (c: any) => {
    setClienteId(c.id);
    setClienteNome(c.nome || `${c.endereco || ""} ${c.numero || ""}`.trim() || c.telefone || "Sem nome");
    setClienteOpen(false);
    // Se veio do fallback (outra unidade), vincula à unidade ativa para próximas buscas
    if (c.__outraUnidade && unidadeAtual?.id) {
      try {
        await supabase
          .from("cliente_unidades")
          .insert({ cliente_id: c.id, unidade_id: unidadeAtual.id });
      } catch {
        /* ignora duplicidade */
      }
    }
  };

  const selectProduto = (
    list: OrcamentoItem[],
    setList: (v: OrcamentoItem[]) => void,
    index: number,
    produto: any,
    closeFn: () => void,
  ) => {
    const updated = [...list];
    const preco = Number(produto.preco ?? produto.preco_venda) || 0;
    updated[index] = {
      ...updated[index],
      descricao: produto.nome,
      preco_unitario: preco,
      produto_id: produto.id,
      subtotal: updated[index].quantidade * preco,
    };
    setList(updated);
    closeFn();
  };

  const updateItem = (
    list: OrcamentoItem[],
    setList: (v: OrcamentoItem[]) => void,
    index: number,
    field: keyof OrcamentoItem,
    value: any,
  ) => {
    const updated = [...list];
    (updated[index] as any)[field] = value;
    updated[index].subtotal = updated[index].quantidade * updated[index].preco_unitario;
    setList(updated);
  };

  const totalItens = itens.reduce((s, i) => s + i.subtotal, 0);
  const totalFinal = totalItens - desconto;
  const fTotal = fItens.reduce((s, i) => s + i.subtotal, 0);

  const filtered = useMemo(
    () =>
      orcamentos.filter((o: any) => {
        const matchSearch =
          o.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
          String(o.numero).includes(search);
        const matchStatus = filterStatus === "todos" || o.status === filterStatus;
        const matchTipo = tabTipo === "todos" || (o.tipo || "padrao") === tabTipo;
        return matchSearch && matchStatus && matchTipo;
      }),
    [orcamentos, search, filterStatus, tabTipo],
  );

  const duplicar = (orc: any) => {
    setClienteId(orc.cliente_id);
    setClienteNome(orc.cliente_nome);
    setObservacoes(orc.observacoes || "");
    setDesconto(orc.desconto || 0);
    setDialogOpen(true);
  };

  const reimprimirFundepar = async (orc: any) => {
    const { data: its } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", orc.id);
    await imprimirFundepar({
      numero: orc.numero,
      municipio: orc.municipio,
      nre: orc.nre,
      estabelecimento: orc.estabelecimento,
      cnpj_escola: orc.cnpj_escola,
      forma_pagamento: orc.forma_pagamento,
      validade_inicio: orc.validade_inicio,
      validade: orc.validade,
      itens: (its || []).map((i: any) => ({
        descricao: i.descricao,
        quantidade: Number(i.quantidade),
        preco_unitario: Number(i.preco_unitario),
        subtotal: Number(i.subtotal),
      })),
      observacoes: orc.observacoes,
      empresa_id: empresa?.id,
      unidade_id: orc.unidade_id || unidadeAtual?.id,
      carimbo_tamanho: carimboTamanho,
      assinar: assinatura.ativo,
    });
  };

  const imprimirPadrao = async (orc: any, assinar = false) => {
    const { data: its } = await supabase
      .from("orcamento_itens")
      .select("*")
      .eq("orcamento_id", orc.id);
    let cli: any = null;
    if (orc.cliente_id) {
      const { data } = await supabase
        .from("clientes")
        .select("nome, cnpj, telefone, endereco, numero, bairro, cidade")
        .eq("id", orc.cliente_id)
        .maybeSingle();
      cli = data;
    }
    const enderecoCli = cli
      ? [cli.endereco, cli.numero, cli.bairro].filter(Boolean).join(", ")
      : "";
    await imprimirOrcamentoPadrao({
      numero: orc.numero,
      data_emissao: orc.data_emissao || orc.created_at,
      validade: orc.validade,
      cliente_nome: orc.cliente_nome || cli?.nome,
      cliente_telefone: cli?.telefone,
      cliente_endereco: enderecoCli,
      cliente_cidade: cli?.cidade,
      cliente_cnpj: cli?.cnpj,
      itens: (its || []).map((i: any) => ({
        descricao: i.descricao,
        quantidade: Number(i.quantidade),
        preco_unitario: Number(i.preco_unitario),
        subtotal: Number(i.subtotal),
      })),
      desconto: Number(orc.desconto || 0),
      valor_total: Number(orc.valor_total || 0),
      observacoes: orc.observacoes,
      empresa_id: empresa?.id,
      unidade_id: orc.unidade_id || unidadeAtual?.id,
      assinar,
    });
  };

  const pendentes = orcamentos.filter((o: any) => o.status === "pendente");
  const aprovados = orcamentos.filter((o: any) => o.status === "aprovado");
  const valorPendente = pendentes.reduce((s: number, o: any) => s + Number(o.valor_total || 0), 0);
  const valorAprovado = aprovados.reduce((s: number, o: any) => s + Number(o.valor_total || 0), 0);

  return (
    <MainLayout>
      <Header title="Orçamentos" subtitle="Gestão de propostas comerciais" />
      <div className="space-y-6 pb-8 p-3 md:p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><ReceiptText className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{orcamentos.length}</p><p className="text-xs text-muted-foreground">Total Orçamentos</p></div>
          </div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2"><Clock className="h-5 w-5 text-warning" /></div>
            <div><p className="text-2xl font-bold">{pendentes.length}</p><p className="text-xs text-muted-foreground">Pendentes</p></div>
          </div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3">
            <div className="rounded-lg bg-info/10 p-2"><DollarSign className="h-5 w-5 text-info" /></div>
            <div><p className="text-2xl font-bold">R$ {valorPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground">Valor Pendente</p></div>
          </div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2"><CheckCircle2 className="h-5 w-5 text-success" /></div>
            <div><p className="text-2xl font-bold">R$ {valorAprovado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p className="text-xs text-muted-foreground">Valor Aprovado</p></div>
          </div></CardContent></Card>
        </div>

        {/* Tabs por tipo */}
        <Tabs value={tabTipo} onValueChange={(v) => setTabTipo(v as any)}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="padrao">Padrão</TabsTrigger>
            <TabsTrigger value="fundepar">Fundepar</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente ou nº..." className="pl-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(statusConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Novo Orçamento<ChevronDown className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                <ReceiptText className="h-4 w-4 mr-2" />Orçamento Padrão
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFundeparOpen(true)}>
                <FileText className="h-4 w-4 mr-2" />Orçamento Fundepar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dialog Padrão */}
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="rounded-lg gradient-primary p-1.5"><ReceiptText className="h-4 w-4 text-white" /></div>
                  Novo Orçamento
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                {!unidadeAtual && (
                  <div className="rounded-md bg-warning/10 border border-warning/30 text-warning dark:text-warning px-3 py-2 text-sm">
                    Selecione uma unidade no topo da página para criar orçamentos.
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente *</Label>
                    <Popover open={clienteOpen} onOpenChange={setClienteOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal mt-1.5">
                          <span className="truncate">{clienteNome || "Selecionar cliente..."}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[350px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput placeholder="Buscar cliente..." value={clienteSearch} onValueChange={setClienteSearch} />
                          <CommandList>
                            <CommandEmpty>{clienteSearch ? "Nenhum cliente encontrado." : "Digite para buscar..."}</CommandEmpty>
                            <CommandGroup className="max-h-60 overflow-auto">
                              {clientes.map((c: any) => {
                                const label = c.nome || `${c.endereco || ""} ${c.numero || ""}`.trim() || c.telefone || "Sem nome";
                                return (
                                  <CommandItem key={c.id} value={c.id} onSelect={() => selectCliente(c)}>
                                    <Check className={cn("mr-2 h-4 w-4", clienteId === c.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{label}</span>
                                        {c.__outraUnidade && (
                                          <span className="text-[10px] uppercase tracking-wide bg-warning/15 text-warning dark:text-warning px-1.5 py-0.5 rounded">
                                            outra unidade
                                          </span>
                                        )}
                                      </div>
                                      {c.telefone && <span className="text-xs text-muted-foreground">{c.telefone}</span>}
                                      {c.endereco && <span className="text-xs text-muted-foreground">{c.endereco}{c.numero ? `, ${c.numero}` : ""} {c.bairro ? `- ${c.bairro}` : ""}</span>}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Validade</Label>
                    <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className="mt-1.5" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-3 block">Itens do Orçamento</Label>
                  <div className="space-y-2">
                    {itens.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-muted/30 rounded-lg p-2">
                        <div className="col-span-5">
                          <Popover open={produtoOpenIdx === idx} onOpenChange={(o) => setProdutoOpenIdx(o ? idx : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-left h-9 text-sm">
                                <span className="truncate">{item.descricao || "Selecionar produto..."}</span>
                                <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Buscar produto..." />
                                <CommandList>
                                  <CommandEmpty>Nenhum produto.</CommandEmpty>
                                  <CommandGroup className="max-h-48 overflow-auto">
                                    {produtos.map((p: any) => (
                                      <CommandItem key={p.id} value={p.nome} onSelect={() => selectProduto(itens, setItens, idx, p, () => setProdutoOpenIdx(null))}>
                                        <Check className={cn("mr-2 h-4 w-4", item.produto_id === p.id ? "opacity-100" : "opacity-0")} />
                                        <div className="flex justify-between w-full">
                                          <span>{p.nome}</span>
                                          <span className="text-muted-foreground text-xs">R$ {Number(p.preco ?? p.preco_venda ?? 0).toFixed(2)}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="col-span-2">
                          <Input type="number" min={1} value={item.quantidade} onChange={(e) => updateItem(itens, setItens, idx, "quantidade", Number(e.target.value))} className="h-9" />
                        </div>
                        <div className="col-span-2">
                          <Input type="number" min={0} step={0.01} value={item.preco_unitario} onChange={(e) => updateItem(itens, setItens, idx, "preco_unitario", Number(e.target.value))} className="h-9" />
                        </div>
                        <div className="col-span-2 text-right text-sm font-semibold pt-2">R$ {item.subtotal.toFixed(2)}</div>
                        <div className="col-span-1 flex justify-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => itens.length > 1 && setItens(itens.filter((_, i) => i !== idx))} disabled={itens.length === 1}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setItens([...itens, { descricao: "", quantidade: 1, preco_unitario: 0, subtotal: 0 }])} className="gap-1 text-xs">
                      <Plus className="h-3 w-3" />Adicionar Item
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Desconto (R$)</Label>
                      <Input type="number" min={0} step={0.01} value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} className="mt-1 bg-white dark:bg-background" />
                    </div>
                    <div className="flex flex-col justify-end">
                      <p className="text-xs text-muted-foreground">Total Final</p>
                      <p className="text-2xl font-bold text-primary">R$ {totalFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Observações</Label>
                  <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="mt-1.5" rows={2} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => createMutation.mutate()} disabled={!clienteNome.trim() || !unidadeAtual || createMutation.isPending}>
                    {createMutation.isPending ? "Salvando..." : (<><CheckCircle2 className="h-4 w-4" />Salvar</>)}
                  </Button>
                  <Button
                    className="gradient-primary text-primary-foreground shadow-lg gap-2"
                    disabled={!clienteNome.trim() || !unidadeAtual || createMutation.isPending}
                    onClick={async () => {
                      try {
                        const orc: any = await createMutation.mutateAsync();
                        if (orc) await imprimirPadrao(orc, assinatura.ativo);
                      } catch {}
                    }}
                  >
                    <Printer className="h-4 w-4" />Salvar e Imprimir
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog Fundepar */}
          <Dialog open={fundeparOpen} onOpenChange={(o) => { setFundeparOpen(o); if (!o) resetFundepar(); }}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="rounded-lg bg-info p-1.5"><FileText className="h-4 w-4 text-white" /></div>
                  {editingFundeparId ? "Editar Orçamento Fundepar" : "Orçamento Fundepar — Pesquisa de Preço"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {!unidadeAtual && (
                  <div className="rounded-md bg-warning/10 border border-warning/30 text-warning dark:text-warning px-3 py-2 text-sm">
                    Selecione uma unidade no topo da página.
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Município</Label>
                    <Input value={fMunicipio} onChange={(e) => setFMunicipio(e.target.value)} placeholder="Ex.: CORNÉLIO PROCÓPIO" />
                  </div>
                  <div>
                    <Label>NRE</Label>
                    <Input value={fNre} onChange={(e) => setFNre(e.target.value)} placeholder="Núcleo Regional" />
                  </div>
                  <div className="sm:col-span-1">
                    <Label>Forma de Pagamento</Label>
                    <Input value={fFormaPag} onChange={(e) => setFFormaPag(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Estabelecimento</Label>
                    <Popover open={estabOpen} onOpenChange={setEstabOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal mt-1.5 h-10">
                          <span className="truncate">{fEstabelecimento || "Buscar no cadastro de clientes..."}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[380px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput placeholder="Buscar por nome ou CNPJ..." value={estabSearch} onValueChange={setEstabSearch} />
                          <CommandList>
                            <CommandEmpty>{estabSearch ? "Nenhum cliente encontrado." : "Digite para buscar..."}</CommandEmpty>
                            <CommandGroup className="max-h-60 overflow-auto">
                              {estabResultados.map((c: any) => (
                                <CommandItem key={c.id} value={c.id} onSelect={() => {
                                  setFEstabelecimento(c.nome || "");
                                  if (c.cnpj) setFCnpjEscola(c.cnpj);
                                  if (c.cidade && !fMunicipio) setFMunicipio(c.cidade);
                                  setEstabOpen(false);
                                }}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{c.nome}</span>
                                    {c.cnpj && <span className="text-xs text-muted-foreground">CNPJ: {c.cnpj}</span>}
                                    {c.cidade && <span className="text-xs text-muted-foreground">{c.cidade}</span>}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Input value={fEstabelecimento} onChange={(e) => setFEstabelecimento(e.target.value)} placeholder="Ou digite manualmente" className="mt-2" />
                  </div>
                  <div>
                    <Label>CNPJ da Escola</Label>
                    <Input value={fCnpjEscola} onChange={(e) => setFCnpjEscola(e.target.value)} placeholder="00.000.000/0000-00" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Validade — De</Label>
                    <Input type="date" value={fValidadeIni} onChange={(e) => setFValidadeIni(e.target.value)} />
                  </div>
                  <div>
                    <Label>Validade — Até</Label>
                    <Input type="date" value={fValidadeFim} onChange={(e) => setFValidadeFim(e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Itens</Label>
                  <div className="space-y-2">
                    {fItens.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-muted/30 rounded-lg p-2">
                        <div className="col-span-5">
                          <Popover open={fProdutoOpenIdx === idx} onOpenChange={(o) => setFProdutoOpenIdx(o ? idx : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-left h-9 text-sm">
                                <span className="truncate">{item.descricao || "Selecionar produto..."}</span>
                                <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Buscar produto..." />
                                <CommandList>
                                  <CommandEmpty>Nenhum produto.</CommandEmpty>
                                  <CommandGroup className="max-h-48 overflow-auto">
                                    {produtos.map((p: any) => (
                                      <CommandItem key={p.id} value={p.nome} onSelect={() => selectProduto(fItens, setFItens, idx, p, () => setFProdutoOpenIdx(null))}>
                                        <Check className={cn("mr-2 h-4 w-4", item.produto_id === p.id ? "opacity-100" : "opacity-0")} />
                                        <div className="flex justify-between w-full">
                                          <span>{p.nome}</span>
                                          <span className="text-muted-foreground text-xs">R$ {Number(p.preco ?? p.preco_venda ?? 0).toFixed(2)}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="col-span-2">
                          <Input type="number" min={1} value={item.quantidade} onChange={(e) => updateItem(fItens, setFItens, idx, "quantidade", Number(e.target.value))} className="h-9" />
                        </div>
                        <div className="col-span-2">
                          <Input type="number" min={0} step={0.01} value={item.preco_unitario} onChange={(e) => updateItem(fItens, setFItens, idx, "preco_unitario", Number(e.target.value))} className="h-9" />
                        </div>
                        <div className="col-span-2 text-right text-sm font-semibold pt-2">R$ {item.subtotal.toFixed(2)}</div>
                        <div className="col-span-1 flex justify-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fItens.length > 1 && setFItens(fItens.filter((_, i) => i !== idx))} disabled={fItens.length === 1}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setFItens([...fItens, { descricao: "", quantidade: 1, preco_unitario: 0, subtotal: 0 }])} className="gap-1 text-xs">
                      <Plus className="h-3 w-3" />Adicionar Item
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-info/30 bg-info/5 p-4 flex justify-between items-center">
                  <span className="font-medium">Valor Total</span>
                  <span className="text-2xl font-bold text-info">R$ {fTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} />
                </div>

                <div className="relative rounded-md border bg-muted/30 p-2 space-y-2 overflow-hidden">
                  {/* Marca d'água de fundo */}
                  <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center">
                    <span
                      className={cn(
                        "text-3xl sm:text-4xl font-black tracking-[0.25em] uppercase whitespace-nowrap -rotate-12",
                        assinatura.disponivel && assinatura.ativo
                          ? "text-success/[0.08] dark:text-success/[0.10]"
                          : "text-muted-foreground/[0.08]"
                      )}
                    >
                      {assinatura.disponivel && assinatura.ativo
                        ? "● ASSINADO DIGITALMENTE ●"
                        : "● SEM ASSINATURA ●"}
                    </span>
                  </div>

                  <div className="relative z-10 flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Tamanho do carimbo:</Label>
                    <Select value={carimboTamanho} onValueChange={(v) => setCarimboTamanho(v as CarimboTamanho)}>
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="padrao">Padrão</SelectItem>
                        <SelectItem value="compacto">Compacto</SelectItem>
                        <SelectItem value="pequeno">Pequeno</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-[11px] text-muted-foreground ml-auto">Salvo automaticamente</span>
                  </div>
                  <div className="relative z-10 flex items-center gap-2 border-t pt-2">
                    {assinatura.disponivel ? (
                      <ShieldCheck className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-warning shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <Label className="text-xs">Assinar digitalmente (e-CNPJ)</Label>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {assinatura.carregando
                          ? "Verificando certificado..."
                          : assinatura.disponivel
                            ? `${assinatura.titular || "Certificado A1 cadastrado"}${assinatura.validade ? ` · até ${new Date(assinatura.validade).toLocaleDateString("pt-BR")}` : ""}`
                            : assinatura.vencido
                              ? "Certificado vencido — atualize em Configurações › Unidades"
                              : "Sem certificado A1 cadastrado nesta unidade"}
                      </p>
                    </div>
                    <Switch
                      checked={assinatura.ativo}
                      onCheckedChange={assinatura.setAtivo}
                      disabled={!assinatura.disponivel}
                    />
                  </div>
                  <div className="relative z-10 flex justify-end -mt-1">
                    <a
                      href="/config/assinatura-digital"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-primary hover:underline"
                    >
                      Testar certificado →
                    </a>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() =>
                      imprimirFundepar({
                        municipio: fMunicipio, nre: fNre, estabelecimento: fEstabelecimento, cnpj_escola: fCnpjEscola,
                        forma_pagamento: fFormaPag, validade_inicio: fValidadeIni, validade: fValidadeFim,
                        itens: fItens, observacoes: fObs,
                        empresa_id: empresa?.id, unidade_id: unidadeAtual?.id,
                        carimbo_tamanho: carimboTamanho,
                        assinar: assinatura.ativo,
                      })
                    }
                  >
                    <Printer className="h-4 w-4" />Pré-visualizar
                  </Button>
                  <Button
                    className="flex-1 gap-2 bg-info hover:bg-info text-white"
                    onClick={() => createFundeparMutation.mutate()}
                    disabled={!unidadeAtual || createFundeparMutation.isPending}
                  >
                    {createFundeparMutation.isPending ? "Salvando..." : (<><CheckCircle2 className="h-4 w-4" />{editingFundeparId ? "Atualizar e Imprimir" : "Salvar e Imprimir"}</>)}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabela */}
        <Card className="overflow-hidden border-0 shadow-md">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold">Nº</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Cliente / Estabelecimento</TableHead>
                    <TableHead className="font-semibold">Data</TableHead>
                    <TableHead className="font-semibold">Validade</TableHead>
                    <TableHead className="font-semibold">Valor</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-12"><div className="flex flex-col items-center gap-2 text-muted-foreground"><div className="h-8 w-8 animate-spin rounded-full border-2 border-warning border-t-transparent" /><span className="text-sm">Carregando orçamentos...</span></div></TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-12"><div className="flex flex-col items-center gap-3 text-muted-foreground"><div className="rounded-full bg-muted p-4"><ReceiptText className="h-8 w-8" /></div><div><p className="font-medium">Nenhum orçamento encontrado</p><p className="text-xs">Crie seu primeiro orçamento clicando no botão acima</p></div></div></TableCell></TableRow>
                  ) : (
                    filtered.map((orc: any) => {
                      const st = statusConfig[orc.status] || statusConfig.pendente;
                      const isFundepar = (orc.tipo || "padrao") === "fundepar";
                      return (
                        <TableRow key={orc.id} className="group hover:bg-warning/50 dark:hover:bg-warning/10 transition-colors">
                          <TableCell className="font-mono text-sm font-semibold text-warning dark:text-warning">#{orc.numero}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(isFundepar ? "bg-info/15 text-info border-info/30 dark:text-info" : "bg-muted text-muted-foreground")}>
                              {isFundepar ? "Fundepar" : "Padrão"}
                            </Badge>
                          </TableCell>
                          <TableCell><span className="font-medium">{orc.cliente_nome}</span></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{format(parseLocalDate(orc.data_emissao), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{orc.validade ? format(parseLocalDate(orc.validade), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell><span className="font-semibold">R$ {Number(orc.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></TableCell>
                          <TableCell>
                            <Select value={orc.status} onValueChange={(v) => updateStatusMutation.mutate({ id: orc.id, status: v })}>
                              <SelectTrigger className="w-36 h-7 border-0 bg-transparent p-0">
                                <Badge variant="outline" className={cn("gap-1 text-xs", st.color)}>{st.icon}{st.label}</Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusConfig).map(([k, v]) => (
                                  <SelectItem key={k} value={k}><span className="flex items-center gap-1.5">{v.icon} {v.label}</span></SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                              {isFundepar && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar Fundepar" onClick={() => editFundepar(orc)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Imprimir Fundepar" onClick={() => reimprimirFundepar(orc)}>
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedOrcamento(orc); setViewDialogOpen(true); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!isFundepar && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Imprimir" onClick={() => imprimirPadrao(orc, false)}>
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Imprimir com Assinatura Digital" onClick={() => imprimirPadrao(orc, true)}>
                                    <ShieldCheck className="h-4 w-4 text-success" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicar(orc)}>
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm("Excluir orçamento?")) deleteMutation.mutate(orc.id); }}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="rounded-lg gradient-primary p-1.5"><FileText className="h-4 w-4 text-white" /></div>
                Orçamento #{selectedOrcamento?.numero}
              </DialogTitle>
            </DialogHeader>
            {selectedOrcamento && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</span><p className="font-medium mt-0.5">{selectedOrcamento.cliente_nome}</p></div>
                  <div><span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span><div className="mt-0.5"><Badge variant="outline" className={cn("gap-1", statusConfig[selectedOrcamento.status]?.color)}>{statusConfig[selectedOrcamento.status]?.icon}{statusConfig[selectedOrcamento.status]?.label}</Badge></div></div>
                  <div><span className="text-xs uppercase tracking-wide text-muted-foreground">Emissão</span><p className="mt-0.5">{format(parseLocalDate(selectedOrcamento.data_emissao), "dd/MM/yyyy")}</p></div>
                  <div><span className="text-xs uppercase tracking-wide text-muted-foreground">Validade</span><p className="mt-0.5">{selectedOrcamento.validade ? format(parseLocalDate(selectedOrcamento.validade), "dd/MM/yyyy") : "—"}</p></div>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader><TableRow className="bg-muted/40"><TableHead>Item</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Unit.</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {viewItens.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.descricao}</TableCell>
                          <TableCell className="text-right">{item.quantidade}</TableCell>
                          <TableCell className="text-right">R$ {Number(item.preco_unitario).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">R$ {Number(item.subtotal).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 space-y-1">
                  {Number(selectedOrcamento.desconto) > 0 && (
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Desconto:</span><span className="text-destructive font-medium">- R$ {Number(selectedOrcamento.desconto).toFixed(2)}</span></div>
                  )}
                  <div className="flex justify-between items-center"><span className="font-medium">Total:</span><span className="text-xl font-bold text-primary">R$ {Number(selectedOrcamento.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                </div>
                {selectedOrcamento.observacoes && (
                  <div className="text-sm rounded-lg bg-muted/50 p-3"><span className="text-xs uppercase tracking-wide text-muted-foreground">Observações</span><p className="mt-1">{selectedOrcamento.observacoes}</p></div>
                )}
                {(selectedOrcamento.tipo || "padrao") === "fundepar" ? (
                  <Button variant="outline" className="w-full gap-2" onClick={() => reimprimirFundepar(selectedOrcamento)}>
                    <Printer className="h-4 w-4" />Imprimir Fundepar
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => imprimirPadrao(selectedOrcamento, false)}>
                      <Printer className="h-4 w-4" />Imprimir
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => imprimirPadrao(selectedOrcamento, true)}>
                      <ShieldCheck className="h-4 w-4 text-success" />Imprimir Assinado
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
