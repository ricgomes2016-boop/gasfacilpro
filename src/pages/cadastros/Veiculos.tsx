import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogDescription as DialogDescription,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogTrigger as DialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Plus, Search, Edit, Trash2, User, Car, ExternalLink, Eye, MapPin, Fuel, WifiOff, Building2, FileDown, RefreshCw, DollarSign, Loader2, Upload, ShieldCheck } from "lucide-react";
import { consultarFipe } from "@/lib/fipe";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { VeiculoDetalheDialog } from "@/components/frota/VeiculoDetalheDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageUpload } from "@/components/ui/image-upload";

const PLACA_MERCOSUL_REGEX = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const PLACA_LEGADO_REGEX = /^[A-Z]{3}[0-9]{4}$/;
function formatPlacaMercosul(value: string): string {
  const clean = (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  let out = "";
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    // posições: 0,1,2 letras | 3 número | 4 letra | 5,6 números
    if (i < 3) {
      if (/[A-Z]/.test(ch)) out += ch;
    } else if (i === 3) {
      if (/[0-9]/.test(ch)) out += ch;
    } else if (i === 4) {
      if (/[A-Z]/.test(ch)) out += ch;
      else if (/[0-9]/.test(ch)) {
        // permite placa antiga: aceita número e segue com números
        out += ch;
      }
    } else {
      if (/[0-9]/.test(ch)) out += ch;
    }
  }
  return out;
}

interface Entregador {
  id: string;
  nome: string;
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
}

interface AbastecimentoAgg {
  veiculo_id: string;
  km_min: number;
  km_max: number;
  litros_total: number;
}

interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  marca: string | null;
  ano: number | null;
  km_atual: number | null;
  tipo: string | null;
  ativo: boolean | null;
  status: string | null;
  entregador_id: string | null;
  valor_fipe: number | null;
  crlv_vencimento: string | null;
  seguro_vencimento: string | null;
  seguro_empresa: string | null;
  foto_url: string | null;
  unidade_id: string | null;
  renavam: string | null;
}

const statusOptions = [
  { value: "ativo", label: "Ativo", color: "bg-success/10 text-success" },
  { value: "terceiro", label: "Terceiro", color: "bg-info/10 text-info" },
  { value: "inativo", label: "Inativo", color: "bg-warning/10 text-warning" },
  { value: "excluido", label: "Excluído", color: "bg-destructive/10 text-destructive" },
];

const emptyForm = { placa: "", modelo: "", marca: "", ano: "", km_atual: "", tipo: "moto", entregador_id: "", valor_fipe: "", status: "ativo", foto_url: "", renavam: "", crlv_vencimento: "", seguro_vencimento: "", seguro_empresa: "" };

