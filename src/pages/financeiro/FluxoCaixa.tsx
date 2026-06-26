import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Plus, Wallet, TrendingUp, TrendingDown, ArrowDownCircle,
  ArrowUpCircle, SlidersHorizontal, Search, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const CAIXA_LOJA = "__caixa_loja__";

interface Linha {
  data: string;
  historico: string;
  entrada: number;
  saida: number;
  aReceber: number;
}

const fmtBR = (n: number) =>
  n === 0 ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSaldo = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (iso: string) => {
  try { return format(parseISO(iso), "dd/MM/yyyy"); } catch { return iso; }
};

export default function FluxoCaixa({ embedded }: { embedded?: boolean } = {}) {
  const { unidadeAtual } = useUnidade();
  const qc = useQueryClient();

  const hoje = new Date();
  const [contaId, setContaId] = useState<string>(CAIXA_LOJA);
  const [dataIni, setDataIni] = useState<string>(format(startOfMonth(hoje), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState<string>(format(endOfMonth(hoje), "yyyy-MM-dd"));
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "entradas" | "saidas">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "entrada", descricao: "", valor: "", categoria: "" });

  const { data: contas = [] } = useQuery({
    queryKey: ["fc_contas", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("contas_bancarias").select("id,nome,banco,saldo_inicial").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const contaSelecionada = contas.find((c) => c.id === contaId);
  const isCaixa = contaId === CAIXA_LOJA;

  const { data: extrato, isLoading } = useQuery({
    queryKey: ["fc_extrato", contaId, dataIni, dataFim, unidadeAtual?.id],
    queryFn: async () => {
      let saldoInicial = 0;
      const linhas: Linha[] = [];

      if (isCaixa) {
        let qa = supabase.from("movimentacoes_caixa")
          .select("tipo,valor")
          .eq("status", "aprovada")
          .lt("created_at", dataIni);
        if (unidadeAtual?.id) qa = qa.eq("unidade_id", unidadeAtual.id);
        const { data: ant } = await qa;
        saldoInicial = (ant || []).reduce(
          (s, m) => s + (m.tipo === "entrada" ? Number(m.valor) : -Number(m.valor)), 0,
        );

        let qp = supabase.from("movimentacoes_caixa")
          .select("tipo,valor,descricao,categoria,created_at")
          .eq("status", "aprovada")
          .gte("created_at", dataIni)
          .lte("created_at", `${dataFim}T23:59:59`)
          .order("created_at", { ascending: true });
        if (unidadeAtual?.id) qp = qp.eq("unidade_id", unidadeAtual.id);
        const { data: movs } = await qp;
        (movs || []).forEach((m: any) => {
          linhas.push({
            data: m.created_at.substring(0, 10),
            historico: m.descricao + (m.categoria ? ` (${m.categoria})` : ""),
            entrada: m.tipo === "entrada" ? Number(m.valor) : 0,
            saida: m.tipo === "saida" ? Number(m.valor) : 0,
            aReceber: 0,
          });
        });
      } else if (contaSelecionada) {
        const { data: ant } = await supabase.from("movimentacoes_bancarias")
          .select("tipo,valor")
          .eq("conta_bancaria_id", contaId)
          .lt("data", dataIni);
        saldoInicial = Number(contaSelecionada.saldo_inicial || 0) +
          (ant || []).reduce(
            (s, m) => s + (m.tipo === "entrada" ? Number(m.valor) : -Number(m.valor)), 0,
          );

        const { data: movs } = await supabase.from("movimentacoes_bancarias")
          .select("data,tipo,valor,descricao,categoria")
          .eq("conta_bancaria_id", contaId)
          .gte("data", dataIni)
          .lte("data", dataFim)
          .order("data", { ascending: true })
          .order("created_at", { ascending: true });
        (movs || []).forEach((m: any) => {
          linhas.push({
            data: m.data,
            historico: m.descricao + (m.categoria && m.categoria !== "manual" ? ` (${m.categoria})` : ""),
            entrada: m.tipo === "entrada" ? Number(m.valor) : 0,
            saida: m.tipo === "saida" ? Number(m.valor) : 0,
            aReceber: 0,
          });
        });
      }

      if (isCaixa) {
        let qr = supabase.from("contas_receber")
          .select("cliente,descricao,valor,vencimento")
          .eq("status", "pendente")
          .gte("vencimento", dataIni)
          .lte("vencimento", dataFim)
          .order("vencimento", { ascending: true });
        if (unidadeAtual?.id) qr = qr.eq("unidade_id", unidadeAtual.id);
        const { data: rec } = await qr;
        (rec || []).forEach((r: any) => {
          linhas.push({
            data: r.vencimento,
            historico: `A receber: ${r.cliente} — ${r.descricao}`,
            entrada: 0,
            saida: 0,
            aReceber: Number(r.valor),
          });
        });
      }

      linhas.sort((a, b) => a.data.localeCompare(b.data));
      return { saldoInicial, linhas };
    },
    enabled: !!unidadeAtual?.id || isCaixa,
  });

  const linhasFiltradas = useMemo(() => {
    if (!extrato) return [];
    const q = busca.trim().toLowerCase();
    return extrato.linhas.filter((l) => {
      if (q && !l.historico.toLowerCase().includes(q)) return false;
      if (tipoFiltro === "entradas" && l.entrada <= 0) return false;
      if (tipoFiltro === "saidas" && l.saida <= 0) return false;
      return true;
    });
  }, [extrato, busca, tipoFiltro]);

  const linhasComSaldo = useMemo(() => {
    let saldo = extrato?.saldoInicial ?? 0;
    return linhasFiltradas.map((l) => {
      saldo += l.entrada - l.saida;
      return { ...l, saldo };
    });
  }, [linhasFiltradas, extrato?.saldoInicial]);

  const totais = useMemo(() => {
    return linhasFiltradas.reduce(
      (acc, l) => ({
        entrada: acc.entrada + l.entrada,
        saida: acc.saida + l.saida,
        aReceber: acc.aReceber + l.aReceber,
      }),
      { entrada: 0, saida: 0, aReceber: 0 },
    );
  }, [linhasFiltradas]);

  const saldoInicial = extrato?.saldoInicial ?? 0;
  const saldoFinal = saldoInicial + totais.entrada - totais.saida;
  const tituloConta = isCaixa ? "Caixa da Loja" : (contaSelecionada?.nome ?? "—");

  const handleSubmit = async () => {
    if (!form.descricao || !form.valor) { toast.error("Preencha os campos obrigatórios"); return; }
    const { error } = await supabase.from("movimentacoes_caixa").insert({
      tipo: form.tipo, descricao: form.descricao,
      valor: parseFloat(form.valor), categoria: form.categoria || null,
      unidade_id: unidadeAtual?.id || null,
    });
    if (error) { toast.error("Erro ao registrar"); return; }
    toast.success("Movimentação registrada!");
    setDialogOpen(false);
    setForm({ tipo: "entrada", descricao: "", valor: "", categoria: "" });
    qc.invalidateQueries({ queryKey: ["fc_extrato"] });
  };

  const exportar = () => {
    const header = ["Data", "Histórico", "Entrada", "Saída", "A Receber", "Saldo"];
    const rows = linhasComSaldo.map((l) => [
      fmtData(l.data), l.historico.replace(/;/g, ","),
      l.entrada || "", l.saida || "", l.aReceber || "", l.saldo,
    ]);
    const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fluxo-caixa-${dataIni}-${dataFim}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtrosBody = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Caixa / Banco</Label>
        <Select value={contaId} onValueChange={setContaId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={CAIXA_LOJA}>Caixa da Loja</SelectItem>
            {contas.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}{c.banco ? ` · ${c.banco}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">De</Label>
        <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Até</Label>
        <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
      </div>
    </div>
  );

  const novaMovDialog = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="h-4 w-4" />Nova Mov.</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-4">
          <div><Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Descrição *</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
          <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
          <div><Label>Categoria</Label><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Opcional" /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const summaryCards = [
    {
      label: "Saldo Inicial",
      value: saldoInicial,
      icon: Wallet,
      tone: "text-foreground",
      bg: "bg-muted/40",
    },
    {
      label: "Entradas",
      value: totais.entrada,
      icon: ArrowDownCircle,
      tone: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Saídas",
      value: totais.saida,
      icon: ArrowUpCircle,
      tone: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Saldo Final",
      value: saldoFinal,
      icon: saldoFinal >= saldoInicial ? TrendingUp : TrendingDown,
      tone: saldoFinal < 0 ? "text-destructive" : "text-primary",
      bg: "bg-primary/10",
    },
  ];

  const content = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Page header local: subtítulo + ações (apenas embedded mantém o Header global) */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Acompanhe entradas, saídas e saldo · <span className="font-medium text-foreground">{tituloConta}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtros desktop inline */}
          <div className="hidden lg:flex items-center gap-2">
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="w-[150px]" />
            <span className="text-muted-foreground text-sm">até</span>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[150px]" />
          </div>

          {/* Filtros (mobile/tablet) */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-1.5 lg:hidden">
                <SlidersHorizontal className="h-4 w-4" />Filtros
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader><SheetTitle>Filtros</SheetTitle></SheetHeader>
              <div className="py-4">{filtrosBody}</div>
            </SheetContent>
          </Sheet>

          <Select value={contaId} onValueChange={setContaId}>
            <SelectTrigger className="hidden lg:flex w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={CAIXA_LOJA}>Caixa da Loja</SelectItem>
              {contas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" className="gap-1.5" onClick={exportar}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          {novaMovDialog}
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {summaryCards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="overflow-hidden">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{c.label}</p>
                    <p className={cn("mt-2 text-lg md:text-2xl font-bold tabular-nums truncate", c.tone)}>
                      R$ {fmtSaldo(c.value)}
                    </p>
                  </div>
                  <div className={cn("h-9 w-9 md:h-10 md:w-10 rounded-xl grid place-items-center shrink-0", c.bg)}>
                    <Icon className={cn("h-5 w-5", c.tone)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabela + filtros locais */}
      <Card>
        <CardContent className="p-3 md:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <Tabs value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as any)}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="entradas">Entradas</TabsTrigger>
                <TabsTrigger value="saidas">Saídas</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar no histórico..."
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto -mx-1">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-[110px]">Data</TableHead>
                  <TableHead>Histórico</TableHead>
                  <TableHead className="w-[110px]">Tipo</TableHead>
                  <TableHead className="text-right w-[130px]">Entradas</TableHead>
                  <TableHead className="text-right w-[130px]">Saídas</TableHead>
                  <TableHead className="text-right w-[130px]">A Receber</TableHead>
                  <TableHead className="text-right w-[140px]">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                <TableRow className="bg-muted/30">
                  <TableCell>{fmtData(dataIni)}</TableCell>
                  <TableCell className="font-semibold">SALDO INICIAL</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right font-semibold">{fmtSaldo(saldoInicial)}</TableCell>
                </TableRow>

                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
                )}

                {!isLoading && linhasComSaldo.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="p-4">
                      <EmptyState
                        compact
                        icon={Wallet}
                        title="Sem movimentações no período"
                        description="Ajuste o intervalo, selecione outra conta ou registre uma nova movimentação."
                        action={{ label: "Nova movimentação", onClick: () => setDialogOpen(true), icon: Plus }}
                      />
                    </TableCell>
                  </TableRow>
                )}

                {linhasComSaldo.map((l, i) => {
                  const tipo = l.entrada > 0 ? "entrada" : l.saida > 0 ? "saida" : "previsto";
                  return (
                    <TableRow key={i} className="hover:bg-muted/40">
                      <TableCell>{fmtData(l.data)}</TableCell>
                      <TableCell className="max-w-[420px] truncate">{l.historico}</TableCell>
                      <TableCell>
                        {tipo === "entrada" && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Entrada</Badge>
                        )}
                        {tipo === "saida" && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Saída</Badge>
                        )}
                        {tipo === "previsto" && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30">A Receber</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{fmtBR(l.entrada)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmtBR(l.saida)}</TableCell>
                      <TableCell className="text-right text-blue-600 dark:text-blue-400">{fmtBR(l.aReceber)}</TableCell>
                      <TableCell className={cn("text-right font-medium", l.saldo < 0 && "text-destructive")}>{fmtSaldo(l.saldo)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/60 font-semibold tabular-nums">
                  <TableCell colSpan={3}>TOTAL DO PERÍODO</TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{fmtSaldo(totais.entrada)}</TableCell>
                  <TableCell className="text-right text-destructive">{fmtSaldo(totais.saida)}</TableCell>
                  <TableCell className="text-right text-blue-600 dark:text-blue-400">{fmtSaldo(totais.aReceber)}</TableCell>
                  <TableCell className={cn("text-right", saldoFinal < 0 && "text-destructive")}>{fmtSaldo(saldoFinal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden space-y-2">
            {isLoading && (
              <p className="text-center text-muted-foreground py-6 text-sm">Carregando...</p>
            )}
            {!isLoading && linhasComSaldo.length === 0 && (
              <EmptyState
                compact
                icon={Wallet}
                title="Sem movimentações"
                description="Ajuste o período ou registre uma nova movimentação."
                action={{ label: "Nova", onClick: () => setDialogOpen(true), icon: Plus }}
              />
            )}
            {linhasComSaldo.map((l, i) => {
              const isEntrada = l.entrada > 0;
              const isSaida = l.saida > 0;
              const valor = isEntrada ? l.entrada : isSaida ? l.saida : l.aReceber;
              const sign = isSaida ? "-" : "";
              const tone = isEntrada
                ? "text-emerald-600 dark:text-emerald-400"
                : isSaida ? "text-destructive" : "text-blue-600 dark:text-blue-400";
              const tipoLbl = isEntrada ? "Entrada" : isSaida ? "Saída" : "A Receber";
              return (
                <div key={i} className="rounded-xl border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm leading-snug min-w-0 line-clamp-2">{l.historico}</p>
                    <p className={cn("text-sm font-bold tabular-nums whitespace-nowrap", tone)}>
                      {sign}R$ {fmtSaldo(valor)}
                    </p>
                  </div>
                  <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span>{fmtData(l.data)}</span>
                    <span>•</span>
                    <span>{tipoLbl}</span>
                    <span>•</span>
                    <span className="tabular-nums">Saldo R$ {fmtSaldo(l.saldo)}</span>
                  </div>
                </div>
              );
            })}
            {linhasComSaldo.length > 0 && (
              <div className="rounded-xl bg-muted/60 p-3 mt-2 text-sm font-semibold flex justify-between">
                <span>Saldo final</span>
                <span className={cn("tabular-nums", saldoFinal < 0 && "text-destructive")}>R$ {fmtSaldo(saldoFinal)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Fluxo de Caixa" subtitle="Extrato de caixas e contas bancárias" />
      {content}
    </MainLayout>
  );
}
