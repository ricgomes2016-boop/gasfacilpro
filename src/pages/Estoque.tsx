import { useState, useEffect, useMemo } from "react";
import { format, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Filter as FilterIcon, Boxes } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUpDown, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUnidade } from "@/contexts/UnidadeContext";
import { EstoqueDiaTable } from "@/components/estoque/EstoqueDiaTable";
import { FinancialHeroCard } from "@/components/ui/financial-hero-card";


interface ProdutoEstoque {
  id: string;
  nome: string;
  tipo_botijao: string | null;
  estoque: number;
  preco: number;
  categoria: string | null;
  botijao_par_id: string | null;
}

interface MovimentacaoRaw {
  produto_id: string;
  quantidade: number;
  tipo?: string;
  created_at: string;
}

interface MovimentacaoPorProduto {
  vendas: number;
  compras: number;
  entradas_manuais: number;
  saidas_manuais: number;
  avarias: number;
}

export default function Estoque() {
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [vendasRaw, setVendasRaw] = useState<MovimentacaoRaw[]>([]);
  const [comprasRaw, setComprasRaw] = useState<MovimentacaoRaw[]>([]);
  const [movRaw, setMovRaw] = useState<MovimentacaoRaw[]>([]);
  const [saldosIniciais, setSaldosIniciais] = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState<Date>(new Date());
  const [dataFim, setDataFim] = useState<Date>(new Date());
  const [movDialogOpen, setMovDialogOpen] = useState(false);
  const [movForm, setMovForm] = useState({
    produtoId: "",
    tipo: "entrada" as "entrada" | "saida" | "avaria",
    quantidade: "",
    observacoes: "",
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let prodQuery = supabase
        .from("produtos")
        .select("id, nome, tipo_botijao, estoque, preco, categoria, botijao_par_id")
        .eq("ativo", true)
        .order("nome");

      if (unidadeAtual?.id) {
        prodQuery = prodQuery.eq("unidade_id", unidadeAtual.id);
      }

      const inicioStr = startOfDay(dataInicio).toISOString();
      const fimStr = endOfDay(dataFim).toISOString();

      let vendasQuery = supabase
        .from("pedido_itens")
        .select("produto_id, quantidade, pedidos!inner(created_at, status, unidade_id)")
        .gte("pedidos.created_at", inicioStr)
        .lte("pedidos.created_at", fimStr)
        .neq("pedidos.status", "cancelado");

      if (unidadeAtual?.id) {
        vendasQuery = vendasQuery.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`, { referencedTable: "pedidos" });
      }

      let comprasQuery = supabase
        .from("compra_itens")
        .select("produto_id, quantidade, compras!inner(data_compra, created_at, status, unidade_id)")
        .gte("compras.data_compra", format(dataInicio, "yyyy-MM-dd"))
        .lte("compras.data_compra", format(dataFim, "yyyy-MM-dd"))
        .neq("compras.status", "cancelada");

      if (unidadeAtual?.id) {
        comprasQuery = comprasQuery.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`, { referencedTable: "compras" });
      }

      const inicioDia = format(dataInicio, "yyyy-MM-dd");
      const fimDia = format(dataFim, "yyyy-MM-dd");

      let movQuery = (supabase as any)
        .from("movimentacoes_estoque")
        .select("produto_id, tipo, quantidade, created_at, data_movimento, observacoes")
        .gte("data_movimento", inicioDia)
        .lte("data_movimento", fimDia)
        .not("observacoes", "like", "%Baixa automática por venda%")
        .not("observacoes", "like", "%Ajuste de saldo inicial%");

      if (unidadeAtual?.id) {
        movQuery = movQuery.eq("unidade_id", unidadeAtual.id);
      }

      let saldosQuery = (supabase as any)
        .from("estoque_saldos_iniciais")
        .select("produto_id, data_referencia, quantidade")
        .gte("data_referencia", inicioDia)
        .lte("data_referencia", fimDia);

      if (unidadeAtual?.id) {
        saldosQuery = saldosQuery.eq("unidade_id", unidadeAtual.id);
      }

      const [
        { data: prodData, error: prodError },
        { data: vendasData, error: vendasError },
        { data: comprasData, error: comprasError },
        { data: movData, error: movError },
        { data: saldosData, error: saldosError },
      ] = await Promise.all([prodQuery, vendasQuery, comprasQuery, movQuery, saldosQuery]);

      if (prodError) throw prodError;
      if (vendasError) console.error("Erro vendas:", vendasError);
      if (comprasError) console.error("Erro compras:", comprasError);
      if (movError) console.error("Erro movimentações:", movError);
      if (saldosError) console.error("Erro saldos iniciais:", saldosError);

      setProdutos(prodData || []);

      const saldosMap: Record<string, Record<string, number>> = {};
      (saldosData || []).forEach((s: any) => {
        if (!saldosMap[s.data_referencia]) saldosMap[s.data_referencia] = {};
        saldosMap[s.data_referencia][s.produto_id] = Number(s.quantidade) || 0;
      });
      setSaldosIniciais(saldosMap);

      // Normalizar vendas com created_at do pedido
      setVendasRaw(
        (vendasData || []).map((v: any) => ({
          produto_id: v.produto_id,
          quantidade: v.quantidade,
          created_at: v.pedidos?.created_at || "",
        }))
      );

      setComprasRaw(
        (comprasData || []).map((c: any) => ({
          produto_id: c.produto_id,
          quantidade: c.quantidade,
          created_at: c.compras?.data_compra ? `${c.compras.data_compra}T12:00:00` : (c.compras?.created_at || ""),
        }))
      );

      setMovRaw(
        (movData || []).map((m: any) => ({
          produto_id: m.produto_id,
          quantidade: m.quantidade,
          tipo: m.tipo,
          created_at: m.data_movimento ? `${m.data_movimento}T12:00:00` : m.created_at,
        }))
      );
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast({ title: "Erro", description: "Não foi possível carregar o estoque.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [unidadeAtual?.id, dataInicio, dataFim]);

  // Generate days array (newest first)
  const diasOrdenados = useMemo(() => {
    const start = dataInicio <= dataFim ? dataInicio : dataFim;
    const end = dataInicio <= dataFim ? dataFim : dataInicio;
    const days = eachDayOfInterval({ start, end });
    return days.reverse(); // newest first
  }, [dataInicio, dataFim]);

  // Build movimentacoes per day
  const movPorDia = useMemo(() => {
    const result: Record<string, Record<string, MovimentacaoPorProduto>> = {};

    const getDateKey = (dateStr: string) => {
      if (!dateStr) return null;
      return format(new Date(dateStr), "yyyy-MM-dd");
    };

    diasOrdenados.forEach((dia) => {
      const key = format(dia, "yyyy-MM-dd");
      result[key] = {};
    });

    const getOrCreate = (dayKey: string, prodId: string) => {
      if (!result[dayKey]) return null;
      if (!result[dayKey][prodId]) {
        result[dayKey][prodId] = { vendas: 0, compras: 0, entradas_manuais: 0, saidas_manuais: 0, avarias: 0 };
      }
      return result[dayKey][prodId];
    };

    vendasRaw.forEach((v) => {
      const dk = getDateKey(v.created_at);
      if (dk && v.produto_id) {
        const entry = getOrCreate(dk, v.produto_id);
        if (entry) entry.vendas += v.quantidade;
      }
    });

    comprasRaw.forEach((c) => {
      const dk = getDateKey(c.created_at);
      if (dk && c.produto_id) {
        const entry = getOrCreate(dk, c.produto_id);
        if (entry) entry.compras += c.quantidade;
      }
    });

    movRaw.forEach((m) => {
      const dk = getDateKey(m.created_at);
      if (dk && m.produto_id) {
        const entry = getOrCreate(dk, m.produto_id);
        if (entry) {
          if (m.tipo === "entrada") entry.entradas_manuais += m.quantidade;
          else if (m.tipo === "saida") entry.saidas_manuais += m.quantidade;
          else if (m.tipo === "avaria") entry.avarias += m.quantidade;
        }
      }
    });

    return result;
  }, [diasOrdenados, vendasRaw, comprasRaw, movRaw]);

  // Totals for summary cards (aggregate all days)
  const movimentacoesTotal = useMemo(() => {
    const map: Record<string, MovimentacaoPorProduto> = {};
    Object.values(movPorDia).forEach((dayMap) => {
      Object.entries(dayMap).forEach(([prodId, mov]) => {
        if (!map[prodId]) map[prodId] = { vendas: 0, compras: 0, entradas_manuais: 0, saidas_manuais: 0, avarias: 0 };
        map[prodId].vendas += mov.vendas;
        map[prodId].compras += mov.compras;
        map[prodId].entradas_manuais += mov.entradas_manuais;
        map[prodId].saidas_manuais += mov.saidas_manuais;
        map[prodId].avarias += mov.avarias;
      });
    });
    return map;
  }, [movPorDia]);

  const handleMovimentacao = async () => {
    const quantidade = parseInt(movForm.quantidade);
    if (!movForm.produtoId || isNaN(quantidade) || quantidade <= 0) {
      toast({ title: "Erro", description: "Preencha todos os campos corretamente.", variant: "destructive" });
      return;
    }

    const produto = produtos.find((p) => p.id === movForm.produtoId);
    if (!produto) return;

    try {
      const { error: movError } = await (supabase as any)
        .from("movimentacoes_estoque")
        .insert({
          produto_id: movForm.produtoId,
          tipo: movForm.tipo,
          quantidade,
          observacoes: movForm.observacoes || null,
          unidade_id: unidadeAtual?.id || null,
          data_movimento: format(dataFim, "yyyy-MM-dd"),
        });

      if (movError) throw movError;

      let novaQuantidade = produto.estoque;
      if (movForm.tipo === "entrada") {
        novaQuantidade += quantidade;
      } else {
        novaQuantidade = Math.max(0, novaQuantidade - quantidade);
      }

      const { error: updateError } = await supabase
        .from("produtos")
        .update({ estoque: novaQuantidade })
        .eq("id", movForm.produtoId);

      if (updateError) throw updateError;

      if (produto.botijao_par_id && movForm.tipo !== "avaria") {
        const par = produtos.find((p) => p.id === produto.botijao_par_id);
        if (par) {
          let novaQtdPar = par.estoque;
          if (movForm.tipo === "entrada") {
            novaQtdPar = Math.max(0, novaQtdPar - quantidade);
          } else {
            novaQtdPar += quantidade;
          }
          await supabase.from("produtos").update({ estoque: novaQtdPar }).eq("id", par.id);
        }
      }

      toast({
        title: "Movimentação registrada!",
        description: `${movForm.tipo === "entrada" ? "Entrada" : movForm.tipo === "saida" ? "Saída" : "Avaria"} de ${quantidade} un.`,
      });

      setMovForm({ produtoId: "", tipo: "entrada", quantidade: "", observacoes: "" });
      setMovDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Erro ao registrar movimentação:", error);
      toast({ title: "Erro", description: "Não foi possível registrar a movimentação.", variant: "destructive" });
    }
  };

  const produtosGas = produtos.filter((p) => p.categoria === "gas");
  const getTotalCheios = () => produtosGas.filter((p) => p.tipo_botijao === "cheio").reduce((acc, p) => acc + (p.estoque || 0), 0);
  const getTotalVazios = () => produtosGas.filter((p) => p.tipo_botijao === "vazio").reduce((acc, p) => acc + (p.estoque || 0), 0);
  const getValorEstoque = () => produtos.filter((p) => p.tipo_botijao !== "vazio").reduce((acc, p) => acc + (p.estoque || 0) * (p.preco || 0), 0);
  const totalVendas = Object.values(movimentacoesTotal).reduce((acc, m) => acc + m.vendas, 0);
  const periodoLabel = dataInicio.toDateString() === dataFim.toDateString()
    ? format(dataInicio, "dd/MM/yyyy")
    : `${format(dataInicio, "dd/MM/yyyy")} até ${format(dataFim, "dd/MM/yyyy")}`;

  const totalCheios = getTotalCheios();
  const totalVazios = getTotalVazios();
  const valorEstoque = getValorEstoque();
  const produtosZerados = produtos.filter(
    (p) => (p.estoque || 0) <= 0 && p.tipo_botijao !== "vazio"
  ).length;

  const simplificarNome = (nome: string) =>
    nome
      .replace(/\s*\(Vazio\)\s*/i, "")
      .replace(/\s*\(Cheio\)\s*/i, "")
      .replace(/^Gás\s+/i, "")
      .replace(/^Vasilhame\s+/i, "vasilhame ")
      .replace(/^Água Mineral\s+/i, "água ")
      .replace(/\s+Vazio$/i, "")
      .replace(/\s+Cheio$/i, "")
      .trim()
      .toLowerCase();

  const detalheCheios = produtos
    .filter((p) =>
      (p.tipo_botijao === "cheio" || (p.categoria === "gas" && !p.tipo_botijao) || p.categoria === "agua") &&
      (p.estoque || 0) > 0
    )
    .sort((a, b) => (b.estoque || 0) - (a.estoque || 0))
    .map((p) => ({ nome: simplificarNome(p.nome), qtd: p.estoque || 0 }));

  const detalheVendas = produtos
    .filter((p) => (movimentacoesTotal[p.id]?.vendas || 0) > 0)
    .sort((a, b) => (movimentacoesTotal[b.id]?.vendas || 0) - (movimentacoesTotal[a.id]?.vendas || 0))
    .map((p) => ({ nome: simplificarNome(p.nome), qtd: movimentacoesTotal[p.id]?.vendas || 0 }));

  const detalheVazios = produtos
    .filter((p) => p.tipo_botijao === "vazio" && (p.estoque || 0) > 0)
    .sort((a, b) => (b.estoque || 0) - (a.estoque || 0))
    .map((p) => ({
      nome: simplificarNome(p.nome).startsWith("vasilhame") ? simplificarNome(p.nome) : `vasilhame ${simplificarNome(p.nome)}`,
      qtd: p.estoque || 0,
    }));

  const formatarLista = (itens: { nome: string; qtd: number }[]) =>
    itens.length === 0 ? (
      <span className="text-white/70">—</span>
    ) : (
      <div className="flex flex-col gap-1">
        {itens.map((item, idx) => (
          <div key={idx} className="flex items-baseline justify-between gap-2">
            <span className="truncate text-white/90">{item.qtd} {item.nome}</span>
          </div>
        ))}
      </div>
    );


  const DateFields = (
    <>
      <div className="grid gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Data inicial</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full sm:w-[170px] h-10 justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(dataInicio, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dataInicio} onSelect={(d) => d && setDataInicio(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Data final</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full sm:w-[170px] h-10 justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(dataFim, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dataFim} onSelect={(d) => d && setDataFim(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
    </>
  );

  return (
    <MainLayout>
      <Header title="Estoque" subtitle="Controle de estoque do dia" />
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-5 max-w-[1400px] mx-auto w-full min-w-0">
        {/* Action bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground sm:text-xl truncate">Controle diário de produtos</h2>
            <p className="text-sm text-muted-foreground truncate">
              {periodoLabel}{unidadeAtual?.nome ? ` · ${unidadeAtual.nome}` : ""}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-10" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" className="h-10" onClick={() => setMovDialogOpen(true)}>
              <ArrowUpDown className="mr-2 h-4 w-4" />
              Movimentação
            </Button>
          </div>
        </div>

        {/* Hero card */}
        <FinancialHeroCard
          title="Estoque do período"
          color="success"
          icon={Boxes}
          value={`R$ ${valorEstoque.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Valor total estimado em produtos disponíveis"
          details={[
            { label: `Cheios · ${totalCheios.toLocaleString("pt-BR")} un`, value: formatarLista(detalheCheios) },
            { label: `Vendas · ${totalVendas.toLocaleString("pt-BR")} un`, value: formatarLista(detalheVendas) },
            { label: `Vazio · ${totalVazios.toLocaleString("pt-BR")} un`, value: formatarLista(detalheVazios) },
            { label: "Período", value: periodoLabel },
          ]}
        />


        {/* Filter bar */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
          {/* Desktop */}
          <div className="hidden md:flex items-end gap-3 flex-wrap">
            {DateFields}
          </div>
          {/* Mobile */}
          <div className="flex md:hidden items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Período</p>
              <p className="text-sm font-semibold text-foreground truncate">{periodoLabel}</p>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 shrink-0">
                  <FilterIcon className="h-4 w-4 mr-2" />
                  Filtros
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                  <SheetDescription>Selecione o período</SheetDescription>
                </SheetHeader>
                <div className="grid gap-3 py-4">
                  {DateFields}
                </div>
                <SheetFooter>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { const hoje = new Date(); setDataInicio(hoje); setDataFim(hoje); }}
                  >
                    Limpar (hoje)
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>



            <Dialog open={movDialogOpen} onOpenChange={setMovDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Movimentação de Estoque</DialogTitle>
                  <DialogDescription>
                    Registre entrada, saída ou avaria de produtos · Lançando em {format(dataFim, "dd/MM/yyyy")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Produto</Label>
                    <Select value={movForm.produtoId} onValueChange={(v) => setMovForm({ ...movForm, produtoId: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                      <SelectContent>
                        {produtos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome} (Est: {p.estoque})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select value={movForm.tipo} onValueChange={(v: "entrada" | "saida" | "avaria") => setMovForm({ ...movForm, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">➕ Entrada</SelectItem>
                        <SelectItem value="saida">➖ Saída</SelectItem>
                        <SelectItem value="avaria">⚠️ Avaria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="quantidade">Quantidade</Label>
                    <Input id="quantidade" type="number" min="1" value={movForm.quantidade} onChange={(e) => setMovForm({ ...movForm, quantidade: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea id="observacoes" value={movForm.observacoes} onChange={(e) => setMovForm({ ...movForm, observacoes: e.target.value })} placeholder="Motivo da movimentação..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setMovDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleMovimentacao}>Confirmar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

        {/* Daily stock tables - one per day, newest first */}
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Carregando estoque...
            </CardContent>
          </Card>
        ) : (
          diasOrdenados.map((dia) => {
            const dayKey = format(dia, "yyyy-MM-dd");
            const dayMov = movPorDia[dayKey] || {};
            return (
              <EstoqueDiaTable
                key={dayKey}
                produtos={produtos}
                movimentacoes={dayMov}
                dataDia={dia}
                saldosIniciais={saldosIniciais[dayKey] || {}}
                periodo={{ inicio: dataInicio, fim: dataFim }}
                isLoading={false}
                onRefresh={fetchData}
              />
            );
          })
        )}
      </div>
    </MainLayout>
  );
}
