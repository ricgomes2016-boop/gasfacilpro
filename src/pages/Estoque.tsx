import { useState, useEffect, useMemo } from "react";
import { format, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Package, AlertTriangle, ArrowUpDown, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUnidade } from "@/contexts/UnidadeContext";
import { EstoqueDiaTable } from "@/components/estoque/EstoqueDiaTable";

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

      let movQuery = supabase
        .from("movimentacoes_estoque")
        .select("produto_id, tipo, quantidade, created_at, observacoes")
        .gte("created_at", inicioStr)
        .lte("created_at", fimStr)
        .not("observacoes", "like", "%Baixa automática por venda%");

      if (unidadeAtual?.id) {
        movQuery = movQuery.eq("unidade_id", unidadeAtual.id);
      }

      const [
        { data: prodData, error: prodError },
        { data: vendasData, error: vendasError },
        { data: comprasData, error: comprasError },
        { data: movData, error: movError },
      ] = await Promise.all([prodQuery, vendasQuery, comprasQuery, movQuery]);

      if (prodError) throw prodError;
      if (vendasError) console.error("Erro vendas:", vendasError);
      if (comprasError) console.error("Erro compras:", comprasError);
      if (movError) console.error("Erro movimentações:", movError);

      setProdutos(prodData || []);

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
          created_at: m.created_at,
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
      const { error: movError } = await supabase
        .from("movimentacoes_estoque")
        .insert({
          produto_id: movForm.produtoId,
          tipo: movForm.tipo,
          quantidade,
          observacoes: movForm.observacoes || null,
          unidade_id: unidadeAtual?.id || null,
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

  return (
    <MainLayout>
      <Header title="Estoque" subtitle="Controle de estoque do dia" />
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <Card className="border-primary bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-primary/20">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="status-card-icon status-card-icon-warning-solid">
                <Package />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-primary-foreground/75">Estoque operacional</p>
                <h2 className="truncate text-xl font-bold leading-tight sm:text-2xl">Controle diário de produtos</h2>
                <p className="truncate text-sm font-medium text-primary-foreground/80">Período: {periodoLabel}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" size="sm" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setMovDialogOpen(true)}>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Movimentação
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="modern-status-card border-primary bg-primary text-primary-foreground">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
              <div className="status-card-icon status-card-icon-warning-solid">
                <Package />
              </div>
              <div>
                <p className="text-xs font-medium text-primary-foreground/75 sm:text-sm">Cheios</p>
                <p className="text-lg sm:text-2xl font-bold">{getTotalCheios()}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="modern-status-card border-secondary bg-secondary text-secondary-foreground">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
              <div className="status-card-icon bg-secondary-foreground/15 text-secondary-foreground">
                <Package />
              </div>
              <div>
                <p className="text-xs font-medium text-secondary-foreground/75 sm:text-sm">Vazios</p>
                <p className="text-lg sm:text-2xl font-bold">{getTotalVazios()}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="modern-status-card border-info bg-info text-info-foreground">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
              <div className="status-card-icon status-card-icon-info-solid">
                <TrendingUp />
              </div>
              <div>
                <p className="text-xs font-medium text-info-foreground/75 sm:text-sm">Vendas Período</p>
                <p className="text-lg sm:text-2xl font-bold">{totalVendas}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="modern-status-card border-destructive bg-destructive text-destructive-foreground">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
              <div className="status-card-icon status-card-icon-destructive-solid">
                <AlertTriangle />
              </div>
              <div>
                <p className="text-xs font-medium text-destructive-foreground/75 sm:text-sm">Valor Estoque</p>
                <p className="text-lg sm:text-2xl font-bold">R$ {getValorEstoque().toLocaleString("pt-BR")}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Date filters + actions */}
        <Card className="modern-soft-panel">
          <CardContent className="grid gap-3 p-3 sm:grid-cols-[repeat(2,minmax(0,180px))] sm:items-end sm:p-4">
          <div className="grid gap-1.5">
            <Label className="text-sm font-medium">Data Inicial</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal")}>
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
            <Label className="text-sm font-medium">Data Final</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataFim, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={(d) => d && setDataFim(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          </CardContent>
        </Card>

            <Dialog open={movDialogOpen} onOpenChange={setMovDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Movimentação de Estoque</DialogTitle>
                  <DialogDescription>Registre entrada, saída ou avaria de produtos</DialogDescription>
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
