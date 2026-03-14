import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileText, Plus, AlertTriangle, CheckCircle2, Clock, XCircle, RotateCcw, Pencil, Camera, Search, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { parseLocalDate, getBrasiliaDateString } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, isBefore, addDays } from "date-fns";

interface ChequeForm {
  numero_cheque: string;
  banco_emitente: string;
  agencia: string;
  conta: string;
  valor: string;
  data_emissao: string;
  data_vencimento: string;
  observacoes: string;
  cliente_id: string | null;
  foto_url: string | null;
}

const emptyForm: ChequeForm = {
  numero_cheque: "", banco_emitente: "", agencia: "", conta: "",
  valor: "", data_emissao: getBrasiliaDateString(),
  data_vencimento: "", observacoes: "", cliente_id: null, foto_url: null,
};

export default function ControleCheques() {
  const { unidadeAtual } = useUnidade();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [form, setForm] = useState<ChequeForm>({ ...emptyForm });
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteResults, setClienteResults] = useState<any[]>([]);
  const [clienteNome, setClienteNome] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { data: cheques = [], isLoading } = useQuery({
    queryKey: ["cheques", unidadeAtual?.id, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("cheques")
        .select("*, clientes(id, nome), unidades(nome)")
        .order("data_vencimento", { ascending: true });
      if (unidadeAtual?.id) query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      if (statusFilter !== "todos") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const buscarCliente = async (termo: string) => {
    setClienteSearch(termo);
    if (termo.length < 2) { setClienteResults([]); return; }
    const { data } = await supabase
      .from("clientes")
      .select("id, nome, telefone, cpf")
      .or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%,cpf.ilike.%${termo}%`)
      .limit(8);
    setClienteResults(data || []);
  };

  const selecionarCliente = (cliente: any) => {
    setForm({ ...form, cliente_id: cliente.id });
    setClienteNome(cliente.nome);
    setClienteSearch("");
    setClienteResults([]);
  };

  const compressAndUpload = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement("canvas");
          const maxW = 1200;
          const scale = Math.min(1, maxW / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(async (blob) => {
            if (!blob) { reject("Erro ao comprimir"); return; }
            const fileName = `cheques/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
            const { error } = await supabase.storage.from("product-images").upload(fileName, blob, { cacheControl: "3600" });
            if (error) { reject(error.message); return; }
            const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
            resolve(urlData.publicUrl);
          }, "image/jpeg", 0.8);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFoto = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await compressAndUpload(file);
      setForm(prev => ({ ...prev, foto_url: url }));
      setFotoPreview(url);
      toast.success("Foto enviada! Extraindo dados...");

      // OCR auto-fill
      try {
        const { data: ocrData, error: ocrError } = await supabase.functions.invoke("parse-cheque-photo", {
          body: { image_url: url },
        });
        if (!ocrError && ocrData?.success && ocrData.data) {
          const d = ocrData.data;
          setForm(prev => ({
            ...prev,
            numero_cheque: d.numero_cheque || prev.numero_cheque,
            banco_emitente: d.banco_emitente || prev.banco_emitente,
            agencia: d.agencia || prev.agencia,
            conta: d.conta || prev.conta,
            valor: d.valor ? String(d.valor).replace(".", ",") : prev.valor,
            data_emissao: d.data_emissao || prev.data_emissao,
            data_vencimento: d.data_vencimento || prev.data_vencimento,
          }));
          toast.success("Dados do cheque preenchidos automaticamente!");
        } else {
          toast.info("Não foi possível extrair dados automaticamente. Preencha manualmente.");
        }
      } catch {
        toast.info("OCR indisponível. Preencha manualmente.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar foto");
    } finally {
      setIsUploading(false);
    }
  };

  const openEdit = (cheque: any) => {
    setEditingId(cheque.id);
    setForm({
      numero_cheque: cheque.numero_cheque,
      banco_emitente: cheque.banco_emitente,
      agencia: cheque.agencia || "",
      conta: cheque.conta || "",
      valor: String(cheque.valor),
      data_emissao: cheque.data_emissao,
      data_vencimento: cheque.data_vencimento,
      observacoes: cheque.observacoes || "",
      cliente_id: cheque.cliente_id || null,
      foto_url: (cheque as any).foto_url || null,
    });
    setClienteNome(cheque.clientes?.nome || "");
    setFotoPreview((cheque as any).foto_url || null);
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setClienteNome("");
    setFotoPreview(null);
    setDialogOpen(true);
  };

  const salvarCheque = async () => {
    const valor = parseFloat(form.valor.replace(",", "."));
    if (!form.numero_cheque || !form.banco_emitente || !valor || !form.data_vencimento) {
      toast.error("Preencha os campos obrigatórios"); return;
    }

    const payload: any = {
      numero_cheque: form.numero_cheque, banco_emitente: form.banco_emitente,
      agencia: form.agencia || null, conta: form.conta || null, valor,
      data_emissao: form.data_emissao, data_vencimento: form.data_vencimento,
      observacoes: form.observacoes || null, cliente_id: form.cliente_id || null,
      foto_url: form.foto_url || null,
    };

    if (editingId) {
      const { error } = await supabase.from("cheques").update(payload).eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar"); console.error(error); return; }
      toast.success("Cheque atualizado!");
    } else {
      payload.unidade_id = unidadeAtual?.id || null;
      payload.user_id = user?.id;
      const { error } = await supabase.from("cheques").insert(payload);
      if (error) { toast.error("Erro ao cadastrar"); console.error(error); return; }
      toast.success("Cheque cadastrado!");
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setClienteNome("");
    setFotoPreview(null);
    queryClient.invalidateQueries({ queryKey: ["cheques"] });
  };

  const atualizarStatus = async (id: string, novoStatus: string) => {
    const updates: any = { status: novoStatus };
    if (novoStatus === "compensado") updates.data_compensacao = getBrasiliaDateString();
    const { error } = await supabase.from("cheques").update(updates).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(`Cheque marcado como ${novoStatus}`);
    queryClient.invalidateQueries({ queryKey: ["cheques"] });
  };

  const excluirCheque = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cheque? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("cheques").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir cheque"); console.error(error); return; }
    toast.success("Cheque excluído com sucesso");
    queryClient.invalidateQueries({ queryKey: ["cheques"] });
  };

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
    em_maos: { label: "Em Mãos", variant: "outline", icon: Clock },
    depositado: { label: "Depositado", variant: "secondary", icon: FileText },
    compensado: { label: "Compensado", variant: "default", icon: CheckCircle2 },
    devolvido: { label: "Devolvido", variant: "destructive", icon: XCircle },
    reapresentado: { label: "Reapresentado", variant: "secondary", icon: RotateCcw },
  };

  const totalEmMaos = cheques.filter((c: any) => c.status === "em_maos").reduce((a: number, c: any) => a + Number(c.valor), 0);
  const totalVencendo = cheques.filter((c: any) => c.status === "em_maos" && isBefore(parseLocalDate(c.data_vencimento), addDays(new Date(), 7))).length;
  const totalDevolvidos = cheques.filter((c: any) => c.status === "devolvido").reduce((a: number, c: any) => a + Number(c.valor), 0);

  return (
    <MainLayout>
      <Header title="Controle de Cheques" subtitle="Gestão e acompanhamento de cheques recebidos" />
      <div className="p-4 md:p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" />Em Mãos</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">R$ {totalEmMaos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">{cheques.filter((c: any) => c.status === "em_maos").length} cheques</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />Vencendo em 7 dias</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-warning">{totalVencendo}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" />Devolvidos</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-destructive">R$ {totalDevolvidos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap items-center">
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Cadastrar Cheque</Button>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="em_maos">Em Mãos</SelectItem>
              <SelectItem value="depositado">Depositados</SelectItem>
              <SelectItem value="compensado">Compensados</SelectItem>
              <SelectItem value="devolvido">Devolvidos</SelectItem>
              <SelectItem value="reapresentado">Reapresentados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Dialog Novo/Editar */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Editar Cheque" : "Novo Cheque"}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              {/* Foto do cheque - acima do cliente */}
              <div>
                <Label>Foto do Cheque (preenche campos automaticamente)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    if (cameraInputRef.current) {
                      cameraInputRef.current.value = "";
                      cameraInputRef.current.click();
                    }
                  }} disabled={isUploading}>
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Camera className="h-4 w-4 mr-1" />}
                    Tirar Foto
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    if (photoInputRef.current) {
                      photoInputRef.current.value = "";
                      photoInputRef.current.click();
                    }
                  }} disabled={isUploading}>
                    <ImageIcon className="h-4 w-4 mr-1" />
                    Galeria
                  </Button>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFoto(f); }}
                  />
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFoto(f); }}
                  />
                </div>
                {fotoPreview && (
                  <div className="relative mt-2 inline-block">
                    <img src={fotoPreview} alt="Foto do cheque" className="h-32 rounded-lg border object-cover" />
                    <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => { setForm({ ...form, foto_url: null }); setFotoPreview(null); }}>
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Busca de cliente */}
              <div>
                <Label>Cliente</Label>
                {clienteNome ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-sm">{clienteNome}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => { setForm({ ...form, cliente_id: null }); setClienteNome(""); }}>
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, telefone ou CPF..."
                      value={clienteSearch}
                      onChange={(e) => buscarCliente(e.target.value)}
                      className="pl-9"
                    />
                    {clienteResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {clienteResults.map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between"
                            onClick={() => selecionarCliente(c)}
                          >
                            <span className="font-medium">{c.nome}</span>
                            <span className="text-muted-foreground text-xs">{c.telefone || c.cpf || ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nº Cheque *</Label><Input value={form.numero_cheque} onChange={e => setForm({ ...form, numero_cheque: e.target.value })} /></div>
                <div><Label>Banco *</Label><Input value={form.banco_emitente} onChange={e => setForm({ ...form, banco_emitente: e.target.value })} placeholder="Itaú, BB..." /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Agência</Label><Input value={form.agencia} onChange={e => setForm({ ...form, agencia: e.target.value })} /></div>
                <div><Label>Conta</Label><Input value={form.conta} onChange={e => setForm({ ...form, conta: e.target.value })} /></div>
              </div>
              <div><Label>Valor *</Label><Input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="0,00" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data Emissão</Label><Input type="date" value={form.data_emissao} onChange={e => setForm({ ...form, data_emissao: e.target.value })} /></div>
                <div><Label>Data Vencimento *</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} /></div>
              </div>

              <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={salvarCheque}>{editingId ? "Atualizar" : "Salvar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-center py-6 text-muted-foreground">Carregando...</p> : cheques.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">Nenhum cheque encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Cheque</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Foto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cheques.map((c: any) => {
                      const cfg = statusConfig[c.status] || statusConfig.em_maos;
                      const vencido = c.status === "em_maos" && isBefore(parseLocalDate(c.data_vencimento), new Date());
                      return (
                        <TableRow key={c.id} className={vencido ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono font-medium">{c.numero_cheque}</TableCell>
                          <TableCell>{c.banco_emitente}</TableCell>
                          <TableCell className="text-sm">{c.clientes?.nome || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="font-bold">R$ {Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-sm">{format(parseLocalDate(c.data_emissao), "dd/MM/yyyy")}</TableCell>
                          <TableCell className={`text-sm ${vencido ? "text-destructive font-medium" : ""}`}>
                            {format(parseLocalDate(c.data_vencimento), "dd/MM/yyyy")}
                            {vencido && <span className="ml-1 text-xs">(vencido)</span>}
                          </TableCell>
                          <TableCell>
                            {c.foto_url ? (
                              <a href={c.foto_url} target="_blank" rel="noopener noreferrer">
                                <img src={c.foto_url} alt="Cheque" className="h-8 w-12 object-cover rounded border hover:opacity-80 transition-opacity" />
                              </a>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              <Button size="sm" variant="ghost" onClick={() => openEdit(c)} title="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {c.status === "em_maos" && (
                                <Button size="sm" variant="outline" onClick={() => atualizarStatus(c.id, "depositado")}>Depositar</Button>
                              )}
                              {c.status === "depositado" && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => atualizarStatus(c.id, "compensado")}>Compensar</Button>
                                  <Button size="sm" variant="destructive" onClick={() => atualizarStatus(c.id, "devolvido")}>Devolvido</Button>
                                </>
                              )}
                              {c.status === "devolvido" && (
                                <Button size="sm" variant="outline" onClick={() => atualizarStatus(c.id, "reapresentado")}>Reapresentar</Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
