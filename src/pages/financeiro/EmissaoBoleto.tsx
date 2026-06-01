import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Barcode, Plus, Search, Eye, Copy, Printer, Send, CheckCircle2, Clock, XCircle, AlertTriangle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { getBrasiliaDateString } from "@/lib/utils";

const emptyForm = {
  sacado: "", cpf_cnpj: "", endereco: "", valor: "", vencimento: "",
  descricao: "", juros_mes: "2", multa: "2", instrucoes: "",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  aberto: { label: "Aberto", variant: "outline", icon: Clock },
  pago: { label: "Pago", variant: "default", icon: CheckCircle2 },
  vencido: { label: "Vencido", variant: "destructive", icon: AlertTriangle },
  cancelado: { label: "Cancelado", variant: "secondary", icon: XCircle },
};

function gerarLinhaDigitavel(numero: number) {
  const pad = String(numero).padStart(5, "0");
  return `23793.38128 60000.${pad}03 00000.000409 1 9285000${pad}00`;
}

export default function EmissaoBoleto({ embedded }: { embedded?: boolean } = {}) {
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();
  const [tab, setTab] = useState<"emitir" | "consultar">("consultar");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [form, setForm] = useState(emptyForm);
  const [detalheBoleto, setDetalheBoleto] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: boletos = [], isLoading } = useQuery({
    queryKey: ["boletos_emitidos", unidadeAtual?.id],
    queryFn: async () => {
      let q = (supabase as any).from("boletos_emitidos").select("*").order("created_at", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const handleEmitir = async () => {
    if (!form.sacado || !form.cpf_cnpj || !form.valor || !form.vencimento) {
      toast.error("Preencha os campos obrigatórios"); return;
    }
    setSaving(true);
    try {
      const payload = {
        sacado: form.sacado,
        cpf_cnpj: form.cpf_cnpj,
        endereco: form.endereco || null,
        valor: parseFloat(form.valor),
        vencimento: form.vencimento,
        descricao: form.descricao || null,
        juros_mes: parseFloat(form.juros_mes) || 2,
        multa: parseFloat(form.multa) || 2,
        instrucoes: form.instrucoes || null,
        unidade_id: unidadeAtual?.id || null,
      };
      const { data, error } = await (supabase as any).from("boletos_emitidos").insert(payload).select().single();
      if (error) throw error;

      // Generate linha digitável based on numero
      const linha = gerarLinhaDigitavel(data.numero);
      await (supabase as any).from("boletos_emitidos").update({ linha_digitavel: linha }).eq("id", data.id);

      toast.success(`Boleto emitido com sucesso! Nº ${String(data.numero).padStart(5, "0")}`);
      setForm(emptyForm);
      setTab("consultar");
      queryClient.invalidateQueries({ queryKey: ["boletos_emitidos"] });
    } catch (err: any) {
      toast.error("Erro ao emitir boleto: " + (err.message || "erro"));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("boletos_emitidos").update({ status }).eq("id", id);
    if (error) toast.error("Erro ao atualizar status");
    else { toast.success(`Status atualizado para "${status}"`); queryClient.invalidateQueries({ queryKey: ["boletos_emitidos"] }); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await (supabase as any).from("boletos_emitidos").delete().eq("id", deleteId);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Boleto excluído!"); queryClient.invalidateQueries({ queryKey: ["boletos_emitidos"] }); }
    setDeleteId(null);
  };

  const copiarLinha = (linha: string) => {
    navigator.clipboard.writeText(linha || "");
    toast.success("Linha digitável copiada!");
  };

  const hoje = getBrasiliaDateString();
  const filtrados = boletos.filter((b: any) => {
    const matchBusca = b.sacado.toLowerCase().includes(busca.toLowerCase()) || String(b.numero).includes(busca);
    const realStatus = b.status === "aberto" && b.vencimento < hoje ? "vencido" : b.status;
    const matchStatus = filtroStatus === "todos" || realStatus === filtroStatus;
    return matchBusca && matchStatus;
  });

  const totalAberto = boletos.filter((b: any) => b.status === "aberto").reduce((s: number, b: any) => s + Number(b.valor), 0);
  const totalVencido = boletos.filter((b: any) => b.status === "aberto" && b.vencimento < hoje).reduce((s: number, b: any) => s + Number(b.valor), 0);
  const totalPago = boletos.filter((b: any) => b.status === "pago").reduce((s: number, b: any) => s + Number(b.valor), 0);

  const content = (
    <div className="space-y-6 p-4 md:p-6">
        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Total Emitidos</p><p className="text-2xl font-bold">{boletos.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Em Aberto</p><p className="text-2xl font-bold text-primary">R$ {totalAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Vencidos</p><p className="text-2xl font-bold text-destructive">R$ {totalVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Recebidos</p><p className="text-2xl font-bold text-success">R$ {totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent></Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          <Button variant={tab === "consultar" ? "default" : "outline"} onClick={() => setTab("consultar")}><Search className="h-4 w-4 mr-2" />Boletos Emitidos</Button>
          <Button variant={tab === "emitir" ? "default" : "outline"} onClick={() => setTab("emitir")}><Plus className="h-4 w-4 mr-2" />Emitir Boleto</Button>
        </div>

        {tab === "consultar" && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <CardTitle className="flex items-center gap-2"><Barcode className="h-5 w-5 text-primary" />Boletos Emitidos</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Buscar sacado ou nº..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 w-56" />
                  </div>
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="vencido">Vencido</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">Carregando...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead><TableHead>Sacado</TableHead><TableHead>CPF/CNPJ</TableHead>
                      <TableHead className="text-right">Valor</TableHead><TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map((b: any) => {
                      const realStatus = b.status === "aberto" && b.vencimento < hoje ? "vencido" : b.status;
                      const sc = statusConfig[realStatus] || statusConfig.aberto;
                      const StatusIcon = sc.icon;
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-mono text-sm">{String(b.numero).padStart(5, "0")}</TableCell>
                          <TableCell className="font-medium">{b.sacado}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{b.cpf_cnpj}</TableCell>
                          <TableCell className="text-right font-medium">R$ {Number(b.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>{new Date(b.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell><Badge variant={sc.variant} className="gap-1"><StatusIcon className="h-3 w-3" />{sc.label}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => setDetalheBoleto(b)}><Eye className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" title="Copiar linha" onClick={() => copiarLinha(b.linha_digitavel)}><Copy className="h-4 w-4" /></Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {b.status === "aberto" && <DropdownMenuItem onClick={() => handleStatusChange(b.id, "pago")}><CheckCircle2 className="h-4 w-4 mr-2" />Marcar como Pago</DropdownMenuItem>}
                                  {b.status === "aberto" && <DropdownMenuItem onClick={() => handleStatusChange(b.id, "cancelado")}><XCircle className="h-4 w-4 mr-2" />Cancelar</DropdownMenuItem>}
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(b.id)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-4">
                          <EmptyState
                            compact
                            icon={Barcode}
                            title="Nenhum boleto encontrado"
                            description="Ajuste a busca ou emita um novo boleto para acompanhar cobranças."
                            action={{ label: "Emitir boleto", onClick: () => setTab("emitir"), icon: Plus }}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "emitir" && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Barcode className="h-5 w-5 text-primary" />Emitir Novo Boleto</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Dados do Sacado (Pagador)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Nome / Razão Social *</Label><Input value={form.sacado} onChange={(e) => setForm({ ...form, sacado: e.target.value })} placeholder="Nome completo ou razão social" /></div>
                  <div className="space-y-2"><Label>CPF / CNPJ *</Label><Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} placeholder="000.000.000-00 ou 00.000.000/0001-00" /></div>
                  <div className="md:col-span-2 space-y-2"><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, nº, bairro, cidade - UF" /></div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Dados do Boleto</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Valor (R$) *</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" /></div>
                  <div className="space-y-2"><Label>Vencimento *</Label><Input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Venda de 50 botijões P13" /></div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Juros e Multa por Atraso</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Juros ao mês (%)</Label><Input type="number" step="0.1" value={form.juros_mes} onChange={(e) => setForm({ ...form, juros_mes: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Multa (%)</Label><Input type="number" step="0.1" value={form.multa} onChange={(e) => setForm({ ...form, multa: e.target.value })} /></div>
                </div>
              </div>
              <div className="space-y-2"><Label>Instruções ao caixa / banco</Label><Textarea value={form.instrucoes} onChange={(e) => setForm({ ...form, instrucoes: e.target.value })} placeholder="Ex: Não aceitar após 30 dias do vencimento" rows={2} /></div>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleEmitir} disabled={saving}><Barcode className="h-4 w-4 mr-2" />{saving ? "Emitindo..." : "Emitir Boleto"}</Button>
                <Button variant="outline" onClick={() => setTab("consultar")}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialog de detalhes */}
        <Dialog open={!!detalheBoleto} onOpenChange={() => setDetalheBoleto(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Detalhes do Boleto #{detalheBoleto && String(detalheBoleto.numero).padStart(5, "0")}</DialogTitle></DialogHeader>
            {detalheBoleto && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Sacado:</span><p className="font-medium">{detalheBoleto.sacado}</p></div>
                  <div><span className="text-muted-foreground">CPF/CNPJ:</span><p className="font-medium">{detalheBoleto.cpf_cnpj}</p></div>
                  <div><span className="text-muted-foreground">Valor:</span><p className="font-medium">R$ {Number(detalheBoleto.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div>
                  <div><span className="text-muted-foreground">Vencimento:</span><p className="font-medium">{new Date(detalheBoleto.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</p></div>
                  <div><span className="text-muted-foreground">Emissão:</span><p className="font-medium">{new Date(detalheBoleto.emissao + "T12:00:00").toLocaleDateString("pt-BR")}</p></div>
                  <div><span className="text-muted-foreground">Status:</span>
                    {(() => { const s = statusConfig[detalheBoleto.status] || statusConfig.aberto; return <Badge variant={s.variant} className="mt-1">{s.label}</Badge>; })()}
                  </div>
                </div>
                {detalheBoleto.descricao && <div><span className="text-sm text-muted-foreground">Descrição:</span><p className="text-sm">{detalheBoleto.descricao}</p></div>}
                {detalheBoleto.linha_digitavel && (
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Linha Digitável:</span>
                    <div className="flex items-center gap-2 bg-muted p-3 rounded-lg">
                      <code className="text-xs flex-1 break-all">{detalheBoleto.linha_digitavel}</code>
                      <Button variant="ghost" size="icon" onClick={() => copiarLinha(detalheBoleto.linha_digitavel)}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button className="flex-1" variant="outline" onClick={() => toast.success("Imprimindo boleto...")}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
                  <Button className="flex-1" onClick={() => toast.success("Boleto enviado por e-mail!")}><Send className="h-4 w-4 mr-2" />Enviar por E-mail</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir boleto?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Emissão de Boletos" subtitle="Gestão Financeira" />
      {content}
    </MainLayout>
  );
}
