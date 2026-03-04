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
import { Fuel, Plus, Search, TrendingUp, Truck, DollarSign, Loader2, FileCheck, Receipt, Camera, Trash2, FileText, Filter } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

interface Veiculo {
  id: string;
  placa: string;
  modelo?: string;
}

export default function Combustivel() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [abastecimentos, setAbastecimentos] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [gastoMensal, setGastoMensal] = useState(0);
  const [litrosMensal, setLitrosMensal] = useState(0);
  const [veiculosAtivos, setVeiculosAtivos] = useState(0);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    veiculo_id: "",
    motorista: "",
    data: getBrasiliaDateString(),
    km: "",
    litros: "",
    tipo: "Gasolina",
    valor: "",
    posto: "",
    nota_fiscal: "",
  });

  // Acerto state
  const [showAcerto, setShowAcerto] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gerando, setGerando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pendente" | "acertado">("todos");
  const [isScanning, setIsScanning] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoInputRef.current) photoInputRef.current.value = "";

    setIsScanning(true);
    try {
      const imageBase64 = await compressImage(file);
      const { data, error } = await supabase.functions.invoke("parse-fuel-photo", {
        body: { imageBase64 },
      });
      if (error) throw error;

      setForm((prev) => ({
        ...prev,
        litros: data.litros != null ? String(data.litros) : prev.litros,
        valor: data.valor != null ? String(data.valor) : prev.valor,
        tipo: data.tipo || prev.tipo,
        posto: data.posto || prev.posto,
        nota_fiscal: data.nota_fiscal || prev.nota_fiscal,
        km: data.km != null ? String(data.km) : prev.km,
      }));

      toast.success("Dados extraídos da foto! Confira e complete.");
    } catch (err: any) {
      console.error("OCR error:", err);
      toast.error(err.message || "Erro ao ler foto. Tente novamente.");
    } finally {
      setIsScanning(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const mesInicio = new Date();
      mesInicio.setDate(1);
      mesInicio.setHours(0, 0, 0, 0);

      let aq = (supabase as any).from("abastecimentos").select("*, veiculos(placa, modelo), entregadores(nome)").order("data", { ascending: false });
      if (unidadeAtual?.id) aq = aq.eq("unidade_id", unidadeAtual.id);
      const { data } = await aq;
      setAbastecimentos(data || []);

      const mesData = (data || []).filter((a: any) => parseLocalDate(a.data) >= mesInicio);
      setGastoMensal(mesData.reduce((s: number, a: any) => s + Number(a.valor), 0));
      setLitrosMensal(mesData.reduce((s: number, a: any) => s + Number(a.litros), 0));

      const [{ count }, { data: veiculosData }] = await Promise.all([
        supabase.from("veiculos").select("id", { count: "exact" }).eq("ativo", true),
        supabase.from("veiculos").select("id, placa, modelo").eq("ativo", true).order("placa"),
      ]);
      setVeiculosAtivos(count || 0);
      setVeiculos(veiculosData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = abastecimentos.filter((a) => {
    const matchBusca = !busca ||
      (a.veiculos as any)?.placa?.toLowerCase().includes(busca.toLowerCase()) ||
      a.motorista?.toLowerCase().includes(busca.toLowerCase()) ||
      a.posto?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "todos" || a.status === filtroStatus;
    const matchDataInicio = !dataInicio || a.data >= dataInicio;
    const matchDataFim = !dataFim || a.data <= dataFim;
    return matchBusca && matchStatus && matchDataInicio && matchDataFim;
  });

  const gerarPDF = () => {
    const rows = filtered.map((a) =>
      `${parseLocalDate(a.data).toLocaleDateString("pt-BR")} | ${(a.veiculos as any)?.placa || "-"} | ${a.motorista} | ${Number(a.litros)}L ${a.tipo} | R$ ${Number(a.valor).toFixed(2)} | ${a.posto || "-"} | ${a.nota_fiscal || "-"} | ${a.status === "acertado" ? "Acertado" : "Pendente"}`
    );
    const totalVal = filtered.reduce((s, a) => s + Number(a.valor), 0);
    const totalLit = filtered.reduce((s, a) => s + Number(a.litros), 0);
    const printContent = `<html><head><title>Relatório Combustível</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}h2{text-align:center}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f5f5f5;font-weight:bold}.total{font-weight:bold;font-size:14px;margin-top:15px}</style></head><body><h2>Relatório de Combustível</h2><p>Período: ${dataInicio ? parseLocalDate(dataInicio).toLocaleDateString("pt-BR") : "Início"} a ${dataFim ? parseLocalDate(dataFim).toLocaleDateString("pt-BR") : "Hoje"} | Total: ${filtered.length} registros</p><table><thead><tr><th>Data</th><th>Veículo</th><th>Motorista</th><th>Litros</th><th>Tipo</th><th>Valor</th><th>Posto</th><th>NF</th><th>Status</th></tr></thead><tbody>${filtered.map(a => `<tr><td>${parseLocalDate(a.data).toLocaleDateString("pt-BR")}</td><td>${(a.veiculos as any)?.placa || "-"}</td><td>${a.motorista}</td><td>${Number(a.litros)}L</td><td>${a.tipo}</td><td>R$ ${Number(a.valor).toFixed(2)}</td><td>${a.posto || "-"}</td><td>${a.nota_fiscal || "-"}</td><td>${a.status === "acertado" ? "Acertado" : "Pendente"}</td></tr>`).join("")}</tbody></table><p class="total">Total: R$ ${totalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} | ${totalLit.toFixed(1)}L</p></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(printContent); w.document.close(); w.print(); }
  };

  const pendentes = abastecimentos.filter((a) => a.status === "pendente");

  const handleSave = async () => {
    if (!form.veiculo_id || !form.motorista || !form.litros || !form.valor) {
      toast.error("Preencha veículo, motorista, litros e valor.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("abastecimentos").insert({
        veiculo_id: form.veiculo_id,
        motorista: form.motorista,
        data: form.data,
        km: Number(form.km) || 0,
        litros: Number(form.litros),
        tipo: form.tipo,
        valor: Number(form.valor),
        posto: form.posto || null,
        nota_fiscal: form.nota_fiscal || null,
        status: "pendente",
        unidade_id: unidadeAtual?.id || null,
      });
      if (error) throw error;
      toast.success("Abastecimento registrado!");
      setShowForm(false);
      setForm({ veiculo_id: "", motorista: "", data: getBrasiliaDateString(), km: "", litros: "", tipo: "Gasolina", valor: "", posto: "", nota_fiscal: "" });
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
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
    if (selectedIds.size === pendentes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendentes.map((a) => a.id)));
    }
  };

  const gerarAcerto = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos um abastecimento.");
      return;
    }
    setGerando(true);
    try {
      const selecionados = abastecimentos.filter((a) => selectedIds.has(a.id));
      const totalValor = selecionados.reduce((s, a) => s + Number(a.valor), 0);
      const totalLitros = selecionados.reduce((s, a) => s + Number(a.litros), 0);

      // Group by posto
      const postos = [...new Set(selecionados.map((a) => a.posto || "Não informado"))];
      const descricao = `Acerto Combustível - ${selecionados.length} abastecimento(s) - ${totalLitros.toFixed(1)}L - Postos: ${postos.join(", ")}`;

      // Build NF references
      const nfs = selecionados.filter((a) => a.nota_fiscal).map((a) => a.nota_fiscal);
      const obsNfs = nfs.length > 0 ? `NFs: ${nfs.join(", ")}` : "";
      const detalhes = selecionados.map((a) =>
        `${parseLocalDate(a.data).toLocaleDateString("pt-BR")} | ${(a.veiculos as any)?.placa || "-"} | ${a.motorista} | ${Number(a.litros)}L ${a.tipo} | R$${Number(a.valor).toFixed(2)}${a.posto ? ` | ${a.posto}` : ""}${a.nota_fiscal ? ` | NF ${a.nota_fiscal}` : ""}`
      ).join("\n");

      const hoje = getBrasiliaDateString();

      // Create conta a pagar
      const { error: cpError } = await supabase.from("contas_pagar").insert({
        descricao,
        fornecedor: postos.length === 1 ? postos[0] : `Postos diversos (${postos.length})`,
        valor: totalValor,
        vencimento: hoje,
        categoria: "Combustível",
        status: "pendente",
        observacoes: `${obsNfs}\n\nDetalhamento:\n${detalhes}`.trim(),
        unidade_id: unidadeAtual?.id || null,
      });
      if (cpError) throw cpError;

      // Mark abastecimentos as settled
      const { error: updError } = await (supabase as any)
        .from("abastecimentos")
        .update({ status: "acertado", acerto_data: hoje })
        .in("id", Array.from(selectedIds));
      if (updError) throw updError;

      toast.success(`Acerto gerado! R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} enviado ao Contas a Pagar.`);
      setShowAcerto(false);
      setSelectedIds(new Set());
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar acerto");
    } finally {
      setGerando(false);
    }
  };
  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("abastecimentos").delete().eq("id", id);
      if (error) throw error;
      toast.success("Abastecimento excluído!");
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Controle de Combustível" subtitle="Gerencie abastecimentos da frota" />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Controle de Combustível" subtitle="Gerencie abastecimentos da frota" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />Novo Abastecimento
          </Button>
          {pendentes.length > 0 && (
            <Button variant="outline" className="gap-2" onClick={() => { setShowAcerto(true); setSelectedIds(new Set(pendentes.map(a => a.id))); }}>
              <FileCheck className="h-4 w-4" />Gerar Acerto ({pendentes.length} pendente{pendentes.length > 1 ? "s" : ""})
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Gasto Mensal</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">R$ {gastoMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><p className="text-xs text-muted-foreground">Este mês</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Litros Consumidos</CardTitle><Fuel className="h-4 w-4 text-orange-600" /></CardHeader>
            <CardContent><div className="text-2xl font-bold text-orange-600">{litrosMensal.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} L</div><p className="text-xs text-muted-foreground">Este mês</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pendentes Acerto</CardTitle><Receipt className="h-4 w-4 text-yellow-600" /></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendentes.length}</div>
              <p className="text-xs text-muted-foreground">R$ {pendentes.reduce((s, a) => s + Number(a.valor), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Veículos Ativos</CardTitle><Truck className="h-4 w-4 text-blue-600" /></CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-600">{veiculosAtivos}</div><p className="text-xs text-muted-foreground">Na frota</p></CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Histórico de Abastecimentos</CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">De:</Label>
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-[140px] h-9" />
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Até:</Label>
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[140px] h-9" />
                </div>
                <Select value={filtroStatus} onValueChange={(v: any) => setFiltroStatus(v)}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendentes</SelectItem>
                    <SelectItem value="acertado">Acertados</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar..." className="pl-10 w-[200px]" value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={gerarPDF}>
                  <FileText className="h-4 w-4" /> PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Posto</TableHead>
                  <TableHead>NF</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Litros</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Caixa</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground">Nenhum abastecimento encontrado</TableCell></TableRow>
                )}
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Badge variant={a.status === "acertado" ? "default" : "secondary"}>
                        {a.status === "acertado" ? "Acertado" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {a.entregador_id ? (
                        <Badge variant="outline" className="text-primary border-primary">
                          📱 {(a.entregadores as any)?.nome || "Entregador"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Gestão</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{(a.veiculos as any)?.placa || "-"}</TableCell>
                    <TableCell>{a.motorista}</TableCell>
                    <TableCell>{parseLocalDate(a.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{a.posto || "-"}</TableCell>
                    <TableCell>{a.nota_fiscal || "-"}</TableCell>
                    <TableCell>{Number(a.km).toLocaleString("pt-BR")} km</TableCell>
                    <TableCell>{Number(a.litros)} L</TableCell>
                    <TableCell><Badge variant="outline">{a.tipo}</Badge></TableCell>
                    <TableCell className="font-medium">R$ {Number(a.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      {a.sem_saida_caixa ? (
                        <Badge variant="outline" className="text-muted-foreground">Sem saída</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Normal</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir abastecimento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja excluir o abastecimento de {Number(a.litros)}L ({(a.veiculos as any)?.placa || "-"}) em {parseLocalDate(a.data).toLocaleDateString("pt-BR")}? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(a.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Novo Abastecimento */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Abastecimento</DialogTitle></DialogHeader>
          {/* Foto OCR */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => photoInputRef.current?.click()}
            disabled={isScanning}
          >
            {isScanning ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Lendo comprovante...</>
            ) : (
              <><Camera className="h-4 w-4" />Tirar foto do comprovante</>
            )}
          </Button>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Veículo *</Label>
              <Select value={form.veiculo_id} onValueChange={(v) => setForm({ ...form, veiculo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.placa}{v.modelo ? ` - ${v.modelo}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motorista *</Label>
              <Input value={form.motorista} onChange={(e) => setForm({ ...form, motorista: e.target.value })} placeholder="Nome do motorista" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div>
              <Label>Posto / Fornecedor</Label>
              <Input value={form.posto} onChange={(e) => setForm({ ...form, posto: e.target.value })} placeholder="Ex: Posto Shell" />
            </div>
            <div>
              <Label>Nota Fiscal</Label>
              <Input value={form.nota_fiscal} onChange={(e) => setForm({ ...form, nota_fiscal: e.target.value })} placeholder="Nº da NF" />
            </div>
            <div>
              <Label>KM Atual</Label>
              <Input type="number" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} placeholder="0" />
            </div>
            <div>
              <Label>Litros *</Label>
              <Input type="number" step="0.01" value={form.litros} onChange={(e) => setForm({ ...form, litros: e.target.value })} placeholder="0" />
            </div>
            <div>
              <Label>Tipo Combustível</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gasolina">Gasolina</SelectItem>
                  <SelectItem value="Etanol">Etanol</SelectItem>
                  <SelectItem value="Diesel">Diesel</SelectItem>
                  <SelectItem value="GNV">GNV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor Total (R$) *</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Gerar Acerto */}
      <Dialog open={showAcerto} onOpenChange={setShowAcerto}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>Gerar Acerto de Combustível</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione os abastecimentos para agrupar e enviar ao Contas a Pagar.</p>

          <div className="flex items-center gap-2 py-2">
            <Checkbox checked={selectedIds.size === pendentes.length && pendentes.length > 0} onCheckedChange={toggleAll} />
            <span className="text-sm font-medium">Selecionar todos ({pendentes.length})</span>
          </div>

          <div className="border rounded-md overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Posto</TableHead>
                  <TableHead>NF</TableHead>
                  <TableHead>Litros</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum abastecimento pendente</TableCell></TableRow>
                )}
                {pendentes.map((a) => (
                  <TableRow key={a.id} className={selectedIds.has(a.id) ? "bg-muted/50" : ""}>
                    <TableCell><Checkbox checked={selectedIds.has(a.id)} onCheckedChange={() => toggleSelect(a.id)} /></TableCell>
                    <TableCell>{parseLocalDate(a.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{(a.veiculos as any)?.placa || "-"}</TableCell>
                    <TableCell>{a.posto || "-"}</TableCell>
                    <TableCell>{a.nota_fiscal || "-"}</TableCell>
                    <TableCell>{Number(a.litros)} L</TableCell>
                    <TableCell className="font-medium">R$ {Number(a.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {selectedIds.size > 0 && (
            <div className="bg-muted/50 rounded-md p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{selectedIds.size} abastecimento(s) selecionado(s)</p>
                <p className="text-xs text-muted-foreground">
                  {abastecimentos.filter(a => selectedIds.has(a.id)).reduce((s, a) => s + Number(a.litros), 0).toFixed(1)} litros
                </p>
              </div>
              <p className="text-lg font-bold">
                R$ {abastecimentos.filter(a => selectedIds.has(a.id)).reduce((s, a) => s + Number(a.valor), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAcerto(false)}>Cancelar</Button>
            <Button onClick={gerarAcerto} disabled={gerando || selectedIds.size === 0}>
              {gerando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar Acerto e Enviar ao Contas a Pagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
