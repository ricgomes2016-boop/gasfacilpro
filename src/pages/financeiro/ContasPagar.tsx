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
  Building2, Filter, X, Mic, MicOff, AudioLines, FileText, Eye, FileUp, CalendarRange,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ParcelamentoDialog } from "@/components/financeiro/ParcelamentoDialog";
import { CompromissosFuturos } from "@/components/financeiro/CompromissosFuturos";
import { format } from "date-fns";
import { useContasPagar, FORMAS_PAGAMENTO } from "@/hooks/useContasPagar";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";

export default function ContasPagar() {
  const cp = useContasPagar();
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [showFutureCommitments, setShowFutureCommitments] = useState(false);
  const [futureRange, setFutureRange] = useState("30");
  const [valorMinimo, setValorMinimo] = useState("");
  const [valorMaximo, setValorMaximo] = useState("");
  const [selectedSummaryKey, setSelectedSummaryKey] = useState<string | null>(null);
  const visibleContas = cp.filtered.filter(c => {
    const valor = Number(c.valor);
    const min = valorMinimo ? Number(valorMinimo) : null;
    const max = valorMaximo ? Number(valorMaximo) : null;
    return (min === null || valor >= min) && (max === null || valor <= max);
  });
  const totalPendenteVisivel = visibleContas.filter(c => c.status === "pendente" && c.vencimento >= cp.hoje).reduce((a, c) => a + Number(c.valor), 0);
  const totalVencidoVisivel = visibleContas.filter(c => (c.status === "pendente" || c.status === "vencida") && c.vencimento < cp.hoje).reduce((a, c) => a + Number(c.valor), 0);
  const totalPagoVisivel = visibleContas.filter(c => c.status === "paga").reduce((a, c) => a + Number(c.valor), 0);
  const totalAbertoVisivel = totalPendenteVisivel + totalVencidoVisivel;
  const contasVencemHoje = visibleContas.filter(c => c.status !== "paga" && c.vencimento === cp.hoje);
  const summaryCards = [
    {
      key: "abertas",
      title: "Total a pagar",
      subtitle: "Contas pendentes e vencidas",
      total: totalAbertoVisivel,
      contas: visibleContas.filter(c => c.status !== "paga"),
      icon: CreditCard,
      cardClass: "kpi-card-primary",
      iconClass: "status-card-icon-primary",
      valueClass: "",
    },
    {
      key: "a-vencer",
      title: "A vencer",
      subtitle: contasVencemHoje.length > 0 ? `${contasVencemHoje.length} vence${contasVencemHoje.length === 1 ? "" : "m"} hoje` : "Ainda dentro do prazo",
      total: totalPendenteVisivel,
      contas: visibleContas.filter(c => c.status === "pendente" && c.vencimento >= cp.hoje),
      icon: Clock,
      cardClass: "kpi-card-warning",
      iconClass: "status-card-icon-warning",
      valueClass: "text-warning",
    },
    {
      key: "vencidas",
      title: "Vencidas",
      subtitle: "Exigem prioridade",
      total: totalVencidoVisivel,
      contas: visibleContas.filter(c => (c.status === "pendente" || c.status === "vencida") && c.vencimento < cp.hoje),
      icon: AlertCircle,
      cardClass: "kpi-card-destructive",
      iconClass: "status-card-icon-destructive",
      valueClass: "text-destructive",
    },
    {
      key: "pagas",
      title: "Pagas",
      subtitle: "Quitadas no filtro atual",
      total: totalPagoVisivel,
      contas: visibleContas.filter(c => c.status === "paga"),
      icon: CheckCircle2,
      cardClass: "kpi-card-success",
      iconClass: "status-card-icon-success",
      valueClass: "text-success",
    },
  ];
  const selectedSummary = summaryCards.find(card => card.key === selectedSummaryKey);
  const groupedVisible = (() => {
    if (!cp.agrupar) return null;
    const groups: Record<string, typeof visibleContas> = {};
    visibleContas.forEach(c => {
      if (!groups[c.fornecedor]) groups[c.fornecedor] = [];
      groups[c.fornecedor].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  })();
  const hasVisibleFilters = cp.hasActiveFilters || !!cp.search || !!valorMinimo || !!valorMaximo;

  const applyDateShortcut = (days: number) => {
    const start = new Date(`${cp.hoje}T12:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + days);
    cp.setDataInicial(cp.hoje);
    cp.setDataFinal(end.toISOString().split("T")[0]);
  };

  // Helper: determine display status label / variant
  const getStatus = (conta: ReturnType<typeof useContasPagar>["contas"][0]) => {
    const isVencida = (conta.status === "pendente" || conta.status === "vencida") && conta.vencimento < cp.hoje;
    const label = conta.status === "paga" ? "Paga" : isVencida ? "Vencida" : "Pendente";
    const variant: "default" | "destructive" | "secondary" = label === "Paga" ? "default" : label === "Vencida" ? "destructive" : "secondary";
    return { label, variant };
  };

  const getRowClass = (label: string) => {
    const base = "group border-0 transition-all duration-200 hover:-translate-y-0.5 [&>td]:border-y [&>td]:border-border/60 [&>td]:bg-card [&>td]:py-3 [&>td]:shadow-sm [&>td]:shadow-foreground/5 [&>td:first-child]:rounded-l-lg [&>td:first-child]:border-l [&>td:first-child]:border-l-4 [&>td:last-child]:rounded-r-lg [&>td:last-child]:border-r hover:[&>td]:shadow-md hover:[&>td]:shadow-foreground/10";
    if (label === "Paga") return `${base} [&>td:first-child]:border-l-success hover:[&>td]:bg-success/5`;
    if (label === "Vencida") return `${base} [&>td:first-child]:border-l-destructive hover:[&>td]:bg-destructive/5`;
    return `${base} [&>td:first-child]:border-l-warning hover:[&>td]:bg-warning/5`;
  };

  const runSummaryAction = (action: () => void) => {
    setSelectedSummaryKey(null);
    action();
  };
  const SelectedSummaryIcon = selectedSummary?.icon;

  return (
    <MainLayout>
      <Header title="Contas a Pagar" subtitle="Gerencie todas as contas, parcelamentos e empréstimos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        {/* Hidden file inputs */}
        <input ref={cp.fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={cp.handlePhotoCapture} />
        <input ref={cp.boletoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => cp.handleBoletoCapture(e, false)} />
        <input ref={cp.boletoPdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => cp.handleBoletoCapture(e, true)} />

        <div className="space-y-4 md:space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map(card => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setSelectedSummaryKey(card.key)}
                    className="rounded-xl text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label={`Abrir detalhes de ${card.title}`}
                  >
                    <Card className={`kpi-card ${card.cardClass} h-full transition hover:-translate-y-0.5 hover:shadow-lg`}>
                      <CardContent className="flex items-center gap-3 p-3">
                        <div className={`status-card-icon ${card.iconClass} h-10 w-10`}>
                          <Icon />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-lg font-bold leading-tight ${card.valueClass}`}>
                            R$ {card.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </div>
                          <p className="kpi-label">{card.title}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{card.contas.length} conta{card.contas.length === 1 ? "" : "s"}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
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
                          <SelectContent>{cp.categoriasNomes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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

            <Dialog open={!!selectedSummary} onOpenChange={(open) => !open && setSelectedSummaryKey(null)}>
              <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                {selectedSummary && SelectedSummaryIcon && (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <SelectedSummaryIcon className="h-5 w-5 text-primary" />
                        {selectedSummary.title}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Card className={`kpi-card ${selectedSummary.cardClass}`}>
                          <CardContent className="p-4">
                            <p className="text-xs font-medium uppercase text-muted-foreground">Total</p>
                            <p className={`mt-1 text-2xl font-bold ${selectedSummary.valueClass}`}>
                              R$ {selectedSummary.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="kpi-card">
                          <CardContent className="p-4">
                            <p className="text-xs font-medium uppercase text-muted-foreground">Quantidade</p>
                            <p className="mt-1 text-2xl font-bold">{selectedSummary.contas.length}</p>
                          </CardContent>
                        </Card>
                        <Card className="kpi-card">
                          <CardContent className="p-4">
                            <p className="text-xs font-medium uppercase text-muted-foreground">Contexto</p>
                            <p className="mt-2 text-sm text-muted-foreground">{selectedSummary.subtitle}</p>
                          </CardContent>
                        </Card>
                      </div>

                      {selectedSummary.contas.length === 0 ? (
                        <EmptyState
                          icon={selectedSummary.icon}
                          title="Nenhuma conta neste resumo"
                          description="Quando houver contas neste status, elas aparecem aqui com informacoes e acoes rapidas."
                        />
                      ) : (
                        <div className="space-y-2">
                          {selectedSummary.contas.map(conta => {
                            const { label, variant } = getStatus(conta);
                            return (
                              <div key={conta.id} className="rounded-xl border bg-card p-3 shadow-sm">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant={variant}>{label}</Badge>
                                      {conta.categoria && <Badge variant="outline">{conta.categoria}</Badge>}
                                      <span className="text-xs text-muted-foreground">
                                        Venc. {format(new Date(conta.vencimento + "T12:00:00"), "dd/MM/yyyy")}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="font-semibold leading-snug">{conta.descricao}</p>
                                      <p className="text-sm text-muted-foreground">{conta.fornecedor}</p>
                                    </div>
                                    {conta.observacoes && (
                                      <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                                        {conta.observacoes}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-3 lg:items-end">
                                    <p className="text-xl font-bold">
                                      R$ {Number(conta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {conta.status !== "paga" && (
                                        <Button size="sm" className="gap-2" onClick={() => runSummaryAction(() => cp.openPagarDialog(conta))}>
                                          <DollarSign className="h-4 w-4" />Pagar
                                        </Button>
                                      )}
                                      <Button size="sm" variant="outline" className="gap-2" onClick={() => runSummaryAction(() => cp.handleEdit(conta))}>
                                        <Pencil className="h-4 w-4" />Editar
                                      </Button>
                                      {(conta.boleto_url || conta.boleto_linha_digitavel) && (
                                        <Button size="sm" variant="outline" className="gap-2" onClick={() => runSummaryAction(() => cp.handleViewBoleto(conta))}>
                                          <Eye className="h-4 w-4" />Boleto
                                        </Button>
                                      )}
                                      <Button size="sm" variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={() => runSummaryAction(() => cp.setDeleteId(conta.id))}>
                                        <Trash2 className="h-4 w-4" />Excluir
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            {/* Main table/card list */}
              <Card className="modern-panel">
              <CardHeader className="px-3 sm:px-6">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 border-b pb-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>{visibleContas.length} conta{visibleContas.length === 1 ? "" : "s"} no filtro atual</span>
                    <span className="font-semibold text-foreground">
                      Total em aberto: R$ {totalAbertoVisivel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {hasVisibleFilters && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Filter className="h-3 w-3" /><span>{visibleContas.length} de {cp.contas.length} contas</span>
                      {cp.filtroFornecedor !== "todos" && <Badge variant="secondary" className="text-xs gap-1 py-0">{cp.filtroFornecedor}<button onClick={() => cp.setFiltroFornecedor("todos")}><X className="h-3 w-3" /></button></Badge>}
                      {cp.filtroCategoria !== "todos" && <Badge variant="secondary" className="text-xs gap-1 py-0">{cp.filtroCategoria}<button onClick={() => cp.setFiltroCategoria("todos")}><X className="h-3 w-3" /></button></Badge>}
                      {cp.filtroStatus !== "abertas" && <Badge variant="secondary" className="text-xs gap-1 py-0">{cp.filtroStatus}<button onClick={() => cp.setFiltroStatus("abertas")}><X className="h-3 w-3" /></button></Badge>}
                      {cp.search && <Badge variant="secondary" className="text-xs gap-1 py-0">Busca: {cp.search}<button onClick={() => cp.setSearch("")}><X className="h-3 w-3" /></button></Badge>}
                      {valorMinimo && <Badge variant="secondary" className="text-xs gap-1 py-0">Min: R$ {valorMinimo}<button onClick={() => setValorMinimo("")}><X className="h-3 w-3" /></button></Badge>}
                      {valorMaximo && <Badge variant="secondary" className="text-xs gap-1 py-0">Max: R$ {valorMaximo}<button onClick={() => setValorMaximo("")}><X className="h-3 w-3" /></button></Badge>}
                    </div>
                  )}
                  {cp.selecionadasPagamentoIds.size > 0 && (
                    <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-success sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm font-semibold">
                        {cp.selecionadasPagamentoIds.size} conta{cp.selecionadasPagamentoIds.size > 1 ? "s" : ""} selecionada{cp.selecionadasPagamentoIds.size > 1 ? "s" : ""} · R$ {cp.totalSelecionadoPagamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={cp.clearPagamentoSelection}>Limpar</Button>
                        <Button size="sm" className="gap-2" onClick={cp.openPagarSelecionadasDialog}><DollarSign className="h-4 w-4" />Pagar selecionadas</Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                {cp.loading ? (
                  <p className="text-center py-8 text-muted-foreground">Carregando...</p>
                ) : visibleContas.length === 0 ? (
                  <EmptyState
                    icon={CreditCard}
                    title="Nenhuma conta encontrada"
                    description="Ajuste os filtros ou registre uma nova conta a pagar para controlar seus compromissos."
                    action={{ label: "Nova conta", onClick: () => cp.setDialogOpen(true), icon: Plus }}
                  />
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden table-card-shell sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="rounded-xl border-0 bg-muted/75 hover:bg-muted/75 [&_th]:h-11 [&_th]:border-0 [&_th]:text-[11px] [&_th]:font-extrabold [&_th]:uppercase [&_th]:tracking-[0.02em] [&_th]:text-foreground">
                            <TableHead className="w-10 rounded-l-xl"><Checkbox checked={cp.todasPagaveisSelecionadas} onCheckedChange={cp.toggleAllPagamentoSelection} aria-label="Selecionar contas" /></TableHead><TableHead>Fornecedor</TableHead><TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead><TableHead>Vencimento</TableHead>
                            <TableHead>Valor</TableHead><TableHead>Status</TableHead>
                            <TableHead className="rounded-r-xl text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(cp.agrupar && groupedVisible ? groupedVisible.flatMap(([fornecedor, items]) => {
                            const groupTotal = items.reduce((s, c) => s + Number(c.valor), 0);
                            return [
                              <TableRow key={`grp-${fornecedor}`} className="border-0 [&>td]:border-y [&>td]:border-success/25 [&>td]:bg-success/10 [&>td:first-child]:rounded-l-lg [&>td:first-child]:border-l [&>td:last-child]:rounded-r-lg [&>td:last-child]:border-r">
                                <TableCell colSpan={5} className="font-semibold text-success"><div className="flex items-center gap-2"><Building2 className="h-4 w-4" />{fornecedor}<Badge variant="outline" className="border-success/30 bg-success/10 text-xs text-success">{items.length}</Badge></div></TableCell>
                                <TableCell className="font-bold">R$ {groupTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell colSpan={2} />
                              </TableRow>,
                              ...items.map(conta => {
                                const { label, variant } = getStatus(conta);
                                return (
                                  <TableRow key={conta.id} className={getRowClass(label)}>
                                    <TableCell><Checkbox checked={cp.selecionadasPagamentoIds.has(conta.id)} disabled={conta.status === "paga"} onCheckedChange={() => cp.togglePagamentoSelection(conta.id)} aria-label={`Selecionar ${conta.descricao}`} /></TableCell>
                                    <TableCell className="pl-10 text-muted-foreground text-sm">{conta.fornecedor}</TableCell>
                                    <TableCell>{conta.descricao}</TableCell>
                                    <TableCell><Badge variant="outline">{conta.categoria || "—"}</Badge></TableCell>
                                    <TableCell>{format(new Date(conta.vencimento + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                                    <TableCell className="font-medium">R$ {Number(conta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell><Badge variant={variant}>{label}</Badge></TableCell>
                                    <TableCell className="text-right">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          {conta.status !== "paga" && <DropdownMenuItem onClick={() => cp.openPagarDialog(conta)}><DollarSign className="h-4 w-4 mr-2" />Pagar</DropdownMenuItem>}
                                          <DropdownMenuItem onClick={() => cp.handleEdit(conta)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                                          {(conta.boleto_url || conta.boleto_linha_digitavel) && <DropdownMenuItem onClick={() => cp.handleViewBoleto(conta)}><Eye className="h-4 w-4 mr-2" />Ver Boleto</DropdownMenuItem>}
                                          <DropdownMenuItem className="text-destructive" onClick={() => cp.setDeleteId(conta.id)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            ];
                          }) : visibleContas).map((conta: any) => {
                            if (!conta.id) return conta; // group header row already rendered
                            const { label, variant } = getStatus(conta);
                            return (
                              <TableRow key={conta.id} className={getRowClass(label)}>
                                <TableCell><Checkbox checked={cp.selecionadasPagamentoIds.has(conta.id)} disabled={conta.status === "paga"} onCheckedChange={() => cp.togglePagamentoSelection(conta.id)} aria-label={`Selecionar ${conta.descricao}`} /></TableCell>
                                <TableCell className="font-medium">{conta.fornecedor}</TableCell>
                                <TableCell>{conta.descricao}</TableCell>
                                <TableCell><Badge variant="outline">{conta.categoria || "—"}</Badge></TableCell>
                                <TableCell>{format(new Date(conta.vencimento + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                                <TableCell className="font-medium">R$ {Number(conta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell><Badge variant={variant}>{label}</Badge></TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {conta.status !== "paga" && <DropdownMenuItem onClick={() => cp.openPagarDialog(conta)}><DollarSign className="h-4 w-4 mr-2" />Pagar</DropdownMenuItem>}
                                      <DropdownMenuItem onClick={() => cp.handleEdit(conta)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                                      {(conta.boleto_url || conta.boleto_linha_digitavel) && <DropdownMenuItem onClick={() => cp.handleViewBoleto(conta)}><Eye className="h-4 w-4 mr-2" />Ver Boleto</DropdownMenuItem>}
                                      <DropdownMenuItem className="text-destructive" onClick={() => cp.setDeleteId(conta.id)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile cards */}
                    <div className="space-y-3 sm:hidden">
                      {visibleContas.map(conta => {
                        const { label, variant } = getStatus(conta);
                        return (
                          <div key={conta.id} className="mobile-record-card">
                            <div className="mobile-record-card-header">
                              <Checkbox checked={cp.selecionadasPagamentoIds.has(conta.id)} disabled={conta.status === "paga"} onCheckedChange={() => cp.togglePagamentoSelection(conta.id)} aria-label={`Selecionar ${conta.descricao}`} className="mt-1 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="mobile-record-card-title line-clamp-2">{conta.descricao}</p>
                                <p className="mobile-record-card-meta truncate">{conta.fornecedor}</p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {conta.status !== "paga" && <DropdownMenuItem onClick={() => cp.openPagarDialog(conta)}><DollarSign className="h-4 w-4 mr-2" />Pagar</DropdownMenuItem>}
                                  <DropdownMenuItem onClick={() => cp.handleEdit(conta)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                                  {(conta.boleto_url || conta.boleto_linha_digitavel) && <DropdownMenuItem onClick={() => cp.handleViewBoleto(conta)}><Eye className="h-4 w-4 mr-2" />Ver Boleto</DropdownMenuItem>}
                                  <DropdownMenuItem className="text-destructive" onClick={() => cp.setDeleteId(conta.id)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge variant={variant} className="text-xs">{label}</Badge>
                                {conta.categoria && <Badge variant="outline" className="text-xs">{conta.categoria}</Badge>}
                            </div>
                            <div className="mobile-record-card-footer">
                              <p className="text-xs text-muted-foreground">Venc: {format(new Date(conta.vencimento + "T12:00:00"), "dd/MM/yyyy")}</p>
                              <span className="font-bold text-sm">R$ {Number(conta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        );
                      })}
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
                            <SelectContent>{cp.categoriasNomes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
        <ParcelamentoDialog open={cp.parcelamentoOpen} onOpenChange={cp.setParcelamentoOpen} categorias={[]} onSuccess={cp.fetchContas} />
      </div>
    </MainLayout>
  );
}