export default function Veiculos() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("ativo");
  const [detalheVeiculo, setDetalheVeiculo] = useState<Veiculo | null>(null);
  const [abastAgg, setAbastAgg] = useState<AbastecimentoAgg[]>([]);
  const [transferVeiculo, setTransferVeiculo] = useState<Veiculo | null>(null);
  const [transferUnidadeId, setTransferUnidadeId] = useState<string>("");
  const [fipeLoading, setFipeLoading] = useState(false);
  const [bulkFipeLoading, setBulkFipeLoading] = useState(false);
  const { unidadeAtual, unidades } = useUnidade();
  const [importingCrlv, setImportingCrlv] = useState(false);

  const getDocStatus = (date: string | null) => {
    if (!date) return { label: "Não informado", variant: "secondary" as const, dias: null as number | null };
    const dias = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (dias <= 0) return { label: `Vencido ${Math.abs(dias)}d`, variant: "destructive" as const, dias };
    if (dias <= 30) return { label: `${dias}d`, variant: "default" as const, dias };
    return { label: `${dias}d`, variant: "secondary" as const, dias };
  };

  const compressImage = (file: File, maxWidth = 1600): Promise<string> =>
    new Promise((resolve, reject) => {
      if (file.type === "application/pdf") {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
        return;
      }
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
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleImportCrlvForm = async (file: File) => {
    setImportingCrlv(true);
    try {
      const imageBase64 = await compressImage(file);
      const { data, error } = await supabase.functions.invoke("parse-crlv", { body: { imageBase64 } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const patch: any = {};
      if (data.crlv_vencimento) patch.crlv_vencimento = data.crlv_vencimento;
      if (data.renavam) patch.renavam = String(data.renavam);
      if (data.placa && !form.placa) patch.placa = formatPlacaMercosul(String(data.placa));
      if (Object.keys(patch).length === 0) {
        toast.error("Nada foi identificado no CRLV.");
        return;
      }
      setForm(f => ({ ...f, ...patch }));
      toast.success("CRLV importado!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar CRLV");
    } finally {
      setImportingCrlv(false);
    }
  };


  const handleBuscarFipeForm = async () => {
    if (!form.marca || !form.modelo) {
      toast.error("Informe marca e modelo antes de buscar a FIPE");
      return;
    }
    setFipeLoading(true);
    try {
      const r = await consultarFipe({
        tipo: form.tipo,
        marca: form.marca,
        modelo: form.modelo,
        ano: form.ano ? parseInt(form.ano, 10) : null,
      });
      if (!r) {
        toast.error("Veículo não encontrado na tabela FIPE");
        return;
      }
      setForm(f => ({ ...f, valor_fipe: r.valor.toFixed(2) }));
      toast.success(`FIPE: ${r.marca} ${r.modelo} (${r.ano}) — R$ ${r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    } catch (e: any) {
      toast.error("Erro ao consultar FIPE: " + (e?.message || ""));
    } finally {
      setFipeLoading(false);
    }
  };

  const handleAtualizarFipeMassa = async () => {
    const alvo = veiculos.filter(v => v.marca && v.modelo && (v.status || "ativo") !== "excluido");
    if (alvo.length === 0) {
      toast.error("Nenhum veículo elegível para atualização");
      return;
    }
    setBulkFipeLoading(true);
    let ok = 0, fail = 0;
    for (const v of alvo) {
      try {
        const r = await consultarFipe({ tipo: v.tipo, marca: v.marca, modelo: v.modelo, ano: v.ano });
        if (r && r.valor > 0) {
          const { error } = await supabase.from("veiculos").update({ valor_fipe: r.valor }).eq("id", v.id);
          if (error) throw error;
          ok++;
        } else {
          fail++;
        }
      } catch {
        fail++;
      }
    }
    setBulkFipeLoading(false);
    toast.success(`FIPE atualizada: ${ok} sucesso, ${fail} sem correspondência`);
    fetchVeiculos();
  };


  const fetchVeiculos = async () => {
    let query = supabase
      .from("veiculos")
      .select("*")
      .order("placa");
    
    if (unidadeAtual?.id) {
      query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    }

    const [{ data, error }, { data: entData }, { data: abastData }] = await Promise.all([
      query,
      supabase.from("entregadores").select("id, nome, latitude, longitude, updated_at").eq("ativo", true).order("nome"),
      supabase.from("abastecimentos").select("veiculo_id, km, litros").order("km", { ascending: true }),
    ]);
    if (error) { console.error(error); return; }
    setVeiculos((data || []) as Veiculo[]);
    setEntregadores((entData || []) as Entregador[]);

    // Aggregate KM/L per vehicle
    const aggMap = new Map<string, { kms: number[]; litros: number }>();
    (abastData || []).forEach((a: any) => {
      const entry = aggMap.get(a.veiculo_id) || { kms: [], litros: 0 };
      entry.kms.push(Number(a.km));
      entry.litros += Number(a.litros);
      aggMap.set(a.veiculo_id, entry);
    });
    const agg: AbastecimentoAgg[] = [];
    aggMap.forEach((v, k) => {
      agg.push({ veiculo_id: k, km_min: Math.min(...v.kms), km_max: Math.max(...v.kms), litros_total: v.litros });
    });
    setAbastAgg(agg);
    setLoading(false);
  };

  useEffect(() => { fetchVeiculos(); }, [unidadeAtual?.id]);

  const handleSave = async () => {
    if (!form.placa.trim() || !form.modelo.trim()) {
      toast.error("Placa e Modelo são obrigatórios");
      return;
    }
    const placaNorm = form.placa.toUpperCase().trim();
    if (!PLACA_MERCOSUL_REGEX.test(placaNorm) && !PLACA_LEGADO_REGEX.test(placaNorm)) {
      toast.error("Placa inválida. Use formato Mercosul (ABC1D23) ou antigo (ABC1234).");
      return;
    }
    const payload: any = {
      placa: placaNorm,
      modelo: form.modelo,
      marca: form.marca || null,
      ano: form.ano ? parseInt(form.ano) : null,
      km_atual: form.km_atual ? parseFloat(form.km_atual) : 0,
      tipo: form.tipo || "moto",
      entregador_id: form.entregador_id || null,
      valor_fipe: form.valor_fipe ? parseFloat(form.valor_fipe) : null,
      status: form.status || "ativo",
      ativo: form.status !== "excluido",
      foto_url: form.foto_url || null,
      renavam: form.renavam?.trim() || null,
      crlv_vencimento: form.crlv_vencimento || null,
      seguro_vencimento: form.seguro_vencimento || null,
      seguro_empresa: form.seguro_empresa?.trim() || null,
    };
    if (!editId && unidadeAtual?.id) {
      payload.unidade_id = unidadeAtual.id;
    }

    if (editId) {
      const { error } = await supabase.from("veiculos").update(payload).eq("id", editId);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      toast.success("Veículo atualizado!");
    } else {
      const { error } = await supabase.from("veiculos").insert(payload);
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
      toast.success("Veículo cadastrado!");
    }
    setOpen(false);
    setForm(emptyForm);
    setEditId(null);
    fetchVeiculos();
  };

  const handleEdit = (v: Veiculo) => {
    setForm({
      placa: v.placa,
      modelo: v.modelo,
      marca: v.marca || "",
      ano: v.ano?.toString() || "",
      km_atual: v.km_atual?.toString() || "",
      tipo: v.tipo || "moto",
      entregador_id: v.entregador_id || "",
      valor_fipe: v.valor_fipe?.toString() || "",
      status: v.status || "ativo",
      foto_url: v.foto_url || "",
      renavam: v.renavam || "",
      crlv_vencimento: v.crlv_vencimento || "",
      seguro_vencimento: v.seguro_vencimento || "",
      seguro_empresa: v.seguro_empresa || "",
    });
    setEditId(v.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("veiculos").update({ status: "excluido", ativo: false }).eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Veículo marcado como excluído");
    fetchVeiculos();
  };

  const handleTransferir = async () => {
    if (!transferVeiculo || !transferUnidadeId) {
      toast.error("Selecione a filial de destino");
      return;
    }
    const { error } = await supabase.from("veiculos").update({ unidade_id: transferUnidadeId }).eq("id", transferVeiculo.id);
    if (error) { toast.error("Erro ao transferir: " + error.message); return; }
    const dest = unidades.find(u => u.id === transferUnidadeId);
    toast.success(`Veículo ${transferVeiculo.placa} transferido para ${dest?.nome || "filial"}`);
    setTransferVeiculo(null);
    setTransferUnidadeId("");
    fetchVeiculos();
  };

  const getUnidadeNome = (id: string | null) => unidades.find(u => u.id === id)?.nome || "—";

  const handleExportarPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Veículos", 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Unidade: ${unidadeAtual?.nome || "Todas"}`, 14, 22);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} — Total: ${filtered.length} veículo(s)`, 14, 28);
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: 33,
      head: [["Placa", "RENAVAM", "Modelo", "Marca", "Ano", "Tipo", "KM", "Status", "Filial", "Entregador", "FIPE (R$)", "CRLV", "Seguro"]],
      body: filtered.map(v => [
        v.placa,
        v.renavam || "—",
        v.modelo,
        v.marca || "—",
        v.ano?.toString() || "—",
        v.tipo || "—",
        v.km_atual?.toLocaleString("pt-BR") || "0",
        statusOptions.find(s => s.value === (v.status || "ativo"))?.label || v.status || "—",
        getUnidadeNome(v.unidade_id),
        getEntregadorNome(v.entregador_id) || "—",
        Number(v.valor_fipe || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        v.crlv_vencimento ? new Date(v.crlv_vencimento).toLocaleDateString("pt-BR") : "—",
        v.seguro_vencimento ? new Date(v.seguro_vencimento).toLocaleDateString("pt-BR") : "—",
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [41, 98, 89], textColor: 255, fontStyle: "bold" },
    });

    doc.save(`Veiculos_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF gerado!");
  };

  const handleImprimir = () => window.print();

  const getEntregador = (id: string | null) => {
    if (!id) return null;
    return entregadores.find(e => e.id === id) || null;
  };

  const getEntregadorNome = (id: string | null) => getEntregador(id)?.nome || null;

  const getGpsStatus = (entregadorId: string | null) => {
    const ent = getEntregador(entregadorId);
    if (!ent || !ent.latitude || !ent.longitude) return { online: false, label: "Sem GPS" };
    const lastUpdate = new Date(ent.updated_at);
    const diffMin = (Date.now() - lastUpdate.getTime()) / 60000;
    if (diffMin > 5) return { online: false, label: `Offline (${Math.round(diffMin)}min)` };
    return { online: true, label: "Online" };
  };

  const getKmL = (veiculoId: string) => {
    const agg = abastAgg.find(a => a.veiculo_id === veiculoId);
    if (!agg || agg.litros_total <= 0 || agg.km_max <= agg.km_min) return null;
    return (agg.km_max - agg.km_min) / agg.litros_total;
  };

  const getStatusBadge = (status: string | null) => {
    const s = statusOptions.find(o => o.value === (status || "ativo"));
    return s ? <Badge className={`${s.color} border-0`}>{s.label}</Badge> : <Badge variant="outline">{status}</Badge>;
  };

  const filtered = veiculos.filter(v => {
    const matchSearch = v.placa.toLowerCase().includes(search.toLowerCase()) ||
      v.modelo.toLowerCase().includes(search.toLowerCase()) ||
      (v.marca || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === "todos" || (v.status || "ativo") === filtroStatus;
    return matchSearch && matchStatus;
  });

  const countByStatus = (s: string) => veiculos.filter(v => (v.status || "ativo") === s).length;
  const totalFipe = veiculos.filter(v => (v.status || "ativo") !== "excluido").reduce((sum, v) => sum + Number(v.valor_fipe || 0), 0);
  const avgKmL = useMemo(() => {
    const vals = veiculos.map(v => getKmL(v.id)).filter(Boolean) as number[];
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [veiculos, abastAgg]);
  const gpsOnlineCount = veiculos.filter(v => v.entregador_id && getGpsStatus(v.entregador_id).online).length;

  return (
    <MainLayout>
      <Header title="Veículos" subtitle={`${unidadeAtual?.nome || "Unidade atual"} — Gerencie a frota de veículos`} />
      <div className="dashboard-shell">
        {/* Top actions */}
        <div className="flex flex-col gap-3 w-full min-w-0 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={filtroStatus} onValueChange={setFiltroStatus} className="w-full min-w-0 lg:w-auto">
            <TabsList className="h-auto w-full min-w-0 flex-wrap justify-start gap-1 rounded-2xl bg-card p-1 shadow-sm lg:w-auto">
              <TabsTrigger value="todos">Todos ({veiculos.length})</TabsTrigger>
              <TabsTrigger value="ativo">Ativos ({countByStatus("ativo")})</TabsTrigger>
              <TabsTrigger value="terceiro">Terceiros ({countByStatus("terceiro")})</TabsTrigger>
              <TabsTrigger value="inativo">Inativos ({countByStatus("inativo")})</TabsTrigger>
              <TabsTrigger value="excluido">Excluídos ({countByStatus("excluido")})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex w-full gap-2 lg:w-auto">
            <Button variant="outline" onClick={handleAtualizarFipeMassa} disabled={bulkFipeLoading} className="h-10 flex-1 gap-2 lg:flex-none">
              {bulkFipeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar FIPE
            </Button>
            <Button variant="outline" onClick={handleExportarPDF} className="h-10 flex-1 gap-2 lg:flex-none">
              <FileDown className="h-4 w-4" />Exportar PDF
            </Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button className="h-10 w-full gap-2 shadow-sm lg:w-auto"><Plus className="h-4 w-4" />Novo Veículo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Veículo" : "Cadastrar Novo Veículo"}</DialogTitle>
                <DialogDescription>Preencha os dados do veículo</DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex flex-col items-start gap-2 sm:items-center sm:flex-row sm:gap-4">
                <div className="space-y-2">
                  <Label>Foto do veículo</Label>
                  <ImageUpload
                    value={form.foto_url || null}
                    onChange={(url) => setForm({ ...form, foto_url: url || "" })}
                    bucket="vehicle-photos"
                    folder="veiculos"
                    allowCamera
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Placa *</Label>
                  <Input
                    className="w-full min-w-0 font-mono uppercase tracking-wider"
                    value={form.placa}
                    onChange={(e) => setForm({ ...form, placa: formatPlacaMercosul(e.target.value) })}
                    placeholder="ABC1D23"
                    maxLength={7}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modelo *</Label>
                  <Input className="w-full min-w-0" value={form.modelo} onChange={e => setForm({...form, modelo: e.target.value})} placeholder="Fiorino 1.4" />
                </div>
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Input value={form.marca} onChange={e => setForm({...form, marca: e.target.value})} placeholder="Fiat" />
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input value={form.ano} onChange={e => setForm({...form, ano: e.target.value})} placeholder="2023" />
                </div>
                <div className="space-y-2">
                  <Label>KM Atual</Label>
                  <Input type="number" value={form.km_atual} onChange={e => setForm({...form, km_atual: e.target.value})} placeholder="45000" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="moto">Moto</SelectItem>
                      <SelectItem value="carro">Carro</SelectItem>
                      <SelectItem value="utilitario">Utilitário</SelectItem>
                      <SelectItem value="caminhao">Caminhão</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="bicicleta">Bicicleta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor FIPE (R$)</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={form.valor_fipe} onChange={e => setForm({...form, valor_fipe: e.target.value})} placeholder="25000.00" />
                    <Button type="button" variant="outline" onClick={handleBuscarFipeForm} disabled={fipeLoading} className="gap-1 shrink-0">
                      {fipeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                      FIPE
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Entregador Vinculado</Label>
                  <Select value={form.entregador_id} onValueChange={(v) => setForm({...form, entregador_id: v === "none" ? "" : v})}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {entregadores.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2 border-t border-border/40 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Documentos do veículo</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={importingCrlv}
                      className="gap-1"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*,application/pdf";
                        input.onchange = (ev: any) => {
                          const f = ev.target.files?.[0];
                          if (f) handleImportCrlvForm(f);
                        };
                        input.click();
                      }}
                    >
                      {importingCrlv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Importar CRLV
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>RENAVAM</Label>
                  <Input value={form.renavam} onChange={e => setForm({...form, renavam: e.target.value.replace(/\D/g, "")})} placeholder="00000000000" maxLength={11} />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento CRLV</Label>
                  <Input type="date" value={form.crlv_vencimento} onChange={e => setForm({...form, crlv_vencimento: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Vencimento Seguro</Label>
                  <Input type="date" value={form.seguro_vencimento} onChange={e => setForm({...form, seguro_vencimento: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Seguradora</Label>
                  <Input value={form.seguro_empresa} onChange={e => setForm({...form, seguro_empresa: e.target.value})} placeholder="Nome da seguradora" />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 mt-4 sm:flex-row sm:justify-end">
                <Button className="h-10" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button className="h-10" onClick={handleSave}>{editId ? "Atualizar" : "Salvar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-3 min-[384px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card className="modern-status-card">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-semibold truncate text-primary">Ativos</CardTitle>
              <span className="status-card-icon-primary rounded-xl p-2"><Car className="h-4 w-4" /></span>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{countByStatus("ativo")}</div></CardContent>
          </Card>
          <Card className="modern-status-card">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-semibold truncate text-info">Terceiros</CardTitle>
              <span className="status-card-icon-info rounded-xl p-2"><ExternalLink className="h-4 w-4" /></span>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{countByStatus("terceiro")}</div></CardContent>
          </Card>
          <Card className="modern-status-card">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-semibold truncate text-success">GPS Online</CardTitle>
              <span className="status-card-icon-success rounded-xl p-2"><MapPin className="h-4 w-4" /></span>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{gpsOnlineCount}</div></CardContent>
          </Card>
          <Card className="modern-status-card">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-semibold truncate text-warning">KM/L Médio</CardTitle>
              <span className="status-card-icon-warning rounded-xl p-2"><Fuel className="h-4 w-4" /></span>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{avgKmL > 0 ? avgKmL.toFixed(1) : "—"}</div></CardContent>
          </Card>
          <Card className="modern-status-card">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-semibold truncate text-muted-foreground">Com Entregador</CardTitle>
              <span className="status-card-icon-muted rounded-xl p-2"><User className="h-4 w-4" /></span>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{veiculos.filter(v => v.entregador_id && (v.status || "ativo") !== "excluido").length}</div></CardContent>
          </Card>
          <Card className="modern-status-card">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-semibold truncate text-accent-foreground">Valor FIPE</CardTitle>
              <span className="status-card-icon-accent rounded-xl p-2"><Truck className="h-4 w-4" /></span>
            </CardHeader>
            <CardContent><div className="text-xl font-bold truncate">R$ {totalFipe.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div></CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="modern-panel overflow-hidden">
          <CardHeader className="section-header-catalog pb-3">
            <div className="flex flex-col gap-3 w-full min-w-0 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="section-header-title min-w-0"><span className="truncate">Lista de Veículos</span></CardTitle>
              <div className="relative w-full min-w-0 lg:w-[320px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar placa, modelo, marca..." className="w-full min-w-0 pl-10" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="saas-table-scope max-w-full overflow-x-auto p-0 md:p-6">
            {loading ? <div className="space-y-3 p-3 md:p-0">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div> : (
              <>
              <div className="space-y-3 px-3 pb-3 md:hidden w-full min-w-0">
                {filtered.map(v => {
                  const gps = getGpsStatus(v.entregador_id);
                  const kmL = getKmL(v.id);
                  const crlv = getDocStatus(v.crlv_vencimento);
                  const seguro = getDocStatus(v.seguro_vencimento);
                  return (
                    <div key={v.id} className={`rounded-2xl border border-border/45 bg-card p-3 shadow-sm w-full min-w-0 ${(v.status === "excluido" || v.status === "inativo") ? "opacity-60" : ""}`}>
                      <div className="flex items-start justify-between gap-3 w-full min-w-0">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {v.foto_url ? (
                            <img src={v.foto_url} alt={v.placa} className="h-14 w-14 rounded-lg object-cover border border-border shrink-0" />
                          ) : (
                            <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Car className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm font-bold truncate">{v.placa}</p>
                            <p className="text-sm font-medium truncate">{v.modelo}</p>
                            <p className="text-xs text-muted-foreground truncate">{v.marca || "Sem marca"} {v.ano || ""}</p>
                            {v.renavam && <p className="text-[10px] text-muted-foreground truncate">RENAVAM: {v.renavam}</p>}
                          </div>
                        </div>
                        {getStatusBadge(v.status)}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-muted/50 p-2 min-w-0"><span className="text-muted-foreground">Tipo</span><p className="font-medium truncate">{v.tipo || "—"}</p></div>
                        <div className="rounded-xl bg-muted/50 p-2 min-w-0"><span className="text-muted-foreground">KM</span><p className="font-medium truncate">{v.km_atual?.toLocaleString("pt-BR") || 0}</p></div>
                        <div className="rounded-xl bg-muted/50 p-2 min-w-0"><span className="text-muted-foreground">KM/L</span><p className="font-medium truncate">{kmL ? kmL.toFixed(1) : "—"}</p></div>
                        <div className="rounded-xl bg-muted/50 p-2 min-w-0"><span className="text-muted-foreground">GPS</span><p className="font-medium truncate">{v.entregador_id ? gps.label : "—"}</p></div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-muted-foreground">CRLV:</span>
                        <Badge variant={crlv.variant} className="h-5">{crlv.label}</Badge>
                        <span className="text-muted-foreground ml-1">Seguro:</span>
                        <Badge variant={seguro.variant} className="h-5">{seguro.label}</Badge>
                        {v.seguro_empresa && <span className="text-muted-foreground truncate">· {v.seguro_empresa}</span>}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 w-full min-w-0">
                        <span className="text-xs text-muted-foreground truncate">{getEntregadorNome(v.entregador_id) || "Sem entregador"}</span>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setDetalheVeiculo(v)} title="Detalhes"><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => handleEdit(v)} title="Editar"><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => { setTransferVeiculo(v); setTransferUnidadeId(""); }} title="Transferir filial"><Building2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden md:block min-w-[900px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Foto</TableHead>
                    <TableHead>Placa</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>KM</TableHead>
                    <TableHead>KM/L</TableHead>
                    <TableHead>GPS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Documentos</TableHead>
                    <TableHead>Entregador</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(v => {
                    const gps = getGpsStatus(v.entregador_id);
                    const kmL = getKmL(v.id);
                    const crlv = getDocStatus(v.crlv_vencimento);
                    const seguro = getDocStatus(v.seguro_vencimento);
                    return (
                    <TableRow key={v.id} className={(v.status === "excluido" || v.status === "inativo") ? "opacity-60" : ""}>
                      <TableCell className="w-16">
                        {v.foto_url ? (
                          <img src={v.foto_url} alt={v.placa} className="h-12 w-12 rounded-lg object-cover border border-border" />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                            <Car className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono font-bold">
                        <div>{v.placa}</div>
                        {v.renavam && <div className="text-[10px] font-normal text-muted-foreground">RENAVAM {v.renavam}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{v.modelo}</div>
                        {v.marca && <div className="text-xs text-muted-foreground">{v.marca} {v.ano || ""}</div>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{v.tipo || "—"}</Badge></TableCell>
                      <TableCell className="text-sm">{v.km_atual?.toLocaleString("pt-BR") || 0}</TableCell>
                      <TableCell>
                        {kmL ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant={kmL >= 8 ? "default" : "destructive"} className="gap-1">
                                  <Fuel className="h-3 w-3" />
                                  {kmL.toFixed(1)}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>KM por litro</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        {v.entregador_id ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className={`gap-1 ${gps.online ? "border-primary text-primary" : "text-muted-foreground"}`}>
                                  {gps.online ? <MapPin className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                  {gps.online ? "On" : "Off"}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{gps.label}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>{getStatusBadge(v.status)}</TableCell>
                      <TableCell>
                        {getEntregadorNome(v.entregador_id) ? (
                          <Badge variant="secondary" className="gap-1">
                            <User className="h-3 w-3" />
                            {getEntregadorNome(v.entregador_id)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setDetalheVeiculo(v)} title="Detalhes">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(v)} title="Editar">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setTransferVeiculo(v); setTransferUnidadeId(""); }} title="Transferir para filial">
                            <Building2 className="h-4 w-4" />
                          </Button>
                          {v.status !== "excluido" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Excluir">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir veículo?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    O veículo <strong>{v.placa}</strong> será marcado como excluído. Você poderá restaurá-lo editando o status.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(v.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Nenhum veículo encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
              {filtered.length === 0 && (
                <div className="px-3 pb-3 text-center text-sm text-muted-foreground md:hidden">Nenhum veículo encontrado</div>
              )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Detalhe Dialog */}
        <VeiculoDetalheDialog
          open={!!detalheVeiculo}
          onOpenChange={(o) => { if (!o) setDetalheVeiculo(null); }}
          veiculo={detalheVeiculo}
        />

        {/* Transferir filial */}
        <Dialog open={!!transferVeiculo} onOpenChange={(o) => { if (!o) { setTransferVeiculo(null); setTransferUnidadeId(""); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Transferir veículo para filial</DialogTitle>
              <DialogDescription>
                Veículo <strong>{transferVeiculo?.placa}</strong> — {transferVeiculo?.modelo}
                <br />
                <span className="text-xs">Filial atual: {getUnidadeNome(transferVeiculo?.unidade_id ?? null)}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              <Label>Filial de destino</Label>
              <Select value={transferUnidadeId} onValueChange={setTransferUnidadeId}>
                <SelectTrigger><SelectValue placeholder="Selecione a filial" /></SelectTrigger>
                <SelectContent>
                  {unidades
                    .filter(u => u.id !== transferVeiculo?.unidade_id)
                    .map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col-reverse gap-2 mt-4 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setTransferVeiculo(null)}>Cancelar</Button>
              <Button onClick={handleTransferir} disabled={!transferUnidadeId}>Transferir</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
