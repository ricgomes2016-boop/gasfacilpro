import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { FinancialHeroCard, HeroColor } from "@/components/ui/financial-hero-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CreditCard, Search, Plus, AlertCircle, CheckCircle2, Clock, MoreHorizontal,
  Pencil, Trash2, DollarSign, Download, Camera, Loader2, Layers,
  Building2, Filter, X, Mic, MicOff, AudioLines, FileText, Eye, FileUp, CalendarRange, ArrowUpDown,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ParcelamentoDialog } from "@/components/financeiro/ParcelamentoDialog";
import { CompromissosFuturos } from "@/components/financeiro/CompromissosFuturos";
import { format } from "date-fns";
import { useContasPagar, FORMAS_PAGAMENTO, getStatusContaPagar, isContaPaga, type ContaPagar } from "@/hooks/useContasPagar";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";

type SortKey = "vencimento" | "fornecedor" | "status" | "valor";

const STATUS_META: Record<string, { label: string; className: string; ordem: number }> = {
  vencida: { label: "Vencida", className: "border-destructive/30 bg-destructive/10 text-destructive", ordem: 0 },
  pendente: { label: "Pendente", className: "border-warning/30 bg-warning/10 text-warning", ordem: 1 },
  paga: { label: "Paga", className: "border-success/30 bg-success/10 text-success", ordem: 2 },
};

const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtData = (d?: string | null) => (d ? format(new Date(`${d.slice(0, 10)}T12:00:00`), "dd/MM/yyyy") : "—");

