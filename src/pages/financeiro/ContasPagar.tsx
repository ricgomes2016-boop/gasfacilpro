import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Pencil, Trash2, DollarSign, Download, Camera, Loader2, Layers, ChevronRight,
  Building2, Filter, X, Mic, MicOff, AudioLines, FileText, Eye, FileUp, CalendarRange,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParcelamentoDialog } from "@/components/financeiro/ParcelamentoDialog";
import { CompromissosFuturos } from "@/components/financeiro/CompromissosFuturos";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { useContasPagar, FORMAS_PAGAMENTO } from "@/hooks/useContasPagar";

export default function ContasPagar() {
  const cp = useContasPagar();

  // Helper: determine display status label / variant
  const getStatus = (conta: ReturnType<typeof useContasPagar>["contas"][0]) => {
    const isVencida = (conta.status === "pendente" || conta.status === "vencida") && conta.vencimento < cp.hoje;
    const label = conta.status === "paga" ? "Paga" : isVencida ? "Vencida" : "Pendente";
    const variant: "default" | "destructive" | "secondary" = label === "Paga" ? "default" : label === "Vencida" ? "destructive" : "secondary";
    return { label, variant };
  };

  return (
    <MainLayout>
      <Header title="Contas a Pagar" subtitle="Gerencie todas as contas, parcelamentos e empréstimos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        {/* Hidden file inputs */}
        <input ref={cp.fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={cp.handlePhotoCapture} />
        <input ref={cp.boletoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => cp.handleBoletoCapture(e, false)} />
        <input ref={cp.boletoPdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => cp.handleBoletoCapture(e, true)} />

        <Tabs defaultValue="contas">
          <TabsList>
            <TabsTrigger value="contas"><CreditCard className="h-4 w-4 mr-1" />Contas</TabsTrigger>
            <TabsTrigger value="compromissos"><CalendarRange className="h-4 w-4 mr-1" />Compromissos Futuros</TabsTrigger>
          </TabsList>

          <TabsContent value="contas" className="mt-4 space-y-4 md:space-y-6">
            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Dialog open={cp.dialogOpen} onOpenChange={(open) => { cp.setDialogOpen(open); if (!open) { cp.setEditId(null); cp.resetForm(); } }}>
                <DialogTrigger asChild>
                  <Button className="gap-2 flex-1 sm:flex-none"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Nova Conta</span><span className="sm:hidden">Nova</span></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{cp.editId ? "Editar Conta" : "Nova Conta a Pagar"}</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div><Label>Fornecedor *</Label><Input value={cp.form.fornecedor} onChange={e => cp.setForm({ ...cp.form, fornecedor: e.target.value })} /></div>
                    <div><Label>Descrição *</Label><Input value={cp.form.descricao} onChange={e => cp.setForm({ ...cp.form, descricao: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Valor *</Label><Input type="number" step="0.01" value={cp.form.valor} onChange={e => cp.setForm({ ...cp.form, valor: e.target.value })} /></div>
                      <div><Label>Vencimento *</Label><Input type="date" value={cp.form.vencimento} onChange={e => cp.setForm({ ...cp.form, vencimento: e.target.value })} /></div>
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select value={cp.form.categoria} onValueChange={v => cp.setForm({ ...cp.form, categoria: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{cp.categoriasNomes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Observações</Label><Textarea value={cp.form.observacoes} onChange={e => cp.setForm({ ...cp.form, observacoes: e.target.value })} rows={2} /></div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => { cp.setDialogOpen(false); cp.setEditId(null); cp.resetForm(); }}>Cancelar</Button>
                      <Button onClick={cp.handleSubmit}>{cp.editId ? "Atualizar" : "Salvar"}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => cp.fileInputRef.current?.click()}>
                <Camera className="h-4 w-4" /><span className="hidden sm:inline">Foto com IA</span><span className="sm:hidden">Foto IA</span>
              </Button>
              <Button variant={cp.voiceListening ? "destructive" : "outline"} className="gap-2 flex-1 sm:flex-none" onClick={cp.voiceListening ? cp.stopVoiceListening : cp.startVoiceListening}>
                {cp.voiceListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span className="hidden sm:inline">{cp.voiceListening ? "Parar" : "Voz"}</span><span className="sm:hidden">{cp.voiceListening ? "Parar" : "Voz"}</span>
              </Button>
              <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => cp.boletoInputRef.current?.click()}>
                <FileText className="h-4 w-4" /><span className="hidden sm:inline">Ler Boleto</span><span className="sm:hidden">Boleto</span>
              </Button>
              <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => cp.boletoPdfInputRef.current?.click()}>
                <FileUp className="h-4 w-4" /><span className="hidden sm:inline">Importar PDF</span><span className="sm:hidden">PDF</span>
              </Button>
              {cp.fornecedoresComMultiplas.length > 0 && (
                <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={cp.openUnificarDialog}>
                  <Layers className="h-4 w-4" /><span className="hidden sm:inline">Unificar Fornecedor</span><span className="sm:hidden">Unificar</span>
                </Button>
              )}
              <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => cp.setParcelamentoOpen(true)}>
                <CalendarRange className="h-4 w-4" /><span className="hidden sm:inline">Parcelar / Empréstimo</span><span className="sm:hidden">Parcelar</span>
              </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs sm:text-sm font-medium">Total a Pagar</CardTitle><CreditCard className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold">R$ {cp.totalAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><p className="text-xs text-muted-foreground hidden sm:block">Em aberto</p></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs sm:text-sm font-medium">Vencidas</CardTitle><AlertCircle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold text-destructive">R$ {cp.totalVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><p className="text-xs text-muted-foreground hidden sm:block">Atenção urgente</p></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs sm:text-sm font-medium">Pendentes</CardTitle><Clock className="h-4 w-4 text-warning" /></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold text-warning">R$ {cp.totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><p className="text-xs text-muted-foreground hidden sm:block">A vencer</p></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-xs sm:text-sm font-medium">Pagas</CardTitle><CheckCircle2 className="h-4 w-4 text-success" /></CardHeader><CardContent><div className="text-lg sm:text-2xl font-bold text-success">R$ {cp.totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><p className="text-xs text-muted-foreground hidden sm:block">Quitadas</p></CardContent></Card>
            </div>

            {/* Resumo por Fornecedor */}
            {cp.resumoPorFornecedor.length > 0 && (
              <Collapsible open={cp.resumoOpen} onOpenChange={cp.setResumoOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <CardTitle className="text-sm">Resumo por Fornecedor</CardTitle>
                          <Badge variant="secondary" className="text-xs">{cp.resumoPorFornecedor.length}</Badge>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${cp.resumoOpen ? "rotate-90" : ""}`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {cp.resumoPorFornecedor.map(item => {
                          const percent = cp.totalAberto > 0 ? (item.total / cp.totalAberto) * 100 : 0;
                          return (
                            <button key={item.fornecedor} className="w-full text-left" onClick={() => { cp.setFiltroFornecedor(item.fornecedor); cp.setFiltroStatus("todos"); cp.setResumoOpen(false); }}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{item.fornecedor}</span>
                                  <span className="text-xs text-muted-foreground">{item.count} conta{item.count > 1 ? "s" : ""}</span>
                                  {item.vencidas > 0 && <Badge variant="destructive" className="text-xs py-0">{item.vencidas} vencida{item.vencidas > 1 ? "s" : ""}</Badge>}
                                </div>
                                <span className="text-sm font-bold">R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              </div>
                              <Progress value={percent} className="h-1.5" />
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Main table/card list */}
            <Card>
              <CardHeader className="px-3 sm:px-6">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle className="text-base sm:text-lg">Lista de Contas</CardTitle>
                    <div className="relative w-full sm:w-auto">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Buscar conta..." className="pl-10 w-full sm:w-[250px]" value={cp.search} onChange={e => cp.setSearch(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2 sm:gap-3">
                    <div className="col-span-1">
                      <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                      <Select value={cp.filtroFornecedor} onValueChange={cp.setFiltroFornecedor}>
                        <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="todos">Todos</SelectItem>{cp.fornecedoresUnicos.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs text-muted-foreground">Categoria</Label>
                      <Select value={cp.filtroCategoria} onValueChange={cp.setFiltroCategoria}>
                        <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="todos">Todas</SelectItem>{cp.categoriasUnicas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select value={cp.filtroStatus} onValueChange={cp.setFiltroStatus}>
                        <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          <SelectItem value="pendente">Pendentes</SelectItem>
                          <SelectItem value="vencida">Vencidas</SelectItem>
                          <SelectItem value="paga">Pagas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 flex items-end gap-2">
                      <div className="flex items-center gap-2 h-10">
                        <Checkbox id="agrupar" checked={cp.agrupar} onCheckedChange={(v) => cp.setAgrupar(!!v)} />
                        <Label htmlFor="agrupar" className="text-xs cursor-pointer">Agrupar</Label>
                      </div>
                      {cp.hasActiveFilters && <Button variant="ghost" size="sm" className="gap-1 text-xs h-10" onClick={cp.clearAllFilters}><X className="h-3 w-3" />Limpar</Button>}
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs text-muted-foreground">De</Label>
                      <Input type="date" className="w-full sm:w-[145px]" value={cp.dataInicial} onChange={e => cp.setDataInicial(e.target.value)} />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs text-muted-foreground">Até</Label>
                      <Input type="date" className="w-full sm:w-[145px]" value={cp.dataFinal} onChange={e => cp.setDataFinal(e.target.value)} />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex gap-2 sm:ml-auto">
                      <Button variant="outline" size="sm" onClick={cp.exportToExcel} className="gap-2 flex-1 sm:flex-none"><Download className="h-4 w-4" /><span className="hidden sm:inline">Excel</span><span className="sm:hidden">XLS</span></Button>
                      <Button variant="outline" size="sm" onClick={cp.exportToPDF} className="gap-2 flex-1 sm:flex-none"><Download className="h-4 w-4" />PDF</Button>
                    </div>
                  </div>
                  {cp.hasActiveFilters && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Filter className="h-3 w-3" /><span>{cp.filtered.length} de {cp.contas.length} contas</span>
                      {cp.filtroFornecedor !== "todos" && <Badge variant="secondary" className="text-xs gap-1 py-0">{cp.filtroFornecedor}<button onClick={() => cp.setFiltroFornecedor("todos")}><X className="h-3 w-3" /></button></Badge>}
                      {cp.filtroCategoria !== "todos" && <Badge variant="secondary" className="text-xs gap-1 py-0">{cp.filtroCategoria}<button onClick={() => cp.setFiltroCategoria("todos")}><X className="h-3 w-3" /></button></Badge>}
                      {cp.filtroStatus !== "todos" && <Badge variant="secondary" className="text-xs gap-1 py-0">{cp.filtroStatus}<button onClick={() => cp.setFiltroStatus("todos")}><X className="h-3 w-3" /></button></Badge>}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                {cp.loading ? (
                  <p className="text-center py-8 text-muted-foreground">Carregando...</p>
                ) : cp.filtered.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada</p>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fornecedor</TableHead><TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead><TableHead>Vencimento</TableHead>
                            <TableHead>Valor</TableHead><TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(cp.agrupar && cp.groupedFiltered ? cp.groupedFiltered.flatMap(([fornecedor, items]) => {
                            const groupTotal = items.reduce((s, c) => s + Number(c.valor), 0);
                            return [
                              <TableRow key={`grp-${fornecedor}`} className="bg-muted/40 hover:bg-muted/60">
                                <TableCell colSpan={4} className="font-semibold"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{fornecedor}<Badge variant="outline" className="text-xs">{items.length}</Badge></div></TableCell>
                                <TableCell className="font-bold">R$ {groupTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell colSpan={2} />
                              </TableRow>,
                              ...items.map(conta => {
                                const { label, variant } = getStatus(conta);
                                return (
                                  <TableRow key={conta.id}>
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
                          }) : cp.filtered).map((conta: any) => {
                            if (!conta.id) return conta; // group header row already rendered
                            const { label, variant } = getStatus(conta);
                            return (
                              <TableRow key={conta.id}>
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
                    <div className="sm:hidden space-y-3">
                      {cp.filtered.map(conta => {
                        const { label, variant } = getStatus(conta);
                        return (
                          <div key={conta.id} className="border rounded-lg p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{conta.descricao}</p>
                                <p className="text-xs text-muted-foreground">{conta.fornecedor}</p>
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
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                <Badge variant={variant} className="text-xs">{label}</Badge>
                                {conta.categoria && <Badge variant="outline" className="text-xs">{conta.categoria}</Badge>}
                              </div>
                              <span className="font-bold text-sm">R$ {Number(conta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Venc: {format(new Date(conta.vencimento + "T12:00:00"), "dd/MM/yyyy")}</p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compromissos" className="mt-4">
            <CompromissosFuturos />
          </TabsContent>
        </Tabs>

        {/* ===== DIALOGS ===== */}

        {/* Pagar */}
        <Dialog open={cp.pagarDialogOpen} onOpenChange={cp.setPagarDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Pagar Conta</DialogTitle></DialogHeader>
            {cp.pagarConta && (
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-sm font-medium">{cp.pagarConta.fornecedor}</p>
                  <p className="text-xs text-muted-foreground">{cp.pagarConta.descricao}</p>
                  <p className="text-lg font-bold">R$ {Number(cp.pagarConta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Formas de Pagamento</Label>
                    <Button type="button" variant="outline" size="sm" onClick={cp.addFormaPagamento}>+ Forma</Button>
                  </div>
                  {cp.pagarForm.formasPagamento.map((fp, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Select value={fp.forma} onValueChange={v => cp.updateFormaPagamento(idx, "forma", v)}>
                          <SelectTrigger><SelectValue placeholder="Forma" /></SelectTrigger>
                          <SelectContent>{FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="w-[120px]">
                        <Input type="number" step="0.01" placeholder="Valor" value={fp.valor} onChange={e => cp.updateFormaPagamento(idx, "valor", e.target.value)} />
                      </div>
                      {cp.pagarForm.formasPagamento.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => cp.removeFormaPagamento(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
                  <Button variant="outline" onClick={cp.startVoiceListening} disabled={cp.voiceProcessing}><Mic className="h-4 w-4 mr-2" /> Gravar novamente</Button>
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
