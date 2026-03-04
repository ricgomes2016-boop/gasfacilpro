import { useEffect, useState, useRef } from "react";
import { parseLocalDate, getBrasiliaDateString } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Wrench, Plus, Search, AlertTriangle, CheckCircle2, Clock, DollarSign,
  Loader2, Camera, FileText, FileCheck, Receipt, Edit, Trash2, Bell
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

interface Veiculo {
  id: string;
  placa: string;
  modelo?: string;
}

interface AlertaPreventivo {
  veiculo_placa: string;
  veiculo_modelo: string;
  dias_desde_ultima: number;
  tipo: "tempo" | "sem_preventiva";
  mensagem: string;
}

export default function Manutencao() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [manutencoes, setManutencoes] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    veiculo_id: "",
    descricao: "",
    tipo: "Preventiva",
    oficina: "",
    valor: "",
    data: getBrasiliaDateString(),
    status: "Agendada",
    observacoes: "",
  });

  // OCR
  const [isScanning, setIsScanning] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Edit
  const [editId, setEditId] = useState<string | null>(null);

  // Acerto / Contas a Pagar
  const [showAcerto, setShowAcerto] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gerando, setGerando] = useState(false);

  // Alertas preventivos
  const [alertas, setAlertas] = useState<AlertaPreventivo[]>([]);

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const compressImage = (file: File, maxWidth = 1600): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ratio = Math.min(maxWidth / img.width, 1);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject("Canvas error");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const applyOcrData = (data: any) => {
    setForm((prev) => ({
      ...prev,
      descricao: data.descricao || prev.descricao,
      tipo: data.tipo || prev.tipo,
      oficina: data.oficina || prev.oficina,
      valor: data.valor != null ? String(data.valor) : prev.valor,
      data: data.data || prev.data,
    }));
    toast.success("Dados extraídos! Confira e complete.");
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoInputRef.current) photoInputRef.current.value = "";

    setIsScanning(true);
    try {
      const imageBase64 = await compressImage(file);
      const { data, error } = await supabase.functions.invoke("parse-maintenance-photo", {
        body: { imageBase64 },
      });
      if (error) throw error;
      applyOcrData(data);
    } catch (err: any) {
      console.error("OCR error:", err);
      toast.error(err.message || "Erro ao ler foto. Tente novamente.");
    } finally {
      setIsScanning(false);
    }
  };

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pdfInputRef.current) pdfInputRef.current.value = "";

    // For PDFs, convert first page to image-like base64 and send to same endpoint
    setIsScanning(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("parse-maintenance-photo", {
        body: { imageBase64: base64 },
      });
      if (error) throw error;
      applyOcrData(data);
    } catch (err: any) {
      console.error("PDF import error:", err);
      toast.error(err.message || "Erro ao importar PDF. Tente novamente.");
    } finally {
      setIsScanning(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let mq = supabase.from("manutencoes").select("*, veiculos(placa, modelo)").order("data", { ascending: false });
      if (unidadeAtual?.id) mq = mq.eq("unidade_id", unidadeAtual.id);
      const { data } = await mq;
      setManutencoes(data || []);

      const { data: veiculosData } = await supabase.from("veiculos").select("id, placa, modelo").eq("ativo", true).order("placa");
      setVeiculos(veiculosData || []);

      // Calcular alertas preventivos
      calcularAlertas(data || [], veiculosData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const calcularAlertas = (mans: any[], veics: Veiculo[]) => {
    const hoje = new Date();
    const novosAlertas: AlertaPreventivo[] = [];

    for (const v of veics) {
      const preventivas = mans
        .filter(m => m.veiculo_id === v.id && m.tipo === "Preventiva")
        .sort((a, b) => parseLocalDate(b.data).getTime() - parseLocalDate(a.data).getTime());

      if (preventivas.length === 0) {
        novosAlertas.push({
          veiculo_placa: v.placa,
          veiculo_modelo: v.modelo || "",
          dias_desde_ultima: -1,
          tipo: "sem_preventiva",
          mensagem: `${v.placa} nunca teve manutenção preventiva registrada`,
        });
      } else {
        const ultima = new Date(preventivas[0].data);
        const dias = Math.floor((hoje.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
        if (dias >= 90) {
          novosAlertas.push({
            veiculo_placa: v.placa,
            veiculo_modelo: v.modelo || "",
            dias_desde_ultima: dias,
            tipo: "tempo",
            mensagem: `${v.placa} — última preventiva há ${dias} dias`,
          });
        }
      }
    }
    setAlertas(novosAlertas);
  };

  const agendadas = manutencoes.filter(m => m.status === "Agendada").length;
  const emAndamento = manutencoes.filter(m => m.status === "Em andamento").length;
  const concluidas = manutencoes.filter(m => m.status === "Concluída").length;
  const gastoTotal = manutencoes.reduce((s, m) => s + Number(m.valor), 0);
  const pendentesAcerto = manutencoes.filter(m => m.status === "Concluída");

  const filtered = manutencoes.filter(m => {
    const matchBusca = !busca ||
      (m.veiculos as any)?.placa?.toLowerCase().includes(busca.toLowerCase()) ||
      m.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
      m.oficina?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "todos" || m.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const handleSave = async () => {
    if (!form.veiculo_id || !form.descricao || !form.oficina || !form.valor) {
      toast.error("Preencha veículo, descrição, oficina e valor.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        veiculo_id: form.veiculo_id,
        descricao: form.descricao,
        tipo: form.tipo,
        oficina: form.oficina,
        valor: Number(form.valor),
        data: form.data,
        status: form.status,
        unidade_id: unidadeAtual?.id || null,
      };

      if (editId) {
        const { error } = await supabase.from("manutencoes").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("Manutenção atualizada!");
      } else {
        const { error } = await supabase.from("manutencoes").insert(payload);
        if (error) throw error;
        toast.success("Manutenção registrada!");
      }
      setShowForm(false);
      setEditId(null);
      setForm({ veiculo_id: "", descricao: "", tipo: "Preventiva", oficina: "", valor: "", data: getBrasiliaDateString(), status: "Agendada", observacoes: "" });
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (m: any) => {
    setForm({
      veiculo_id: m.veiculo_id,
      descricao: m.descricao,
      tipo: m.tipo,
      oficina: m.oficina,
      valor: String(m.valor),
      data: m.data,
      status: m.status,
      observacoes: "",
    });
    setEditId(m.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta manutenção?")) return;
    try {
      const { error } = await supabase.from("manutencoes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Manutenção excluída!");
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === pendentesAcerto.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendentesAcerto.map((m) => m.id)));
    }
  };

  const gerarContaPagar = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma manutenção.");
      return;
    }
    setGerando(true);
    try {
      const selecionados = manutencoes.filter((m) => selectedIds.has(m.id));
      const totalValor = selecionados.reduce((s, m) => s + Number(m.valor), 0);

      const oficinas = [...new Set(selecionados.map((m) => m.oficina || "Não informada"))];
      const descricao = `Manutenção Veicular - ${selecionados.length} serviço(s) - Oficina(s): ${oficinas.join(", ")}`;

      const detalhes = selecionados.map((m) =>
        `${parseLocalDate(m.data).toLocaleDateString("pt-BR")} | ${(m.veiculos as any)?.placa || "-"} | ${m.tipo} | ${m.descricao} | R$${Number(m.valor).toFixed(2)} | ${m.oficina}`
      ).join("\n");

      const hoje = getBrasiliaDateString();

      const { error: cpError } = await supabase.from("contas_pagar").insert({
        descricao,
        fornecedor: oficinas.length === 1 ? oficinas[0] : `Oficinas diversas (${oficinas.length})`,
        valor: totalValor,
        vencimento: hoje,
        categoria: "Manutenção Veicular",
        status: "pendente",
        observacoes: `Detalhamento:\n${detalhes}`.trim(),
        unidade_id: unidadeAtual?.id || null,
      });
      if (cpError) throw cpError;

      // Mark as "Paga" (settled)
      for (const id of Array.from(selectedIds)) {
        await supabase.from("manutencoes").update({ status: "Paga" }).eq("id", id);
      }

      toast.success(`Conta a pagar gerada! R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} enviado ao financeiro.`);
      setShowAcerto(false);
      setSelectedIds(new Set());
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar conta a pagar");
    } finally {
      setGerando(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Manutenção de Veículos" subtitle="Sistema de oficina — controle preventivo e corretivo" />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Manutenção de Veículos" subtitle="Sistema de oficina — controle preventivo e corretivo" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />Nova Manutenção
          </Button>
          {pendentesAcerto.length > 0 && (
            <Button variant="outline" className="gap-2" onClick={() => { setShowAcerto(true); setSelectedIds(new Set(pendentesAcerto.map(m => m.id))); }}>
              <FileCheck className="h-4 w-4" />Gerar Contas a Pagar ({pendentesAcerto.length} concluída{pendentesAcerto.length > 1 ? "s" : ""})
            </Button>
          )}
        </div>

        {/* Alertas de Manutenção Preventiva */}
        {alertas.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-destructive" />
                <CardTitle className="text-base">Alertas de Manutenção Preventiva ({alertas.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertas.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md bg-background border">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="text-sm">{a.mensagem}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const veiculo = veiculos.find(v => v.placa === a.veiculo_placa);
                      if (veiculo) {
                        setForm(prev => ({ ...prev, veiculo_id: veiculo.id, tipo: "Preventiva" }));
                        setShowForm(true);
                      }
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />Agendar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {gastoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground">Em manutenções</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Agendadas</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{agendadas}</div>
              <p className="text-xs text-muted-foreground">Próximas manutenções</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
              <Wrench className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{emAndamento}</div>
              <p className="text-xs text-muted-foreground">Na oficina agora</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{concluidas}</div>
              <p className="text-xs text-muted-foreground">Aguardando acerto</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Histórico de Manutenções</CardTitle>
              <div className="flex items-center gap-3">
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="Agendada">Agendadas</SelectItem>
                    <SelectItem value="Em andamento">Em andamento</SelectItem>
                    <SelectItem value="Concluída">Concluídas</SelectItem>
                    <SelectItem value="Paga">Pagas</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar..." className="pl-10 w-[200px]" value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Oficina</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma manutenção registrada</TableCell></TableRow>
                )}
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {m.status === "Concluída" && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                        {m.status === "Em andamento" && <Wrench className="h-3 w-3 text-orange-600" />}
                        {m.status === "Agendada" && <Clock className="h-3 w-3 text-blue-600" />}
                        {m.status === "Paga" && <DollarSign className="h-3 w-3 text-muted-foreground" />}
                        <Badge variant={
                          m.status === "Concluída" ? "default" :
                          m.status === "Em andamento" ? "secondary" :
                          m.status === "Paga" ? "outline" : "outline"
                        }>{m.status}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{(m.veiculos as any)?.placa || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={m.tipo === "Preventiva" ? "secondary" : "destructive"}>{m.tipo}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">{m.descricao}</TableCell>
                    <TableCell>{m.oficina}</TableCell>
                    <TableCell>{parseLocalDate(m.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">R$ {Number(m.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(m)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {m.status !== "Paga" && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)} title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Nova Manutenção */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditId(null); setForm({ veiculo_id: "", descricao: "", tipo: "Preventiva", oficina: "", valor: "", data: getBrasiliaDateString(), status: "Agendada", observacoes: "" }); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar Manutenção" : "Nova Manutenção"}</DialogTitle></DialogHeader>

          {/* OCR inputs */}
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
          <input ref={pdfInputRef} type="file" accept="application/pdf" onChange={handlePdfImport} className="hidden" />

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => photoInputRef.current?.click()}
              disabled={isScanning}
            >
              {isScanning ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Lendo...</>
              ) : (
                <><Camera className="h-4 w-4" />Foto do comprovante</>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => pdfInputRef.current?.click()}
              disabled={isScanning}
            >
              {isScanning ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Lendo...</>
              ) : (
                <><FileText className="h-4 w-4" />Importar PDF</>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Veículo *</Label>
              <Select value={form.veiculo_id} onValueChange={(v) => setForm(f => ({ ...f, veiculo_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                <SelectContent>
                  {veiculos.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.placa}{v.modelo ? ` - ${v.modelo}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Descrição do Serviço *</Label>
              <Textarea
                placeholder="Ex: Troca de óleo e filtro, revisão de freios..."
                value={form.descricao}
                onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
                rows={2}
              />
            </div>

            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Preventiva">Preventiva</SelectItem>
                  <SelectItem value="Corretiva">Corretiva</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Agendada">Agendada</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Concluída">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Oficina *</Label>
              <Input placeholder="Nome da oficina" value={form.oficina} onChange={(e) => setForm(f => ({ ...f, oficina: e.target.value }))} />
            </div>

            <div>
              <Label>Valor Total (R$) *</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={form.valor} onChange={(e) => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>

            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editId ? "Atualizar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Gerar Contas a Pagar */}
      <Dialog open={showAcerto} onOpenChange={setShowAcerto}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Gerar Contas a Pagar — Manutenções
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Selecione as manutenções concluídas para gerar um título no Contas a Pagar.
          </p>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === pendentesAcerto.length && pendentesAcerto.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Oficina</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentesAcerto.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma manutenção concluída pendente</TableCell></TableRow>
                )}
                {pendentesAcerto.map((m) => (
                  <TableRow key={m.id} className={selectedIds.has(m.id) ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(m.id)}
                        onCheckedChange={() => toggleSelect(m.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{(m.veiculos as any)?.placa || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{m.descricao}</TableCell>
                    <TableCell>{m.oficina}</TableCell>
                    <TableCell>{parseLocalDate(m.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">R$ {Number(m.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between bg-muted/50 rounded-md p-3">
              <span className="text-sm font-medium">{selectedIds.size} manutenção(ões) selecionada(s)</span>
              <span className="text-lg font-bold">
                R$ {manutencoes.filter(m => selectedIds.has(m.id)).reduce((s, m) => s + Number(m.valor), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAcerto(false)}>Cancelar</Button>
            <Button onClick={gerarContaPagar} disabled={gerando || selectedIds.size === 0} className="gap-2">
              {gerando && <Loader2 className="h-4 w-4 animate-spin" />}
              Gerar Conta a Pagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