export default function ContasPagar() {
  const cp = useContasPagar();
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [showFutureCommitments, setShowFutureCommitments] = useState(false);
  const [futureRange, setFutureRange] = useState("30");
  const [valorMinimo, setValorMinimo] = useState("");
  const [valorMaximo, setValorMaximo] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  const matchValor = (c: { valor: number }) => {
    const valor = Number(c.valor);
    const min = valorMinimo ? Number(valorMinimo) : null;
    const max = valorMaximo ? Number(valorMaximo) : null;
    return (min === null || valor >= min) && (max === null || valor <= max);
  };

  /** Escopo independente do filtro de status — base dos KPIs. */
  const escopoContas = useMemo(
    () => cp.scopeFiltered.filter(matchValor),
    [cp.scopeFiltered, valorMinimo, valorMaximo],
  );

  const statusDe = (c: ContaPagar) => getStatusContaPagar(c, cp.hoje);

  const buckets = useMemo(() => {
    const abertas: ContaPagar[] = [];
    const aVencer: ContaPagar[] = [];
    const vencidas: ContaPagar[] = [];
    const pagas: ContaPagar[] = [];
    escopoContas.forEach(c => {
      const s = statusDe(c);
      if (s === "paga") pagas.push(c);
      else {
        abertas.push(c);
        (s === "vencida" ? vencidas : aVencer).push(c);
      }
    });
    return { abertas, aVencer, vencidas, pagas };
  }, [escopoContas, cp.hoje]);

  const soma = (list: ContaPagar[]) => list.reduce((a, c) => a + Number(c.valor), 0);
  const totalAbertoVisivel = soma(buckets.abertas);
  const contasVencemHoje = buckets.abertas.filter(c => c.vencimento === cp.hoje);

  const summaryCards: Array<{
    key: string; filtro: string; title: string; subtitle: string;
    total: number; contas: ContaPagar[]; icon: any; color: HeroColor;
  }> = [
    { key: "abertas", filtro: "abertas", title: "Total a pagar", subtitle: "Pendentes e vencidas", total: totalAbertoVisivel, contas: buckets.abertas, icon: CreditCard, color: "primary" },
    { key: "a-vencer", filtro: "pendente", title: "A vencer", subtitle: contasVencemHoje.length > 0 ? `${contasVencemHoje.length} vence${contasVencemHoje.length === 1 ? "" : "m"} hoje` : "Dentro do prazo", total: soma(buckets.aVencer), contas: buckets.aVencer, icon: Clock, color: "warning" },
    { key: "vencidas", filtro: "vencida", title: "Vencidas", subtitle: "Exigem prioridade", total: soma(buckets.vencidas), contas: buckets.vencidas, icon: AlertCircle, color: "danger" },
    { key: "pagas", filtro: "paga", title: "Pagas", subtitle: "Quitadas no escopo atual", total: soma(buckets.pagas), contas: buckets.pagas, icon: CheckCircle2, color: "success" },
  ];

  const quickFilters = [
    { value: "todos", label: "Todos", count: escopoContas.length },
    { value: "abertas", label: "Abertas", count: buckets.abertas.length },
    { value: "vencida", label: "Vencidas", count: buckets.vencidas.length },
    { value: "paga", label: "Pagas", count: buckets.pagas.length },
  ];

  const visibleContas = useMemo(() => {
    const rows = escopoContas.filter(cp.matchesStatusFiltro);
    const dir = sort?.dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      if (sort) {
        switch (sort.key) {
          case "fornecedor": return dir * a.fornecedor.localeCompare(b.fornecedor, "pt-BR");
          case "valor": return dir * (Number(a.valor) - Number(b.valor));
          case "status": return dir * (STATUS_META[statusDe(a)].ordem - STATUS_META[statusDe(b)].ordem);
          default: return dir * a.vencimento.localeCompare(b.vencimento);
        }
      }
      // Padrão: vencidas primeiro, depois vencimento mais próximo; pagas por pagamento recente
      const sa = statusDe(a); const sb = statusDe(b);
      if (sa !== sb) return STATUS_META[sa].ordem - STATUS_META[sb].ordem;
      if (sa === "paga") return (b.data_pagamento || b.vencimento).localeCompare(a.data_pagamento || a.vencimento);
      return a.vencimento.localeCompare(b.vencimento);
    });
  }, [escopoContas, cp.filtroStatus, cp.hoje, sort]);

  const totalVisivel = soma(visibleContas);
  const selecionadasVisiveis = visibleContas.filter(c => cp.selecionadasPagamentoIds.has(c.id));

  const toggleSort = (key: SortKey) =>
    setSort(prev => (prev?.key === key ? (prev.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));

  const groupedVisible = useMemo(() => {
    if (!cp.agrupar) return null;
    const groups: Record<string, ContaPagar[]> = {};
    visibleContas.forEach(c => {
      (groups[c.fornecedor] ||= []).push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [cp.agrupar, visibleContas]);

  const hasVisibleFilters = cp.hasActiveFilters || !!cp.search || !!valorMinimo || !!valorMaximo;
  const limparTudo = () => { cp.clearAllFilters(); cp.setSearch(""); setValorMinimo(""); setValorMaximo(""); };

  const applyDateShortcut = (days: number) => {
    const start = new Date(`${cp.hoje}T12:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + days);
    cp.setDataInicial(cp.hoje);
    cp.setDataFinal(end.toISOString().split("T")[0]);
  };

  const abrirVisaoCard = (filtro: string) => {
    cp.setFiltroStatus(filtro);
    setSort(null);
  };

  const sortIcon = (key: SortKey) =>
    sort?.key === key ? <ArrowUpDown className={`h-3 w-3 ${sort.dir === "desc" ? "rotate-180" : ""}`} /> : <ArrowUpDown className="h-3 w-3 opacity-30" />;

  const rowActions = (conta: ContaPagar) => (
    <>
      {!isContaPaga(conta) && <DropdownMenuItem onClick={() => cp.openPagarDialog(conta)}><DollarSign className="mr-2 h-4 w-4" />Pagar</DropdownMenuItem>}
      <DropdownMenuItem onClick={() => cp.handleEdit(conta)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
      {(conta.boleto_url || conta.boleto_linha_digitavel) && <DropdownMenuItem onClick={() => cp.handleViewBoleto(conta)}><Eye className="mr-2 h-4 w-4" />Ver boleto</DropdownMenuItem>}
      <DropdownMenuItem className="text-destructive" onClick={() => cp.setDeleteId(conta.id)}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
    </>
  );

  const renderRow = (conta: ContaPagar, agrupado = false) => {
    const st = statusDe(conta);
    const meta = STATUS_META[st];
    const parcela = conta.parcela_numero && conta.parcela_total ? `${conta.parcela_numero}/${conta.parcela_total}` : null;
    return (
      <TableRow
        key={conta.id}
        className={`border-b transition-colors odd:bg-muted/20 hover:bg-muted/50 ${st === "vencida" ? "bg-destructive/[0.04]" : ""} ${st === "paga" ? "text-muted-foreground" : ""}`}
      >
        <TableCell className="py-2 pl-4">
          <Checkbox checked={cp.selecionadasPagamentoIds.has(conta.id)} disabled={isContaPaga(conta)} onCheckedChange={() => cp.togglePagamentoSelection(conta.id)} aria-label={`Selecionar ${conta.descricao}`} />
        </TableCell>
        <TableCell className="whitespace-nowrap py-2 tabular-nums">{fmtData(conta.vencimento)}</TableCell>
        <TableCell className={`py-2 ${agrupado ? "pl-8" : ""}`}>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{conta.fornecedor}</p>
            <p className="truncate text-xs text-muted-foreground">{conta.descricao}</p>
          </div>
        </TableCell>
        <TableCell className="hidden py-2 xl:table-cell">
          <span className="text-xs text-muted-foreground">{conta.categoria || "—"}</span>
        </TableCell>
        <TableCell className="hidden py-2 text-xs text-muted-foreground xl:table-cell">
          {parcela ? `Parcela ${parcela}` : conta.origem || "—"}
        </TableCell>
        <TableCell className="hidden py-2 text-xs text-muted-foreground 2xl:table-cell">{fmtData(conta.created_at?.slice(0, 10))}</TableCell>
        <TableCell className="hidden py-2 text-xs lg:table-cell">
          {st === "paga"
            ? <span className="text-muted-foreground">{fmtData(conta.data_pagamento)}{conta.forma_pagamento ? ` · ${conta.forma_pagamento}` : ""}</span>
            : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="py-2">
          <Badge variant="outline" className={`text-[10px] font-semibold ${meta.className}`}>{meta.label}</Badge>
        </TableCell>
        <TableCell className="py-2 text-right font-semibold tabular-nums text-foreground">{brl(Number(conta.valor))}</TableCell>
        <TableCell className="py-2 pr-4 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">{rowActions(conta)}</DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  };



  return (
    <MainLayout>
      <Header title="Contas a Pagar" subtitle="Gerencie todas as contas, parcelamentos e empréstimos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        {/* Hidden file inputs */}
        <input ref={cp.fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={cp.handlePhotoCapture} />
        <input ref={cp.boletoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => cp.handleBoletoCapture(e, false)} />
        <input ref={cp.boletoPdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => cp.handleBoletoCapture(e, true)} />

        <div className="space-y-4 md:space-y-6">
            {/* KPI Hero Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map(card => (
                <FinancialHeroCard
                  key={card.key}
                  title={card.title}
                  value={`R$ ${card.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  subtitle={`${card.contas.length} conta${card.contas.length === 1 ? "" : "s"} · ${card.subtitle}`}
                  icon={card.icon}
                  color={card.color}
                  onClick={() => abrirVisaoCard(card.filtro)}
                />
              ))}
            </div>

            {/* Action Toolbar */}
            <div className="rounded-xl border bg-card/90 p-3 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{visibleContas.length}</span>
                  conta{visibleContas.length === 1 ? "" : "s"} no filtro atual
                  {contasVencemHoje.length > 0 && (
                    <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                      {contasVencemHoje.length} vence{contasVencemHoje.length === 1 ? "" : "m"} hoje
                    </Badge>
                  )}
                  {hasVisibleFilters && (
                    <Button
                      variant="ghost"
                      onClick={() => { cp.clearAllFilters(); cp.setSearch(""); setValorMinimo(""); setValorMaximo(""); }}
                      className="h-8 gap-1 px-2 text-xs"
                    >
                      <X className="h-3.5 w-3.5" /> Limpar filtros
                    </Button>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Dialog open={cp.dialogOpen} onOpenChange={(open) => { cp.setDialogOpen(open); if (!open) { cp.setEditId(null); cp.resetForm(); } }}>
                <DialogTrigger asChild>
                  <Button className="order-last h-10 w-full gap-2 sm:w-auto"><Plus className="h-4 w-4" />Nova Conta</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                  <DialogHeader><DialogTitle>{cp.editId ? "Editar Conta" : "Informacoes da conta"}</DialogTitle></DialogHeader>
                  <div className="space-y-5 pt-3">
                    <div className="rounded-xl border border-success/25 bg-success/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-success">Fornecedor *</Label>
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <Link to="/operacional/fornecedores">Cadastrar</Link>
                        </Button>
                      </div>
                      <Select value={cp.form.fornecedor} onValueChange={v => cp.setForm({ ...cp.form, fornecedor: v })}>
                        <SelectTrigger className="mt-2 border-success/25 bg-background/90">
                          <SelectValue placeholder={cp.fornecedoresCadastro.length > 0 ? "Selecione um fornecedor" : "Cadastre um fornecedor primeiro"} />
                        </SelectTrigger>
                        <SelectContent>
                          {cp.fornecedoresCadastro.length === 0 && (
                            <SelectItem value="sem-fornecedor" disabled>Nenhum fornecedor ativo</SelectItem>
                          )}
                          {cp.fornecedoresCadastro.map(f => (
                            <SelectItem key={f.id} value={f.razao_social}>
                              {f.razao_social}{f.nome_fantasia ? ` - ${f.nome_fantasia}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2 lg:col-span-2">
                        <Label>Conta despesa</Label>
                        <Select value={cp.form.categoria} onValueChange={v => cp.setForm({ ...cp.form, categoria: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {cp.categoriasNomes.length === 0 ? (
                              <SelectItem value="__sem_categoria__" disabled>Cadastre categorias em Configurações</SelectItem>
                            ) : (
                              cp.categoriasNomes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Valor da conta R$ *</Label>
                        <Input type="number" step="0.01" value={cp.form.valor} onChange={e => cp.setForm({ ...cp.form, valor: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Data de vencimento *</Label>
                        <Input type="date" value={cp.form.vencimento} onChange={e => cp.setForm({ ...cp.form, vencimento: e.target.value })} />
                      </div>
                      <div className="space-y-2 lg:col-span-4">
                        <Label>Descricao *</Label>
                        <Input value={cp.form.descricao} onChange={e => cp.setForm({ ...cp.form, descricao: e.target.value })} placeholder="Ex.: Compra NF 1603, aluguel, energia..." />
                      </div>
                      <div className="space-y-2 lg:col-span-4">
                        <Label>Observacoes</Label>
                        <Textarea value={cp.form.observacoes} onChange={e => cp.setForm({ ...cp.form, observacoes: e.target.value })} rows={4} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => { cp.setDialogOpen(false); cp.setEditId(null); cp.resetForm(); }}>Cancelar</Button>
                      <Button onClick={cp.handleSubmit}>{cp.editId ? "Atualizar" : "Cadastrar"}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" className="h-10 w-full gap-2 sm:w-auto" onClick={() => setAdvancedSearchOpen(true)}>
                <Search className="h-4 w-4" />Busca avançada
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 w-full gap-2 sm:w-auto">
                    <MoreHorizontal className="h-4 w-4" />Mais ações
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => cp.fileInputRef.current?.click()}><Camera className="h-4 w-4 mr-2" />Foto com IA</DropdownMenuItem>
                  <DropdownMenuItem onClick={cp.voiceListening ? cp.stopVoiceListening : cp.startVoiceListening}>{cp.voiceListening ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}{cp.voiceListening ? "Parar voz" : "Lançamento por voz"}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => cp.boletoInputRef.current?.click()}><FileText className="h-4 w-4 mr-2" />Ler boleto</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => cp.boletoPdfInputRef.current?.click()}><FileUp className="h-4 w-4 mr-2" />Importar PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => cp.setParcelamentoOpen(true)}><CalendarRange className="h-4 w-4 mr-2" />Parcelar / Empréstimo</DropdownMenuItem>
                  {cp.fornecedoresComMultiplas.length > 0 && <DropdownMenuItem onClick={cp.openUnificarDialog}><Layers className="h-4 w-4 mr-2" />Unificar fornecedor</DropdownMenuItem>}
                  <DropdownMenuItem onClick={cp.exportToExcel}><Download className="h-4 w-4 mr-2" />Exportar Excel</DropdownMenuItem>
                  <DropdownMenuItem onClick={cp.exportToPDF}><Download className="h-4 w-4 mr-2" />Exportar PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </div>
            </div>

            <Dialog open={advancedSearchOpen} onOpenChange={setAdvancedSearchOpen}>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader><DialogTitle>Busca avançada</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Busca geral</Label>
                    <Input placeholder="Fornecedor, descricao ou observacao..." value={cp.search} onChange={e => cp.setSearch(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Fornecedor</Label>
                      <Select value={cp.filtroFornecedor} onValueChange={cp.setFiltroFornecedor}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="todos">Todos</SelectItem>{cp.fornecedoresUnicos.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Conta despesa</Label>
                      <Select value={cp.filtroCategoria} onValueChange={cp.setFiltroCategoria}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="todos">Todas</SelectItem>{cp.categoriasUnicas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={cp.filtroStatus} onValueChange={cp.setFiltroStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="abertas">A vencer / vencidas</SelectItem>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="pendente">Pendentes</SelectItem>
                          <SelectItem value="vencida">Vencidas</SelectItem>
                          <SelectItem value="paga">Pagas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Vencimento inicial</Label>
                      <Input type="date" value={cp.dataInicial} onChange={e => cp.setDataInicial(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Vencimento final</Label>
                      <Input type="date" value={cp.dataFinal} onChange={e => cp.setDataFinal(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor minimo</Label>
                      <Input type="number" step="0.01" placeholder="0,00" value={valorMinimo} onChange={e => setValorMinimo(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor maximo</Label>
                      <Input type="number" step="0.01" placeholder="0,00" value={valorMaximo} onChange={e => setValorMaximo(e.target.value)} />
                    </div>
                    <div className="flex items-end">
                      <div className="flex h-10 items-center gap-2">
                        <Checkbox id="agrupar-avancado" checked={cp.agrupar} onCheckedChange={(v) => cp.setAgrupar(!!v)} />
                        <Label htmlFor="agrupar-avancado" className="cursor-pointer text-sm">Agrupar por fornecedor</Label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Atalhos de periodo</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => { cp.setDataInicial(cp.hoje); cp.setDataFinal(cp.hoje); }}>Hoje</Button>
                     <Button type="button" variant={cp.isMesAtual ? "default" : "outline"} size="sm" onClick={cp.aplicarMesAtual}>Mês atual</Button>
                     <Button type="button" variant="outline" size="sm" onClick={() => applyDateShortcut(7)}>Proximos 7 dias</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => applyDateShortcut(15)}>Proximos 15 dias</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => applyDateShortcut(30)}>Proximos 30 dias</Button>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label className="text-sm font-medium">Mostrar compromissos futuros</Label>
                        <p className="text-xs text-muted-foreground">Consulta a previsao de compromissos sem transformar isso em aba principal.</p>
                      </div>
                      <Switch checked={showFutureCommitments} onCheckedChange={setShowFutureCommitments} />
                    </div>
                    {showFutureCommitments && (
                      <div className="space-y-3">
                        <Select value={futureRange} onValueChange={setFutureRange}>
                          <SelectTrigger><SelectValue placeholder="Periodo" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">Proximos 7 dias</SelectItem>
                            <SelectItem value="15">Proximos 15 dias</SelectItem>
                            <SelectItem value="30">Proximos 30 dias</SelectItem>
                            <SelectItem value="60">Proximos 60 dias</SelectItem>
                            <SelectItem value="personalizado">Personalizado</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="max-h-[360px] overflow-y-auto rounded-lg border bg-background">
                          <CompromissosFuturos />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { cp.clearAllFilters(); cp.setSearch(""); setValorMinimo(""); setValorMaximo(""); }}>Limpar</Button>
                    <Button onClick={() => setAdvancedSearchOpen(false)}><Search className="h-4 w-4 mr-2" />Aplicar busca</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Main table/card list */}
            <Card className="modern-panel overflow-hidden">
              <CardHeader className="gap-3 px-3 pb-3 sm:px-6">
                {/* Busca visível + filtros rápidos */}
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                  <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Período (por vencimento):</span>
                  <span className="font-semibold text-foreground">{fmtData(cp.dataInicial)} → {fmtData(cp.dataFinal)}</span>
                  {cp.isMesAtual ? (
                    <Badge variant="secondary" className="py-0 text-[10px]">Mês atual</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={cp.aplicarMesAtual}>Voltar ao mês atual</Button>
                  )}
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative w-full lg:max-w-sm">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={cp.search}
                      onChange={e => cp.setSearch(e.target.value)}
                      placeholder="Buscar fornecedor, descrição ou observação..."
                      className="h-10 pl-8 pr-8 text-base sm:text-sm"
                    />
                    {cp.search && (
                      <button type="button" aria-label="Limpar busca" onClick={() => cp.setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {quickFilters.map(f => (
                      <Button
                        key={f.value}
                        size="sm"
                        variant={cp.filtroStatus === f.value ? "default" : "outline"}
                        className="h-8 gap-1.5 rounded-full px-3 text-xs"
                        onClick={() => cp.setFiltroStatus(f.value)}
                      >
                        {f.label}
                        <span className="rounded-full bg-background/25 px-1.5 text-[10px] font-semibold">{f.count}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {hasVisibleFilters && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Filter className="h-3 w-3" /><span>{visibleContas.length} de {cp.contas.length} contas</span>
                    {cp.filtroFornecedor !== "todos" && <Badge variant="secondary" className="gap-1 py-0 text-xs">{cp.filtroFornecedor}<button onClick={() => cp.setFiltroFornecedor("todos")}><X className="h-3 w-3" /></button></Badge>}
                    {cp.filtroCategoria !== "todos" && <Badge variant="secondary" className="gap-1 py-0 text-xs">{cp.filtroCategoria}<button onClick={() => cp.setFiltroCategoria("todos")}><X className="h-3 w-3" /></button></Badge>}
                    {!cp.isMesAtual && (cp.dataInicial || cp.dataFinal) && <Badge variant="secondary" className="gap-1 py-0 text-xs">{fmtData(cp.dataInicial)} → {fmtData(cp.dataFinal)}<button onClick={cp.aplicarMesAtual} aria-label="Voltar ao mês atual"><X className="h-3 w-3" /></button></Badge>}
                    {valorMinimo && <Badge variant="secondary" className="gap-1 py-0 text-xs">Min: R$ {valorMinimo}<button onClick={() => setValorMinimo("")}><X className="h-3 w-3" /></button></Badge>}
                    {valorMaximo && <Badge variant="secondary" className="gap-1 py-0 text-xs">Max: R$ {valorMaximo}<button onClick={() => setValorMaximo("")}><X className="h-3 w-3" /></button></Badge>}
                    <Button variant="ghost" onClick={limparTudo} className="h-7 gap-1 px-2 text-xs"><X className="h-3 w-3" />Limpar tudo</Button>
                  </div>
                )}

                {cp.selecionadasPagamentoIds.size > 0 && (
                  <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-success sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-semibold">
                      {cp.selecionadasPagamentoIds.size} conta{cp.selecionadasPagamentoIds.size > 1 ? "s" : ""} selecionada{cp.selecionadasPagamentoIds.size > 1 ? "s" : ""} · {brl(cp.totalSelecionadoPagamento)}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={cp.clearPagamentoSelection}>Limpar</Button>
                      <Button size="sm" className="gap-2" onClick={cp.openPagarSelecionadasDialog}><DollarSign className="h-4 w-4" />Pagar selecionadas</Button>
                    </div>
                  </div>
                )}
              </CardHeader>

              <CardContent className="px-0 pb-0 sm:px-0">
                {cp.loadError ? (
                  <div className="px-4 py-10">
                    <EmptyState
                      icon={AlertCircle}
                      title="Não foi possível carregar as contas"
                      description={cp.loadError}
                      action={{ label: "Tentar novamente", onClick: cp.fetchContas, icon: Loader2 }}
                    />
                  </div>
                ) : cp.loading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-11 w-full animate-pulse rounded-lg bg-muted" />
                    ))}
                  </div>
                ) : visibleContas.length === 0 ? (
                  <div className="px-4 py-10">
                    <EmptyState
                      icon={CreditCard}
                      title={hasVisibleFilters || cp.filtroStatus !== "abertas" ? "Nenhuma conta para estes filtros" : "Nenhuma conta a pagar"}
                      description={hasVisibleFilters || cp.filtroStatus !== "abertas"
                        ? "Ajuste a busca, o período ou o status para encontrar os lançamentos."
                        : "Registre a primeira conta a pagar para controlar seus compromissos."}
                      action={hasVisibleFilters
                        ? { label: "Limpar filtros", onClick: limparTudo, icon: X }
                        : { label: "Nova conta", onClick: () => cp.setDialogOpen(true), icon: Plus }}
                    />
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden max-h-[70vh] overflow-auto sm:block">
                      <Table className="text-sm">
                        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                          <TableRow className="border-b hover:bg-transparent [&_th]:h-10 [&_th]:whitespace-nowrap [&_th]:py-0 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                            <TableHead className="w-10 pl-4">
                              <Checkbox checked={cp.todasPagaveisSelecionadas} onCheckedChange={cp.toggleAllPagamentoSelection} aria-label="Selecionar contas" />
                            </TableHead>
                            <TableHead className="w-[110px]">
                              <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("vencimento")}>Vencimento{sortIcon("vencimento")}</button>
                            </TableHead>
                            <TableHead className="min-w-[220px]">
                              <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("fornecedor")}>Fornecedor{sortIcon("fornecedor")}</button>
                            </TableHead>
                            <TableHead className="hidden xl:table-cell">Categoria</TableHead>
                            <TableHead className="hidden xl:table-cell">Parcela / Origem</TableHead>
                            <TableHead className="hidden 2xl:table-cell w-[110px]">Lançamento</TableHead>
                            <TableHead className="hidden lg:table-cell w-[150px]">Pagamento</TableHead>
                            <TableHead className="w-[110px]">
                              <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("status")}>Status{sortIcon("status")}</button>
                            </TableHead>
                            <TableHead className="w-[130px] text-right">
                              <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("valor")}>Valor{sortIcon("valor")}</button>
                            </TableHead>
                            <TableHead className="w-12 pr-4 text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cp.agrupar && groupedVisible
                            ? groupedVisible.flatMap(([fornecedor, items]) => [
                                <TableRow key={`grp-${fornecedor}`} className="bg-muted/40 hover:bg-muted/40">
                                  <TableCell colSpan={8} className="py-2 pl-4 text-xs font-semibold">
                                    <span className="inline-flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />{fornecedor}
                                      <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-2 text-right text-xs font-bold tabular-nums">{brl(items.reduce((s, c) => s + Number(c.valor), 0))}</TableCell>
                                  <TableCell className="py-2" />
                                </TableRow>,
                                ...items.map(conta => renderRow(conta, true)),
                              ])
                            : visibleContas.map(conta => renderRow(conta))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile cards */}
                    <div className="space-y-2 p-2 sm:hidden">
                      {visibleContas.map(conta => {
                        const st = statusDe(conta);
                        const meta = STATUS_META[st];
                        return (
                          <div key={conta.id} className="rounded-xl bg-card p-3 shadow-[0_1px_3px_hsl(var(--foreground)/0.09)]">
                            <div className="flex items-start gap-2">
                              <Checkbox checked={cp.selecionadasPagamentoIds.has(conta.id)} disabled={isContaPaga(conta)} onCheckedChange={() => cp.togglePagamentoSelection(conta.id)} aria-label={`Selecionar ${conta.descricao}`} className="mt-1 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{conta.fornecedor}</p>
                                <p className="line-clamp-2 text-xs text-muted-foreground">{conta.descricao}</p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Mais ações de ${conta.descricao}`} className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">{rowActions(conta)}</DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className={`text-[10px] ${meta.className}`}>{meta.label}</Badge>
                                <span className="text-[11px] text-muted-foreground">
                                  {st === "paga" ? `Pago ${fmtData(conta.data_pagamento)}` : `Venc. ${fmtData(conta.vencimento)}`}
                                </span>
                              </div>
                              <span className="text-sm font-bold tabular-nums">{brl(Number(conta.valor))}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Rodapé/resumo */}
                    <div className="flex flex-col gap-1 border-t bg-muted/30 px-4 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-muted-foreground">
                        {visibleContas.length} registro{visibleContas.length === 1 ? "" : "s"} nesta visão
                        {selecionadasVisiveis.length > 0 && ` · ${selecionadasVisiveis.length} selecionado(s): ${brl(soma(selecionadasVisiveis))}`}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">Total visível: {brl(totalVisivel)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

        </div>

        {/* ===== DIALOGS ===== */}

        {/* Pagar */}
        <Dialog open={cp.pagarDialogOpen} onOpenChange={cp.setPagarDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{cp.pagamentoEmLoteIds.size > 0 ? "Pagar Contas Selecionadas" : "Pagar Conta"}</DialogTitle></DialogHeader>
            {cp.pagarConta && (
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-sm font-medium">{cp.pagarConta.fornecedor}</p>
                  <p className="text-xs text-muted-foreground">{cp.pagarConta.descricao}</p>
                  {cp.pagamentoEmLoteIds.size > 0 && <p className="text-xs font-medium text-success">{cp.pagamentoEmLoteIds.size} contas serão quitadas juntas</p>}
                  <p className="text-lg font-bold">R$ {Number(cp.pagarConta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Formas de Pagamento</Label>
                    <Button type="button" variant="outline" size="sm" onClick={cp.addFormaPagamento}>+ Forma</Button>
                  </div>
                  {cp.pagarForm.formasPagamento.map((fp, idx) => (
                    <div key={idx} className="space-y-2 p-2 rounded-md border bg-card">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-xs">Forma</Label>
                          <Select value={fp.forma} onValueChange={v => cp.updateFormaPagamento(idx, "forma", v)}>
                            <SelectTrigger><SelectValue placeholder="Forma" /></SelectTrigger>
                            <SelectContent>{FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="w-[120px]">
                          <Label className="text-xs">Valor</Label>
                          <Input type="number" step="0.01" placeholder="0,00" value={fp.valor} onChange={e => cp.updateFormaPagamento(idx, "valor", e.target.value)} />
                        </div>
                        {cp.pagarForm.formasPagamento.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => cp.removeFormaPagamento(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        )}
                      </div>
                      {fp.forma && fp.origemTipo !== "cartao" && (
                        <div>
                          <Label className="text-xs">Sair de *</Label>
                          {fp.origemTipo === "caixa" ? (
                            <div className="px-3 py-2 text-sm rounded-md bg-muted/60 border">💵 Caixa da Loja</div>
                          ) : (
                            <Select value={fp.origemId} onValueChange={v => cp.updateFormaPagamento(idx, "origemId", v)}>
                              <SelectTrigger><SelectValue placeholder="Selecione a conta bancária" /></SelectTrigger>
                              <SelectContent>
                                {cp.contasBancarias.length === 0 && <SelectItem value="nenhum" disabled>Nenhuma conta cadastrada</SelectItem>}
                                {cp.contasBancarias.map(c => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.nome} ({c.banco}) — R$ {Number(c.saldo_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                      {fp.origemTipo === "cartao" && (
                        <p className="text-xs text-muted-foreground px-1">💳 Será lançado na fatura — não debita saldo agora.</p>
                      )}
                    </div>
                  ))}

                  <div className="text-sm text-muted-foreground">
                    Total informado: <span className="font-medium text-foreground">R$ {cp.pagarForm.formasPagamento.reduce((s, f) => s + (parseFloat(f.valor) || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    {cp.pagarForm.formasPagamento.reduce((s, f) => s + (parseFloat(f.valor) || 0), 0) < Number(cp.pagarConta.valor) - 0.01 && (
                      <span className="ml-2 text-warning">(Pagamento parcial)</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => cp.setPagarDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={cp.handlePagar}>Confirmar Pagamento</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete */}
        <AlertDialog open={!!cp.deleteId} onOpenChange={() => cp.setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={cp.handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Voice */}
        <Dialog open={cp.voiceDialogOpen} onOpenChange={(open) => { if (!cp.voiceProcessing) { cp.setVoiceDialogOpen(open); if (!open) { cp.stopVoiceListening(); } } }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><AudioLines className="h-5 w-5" />Comando de Voz</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex flex-col items-center gap-4">
                {cp.voiceListening ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse"><Mic className="h-8 w-8 text-destructive" /></div>
                    <p className="text-sm text-muted-foreground">Ouvindo... Fale a despesa</p>
                    <Button variant="destructive" size="sm" onClick={cp.stopVoiceListening}><MicOff className="h-4 w-4 mr-2" /> Parar</Button>
                  </div>
                ) : (
                  <Button variant="microphone" onClick={cp.startVoiceListening} disabled={cp.voiceProcessing}><Mic className="h-4 w-4 mr-2" /> Gravar novamente</Button>
                )}
              </div>
              {cp.voiceText && <div className="space-y-2"><Label>Texto capturado:</Label><div className="p-3 bg-muted rounded-lg text-sm min-h-[60px]">{cp.voiceText}</div></div>}
              <p className="text-xs text-muted-foreground">Exemplo: "Conta de luz da Enel, duzentos e cinquenta reais, vence dia 20"</p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { cp.setVoiceDialogOpen(false); cp.stopVoiceListening(); }} disabled={cp.voiceProcessing}>Cancelar</Button>
                <Button onClick={cp.processVoiceCommand} disabled={!cp.voiceText.trim() || cp.voiceProcessing || cp.voiceListening}>
                  {cp.voiceProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</> : "Interpretar com IA"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Photo AI */}
        <Dialog open={cp.photoDialogOpen} onOpenChange={(open) => { if (!cp.photoProcessing) cp.setPhotoDialogOpen(open); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" />Importar Despesas por Foto (IA)</DialogTitle></DialogHeader>
            {cp.photoProcessing && (
              <div className="flex flex-col items-center gap-4 py-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Analisando imagem com IA...</p>
              </div>
            )}
            {!cp.photoProcessing && cp.extractedExpenses.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{cp.extractedExpenses.length} despesa(s) identificada(s). Revise antes de salvar:</p>
                {cp.extractedExpenses.map((expense, idx) => (
                  <Card key={idx} className="relative">
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-destructive" onClick={() => cp.removeExtracted(idx)}><Trash2 className="h-4 w-4" /></Button>
                    <CardContent className="pt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">Fornecedor</Label><Input value={expense.fornecedor} onChange={e => cp.updateExtractedField(idx, "fornecedor", e.target.value)} /></div>
                        <div><Label className="text-xs">Categoria</Label>
                          <Select value={expense.categoria} onValueChange={v => cp.updateExtractedField(idx, "categoria", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {cp.categoriasNomes.length === 0 ? (
                                <SelectItem value="__sem_categoria__" disabled>Cadastre categorias em Configurações</SelectItem>
                              ) : (
                                cp.categoriasNomes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div><Label className="text-xs">Descrição</Label><Input value={expense.descricao} onChange={e => cp.updateExtractedField(idx, "descricao", e.target.value)} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" value={expense.valor} onChange={e => cp.updateExtractedField(idx, "valor", parseFloat(e.target.value) || 0)} /></div>
                        <div><Label className="text-xs">Vencimento</Label><Input type="date" value={expense.vencimento} onChange={e => cp.updateExtractedField(idx, "vencimento", e.target.value)} /></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => cp.setPhotoDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={cp.handleSaveExtracted} className="gap-2"><CheckCircle2 className="h-4 w-4" />Salvar {cp.extractedExpenses.length} despesa(s)</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Boleto */}
        <Dialog open={cp.boletoDialogOpen} onOpenChange={cp.setBoletoDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Importar Boleto</DialogTitle></DialogHeader>
            {cp.boletoProcessing ? (
              <div className="flex flex-col items-center gap-4 py-8"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="text-muted-foreground">Lendo boleto com IA...</p></div>
            ) : cp.boletoData ? (
              <div className="space-y-3">
                <div><Label>Fornecedor</Label><Input value={cp.boletoData.fornecedor} onChange={e => cp.setBoletoData({ ...cp.boletoData, fornecedor: e.target.value })} /></div>
                <div><Label>Descrição</Label><Input value={cp.boletoData.descricao} onChange={e => cp.setBoletoData({ ...cp.boletoData, descricao: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor</Label><Input type="number" step="0.01" value={cp.boletoData.valor} onChange={e => cp.setBoletoData({ ...cp.boletoData, valor: parseFloat(e.target.value) })} /></div>
                  <div><Label>Vencimento</Label><Input type="date" value={cp.boletoData.vencimento} onChange={e => cp.setBoletoData({ ...cp.boletoData, vencimento: e.target.value })} /></div>
                </div>
                {cp.boletoData.linha_digitavel && <div><Label>Linha Digitável</Label><Input value={cp.boletoData.linha_digitavel} readOnly className="font-mono text-xs" /></div>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => cp.setBoletoDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={cp.handleSaveBoleto}>Salvar Boleto</Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Parcelamento */}
        <ParcelamentoDialog open={cp.parcelamentoOpen} onOpenChange={cp.setParcelamentoOpen} categorias={cp.categoriasNomes} onSuccess={cp.fetchContas} />
      </div>
    </MainLayout>
  );
}
