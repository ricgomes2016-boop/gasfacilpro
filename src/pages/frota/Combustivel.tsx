import { useEffect, useMemo, useState, useRef } from "react";
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

interface Entregador {
  id: string;
  nome: string;
}

const MOTORISTA_LIVRE_PREFIX = "livre:";
const TIPOS_COMBUSTIVEL = ["Gasolina", "Etanol", "Diesel", "GNV"];

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
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);

  // Filtros novos
  const [filtroVeiculo, setFiltroVeiculo] = useState<string>("todos");
  const [filtroMotorista, setFiltroMotorista] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    veiculo_id: "",
    entregador_id: "" as string, // "" = digitar livre
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

      let entQ = supabase.from("entregadores").select("id, nome").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) entQ = entQ.eq("unidade_id", unidadeAtual.id);
      const [{ count }, { data: veiculosData }, { data: entregData }] = await Promise.all([
        supabase.from("veiculos").select("id", { count: "exact" }).eq("ativo", true),
        supabase.from("veiculos").select("id, placa, modelo").eq("ativo", true).order("placa"),
        entQ,
      ]);
      setVeiculosAtivos(count || 0);
      setVeiculos(veiculosData || []);
      setEntregadores((entregData as any) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Lista de motoristas legados (sem entregador_id) presentes nos dados
  const motoristasLegado = useMemo(() => {
    const set = new Set<string>();
    abastecimentos.forEach((a: any) => {
      if (!a.entregador_id && a.motorista) set.add(a.motorista.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [abastecimentos]);

  const filtered = useMemo(() => abastecimentos.filter((a) => {
    const matchBusca = !busca ||
      (a.veiculos as any)?.placa?.toLowerCase().includes(busca.toLowerCase()) ||
      a.motorista?.toLowerCase().includes(busca.toLowerCase()) ||
      a.posto?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "todos" || a.status === filtroStatus;
    const matchDataInicio = !dataInicio || a.data >= dataInicio;
    const matchDataFim = !dataFim || a.data <= dataFim;
    const matchVeiculo = filtroVeiculo === "todos" || a.veiculo_id === filtroVeiculo;
    const matchTipo = filtroTipo === "todos" || a.tipo === filtroTipo;
    let matchMotorista = true;
    if (filtroMotorista !== "todos") {
      if (filtroMotorista.startsWith(MOTORISTA_LIVRE_PREFIX)) {
        const nome = filtroMotorista.slice(MOTORISTA_LIVRE_PREFIX.length);
        matchMotorista = !a.entregador_id && (a.motorista || "").trim() === nome;
      } else {
        matchMotorista = a.entregador_id === filtroMotorista;
      }
    }
    return matchBusca && matchStatus && matchDataInicio && matchDataFim && matchVeiculo && matchTipo && matchMotorista;
  }), [abastecimentos, busca, filtroStatus, dataInicio, dataFim, filtroVeiculo, filtroTipo, filtroMotorista]);

  const hasFiltro = filtroVeiculo !== "todos" || filtroMotorista !== "todos" || filtroTipo !== "todos" || !!dataInicio || !!dataFim || filtroStatus !== "todos" || !!busca;

  const limparFiltros = () => {
    setFiltroVeiculo("todos"); setFiltroMotorista("todos"); setFiltroTipo("todos");
    setDataInicio(""); setDataFim(""); setFiltroStatus("todos"); setBusca("");
  };

  // KPIs reativos ao recorte filtrado
  const totalValorFiltrado = useMemo(() => filtered.reduce((s, a) => s + Number(a.valor), 0), [filtered]);
  const totalLitrosFiltrado = useMemo(() => filtered.reduce((s, a) => s + Number(a.litros), 0), [filtered]);
  const mediaPorLitro = totalLitrosFiltrado > 0 ? totalValorFiltrado / totalLitrosFiltrado : 0;

  // Km/L estimado: precisa de veículo selecionado, ordena por km crescente e calcula deltas
  const kmPorLitro = useMemo(() => {
    if (filtroVeiculo === "todos") return null;
    const lista = [...filtered].filter(a => Number(a.km) > 0).sort((a, b) => Number(a.km) - Number(b.km));
    if (lista.length < 2) return null;
    let kmTotal = 0; let litrosEntre = 0;
    for (let i = 1; i < lista.length; i++) {
      const dKm = Number(lista[i].km) - Number(lista[i - 1].km);
      if (dKm > 0 && dKm < 5000) { // descarta outliers
        kmTotal += dKm;
        litrosEntre += Number(lista[i].litros);
      }
    }
    return litrosEntre > 0 ? kmTotal / litrosEntre : null;
  }, [filtered, filtroVeiculo]);

  // Resumo mensal (agrupado por ano-mês) considerando o recorte filtrado
  const resumoMensal = useMemo(() => {
    const map = new Map<string, { litros: number; valor: number; qtd: number; porTipo: Record<string, number> }>();
    filtered.forEach((a: any) => {
      const d = parseLocalDate(a.data);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(key) || { litros: 0, valor: 0, qtd: 0, porTipo: {} };
      cur.litros += Number(a.litros) || 0;
      cur.valor += Number(a.valor) || 0;
      cur.qtd += 1;
      cur.porTipo[a.tipo] = (cur.porTipo[a.tipo] || 0) + (Number(a.litros) || 0);
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([k, v]) => {
        const [y, m] = k.split("-");
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        return { key: k, label, ...v };
      });
  }, [filtered]);

  const filtrosLabel = useMemo(() => {
    const parts: string[] = [];
    if (filtroVeiculo !== "todos") {
      const v = veiculos.find(x => x.id === filtroVeiculo);
      if (v) parts.push(`Veículo: ${v.placa}${v.modelo ? " - " + v.modelo : ""}`);
    }
    if (filtroMotorista !== "todos") {
      if (filtroMotorista.startsWith(MOTORISTA_LIVRE_PREFIX)) {
        parts.push(`Motorista: ${filtroMotorista.slice(MOTORISTA_LIVRE_PREFIX.length)}`);
      } else {
        const e = entregadores.find(x => x.id === filtroMotorista);
        if (e) parts.push(`Motorista: ${e.nome}`);
      }
    }
    if (filtroTipo !== "todos") parts.push(`Tipo: ${filtroTipo}`);
    if (filtroStatus !== "todos") parts.push(`Status: ${filtroStatus}`);
    return parts.join(" • ");
  }, [filtroVeiculo, filtroMotorista, filtroTipo, filtroStatus, veiculos, entregadores]);

  const gerarPDF = () => {
    const totalVal = totalValorFiltrado;
    const totalLit = totalLitrosFiltrado;
    const _esc = (v: unknown) => v === null || v === undefined ? "" : String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const filtrosHtml = filtrosLabel ? `<p style="margin-top:0;color:#555">${_esc(filtrosLabel)}</p>` : "";
    const printContent = `<html><head><title>Relatório Combustível</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}h2{text-align:center;margin-bottom:6px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f5f5f5;font-weight:bold}.total{font-weight:bold;font-size:14px;margin-top:15px}</style></head><body><h2>Relatório de Combustível</h2><p>Período: ${dataInicio ? parseLocalDate(dataInicio).toLocaleDateString("pt-BR") : "Início"} a ${dataFim ? parseLocalDate(dataFim).toLocaleDateString("pt-BR") : "Hoje"} | Total: ${filtered.length} registros</p>${filtrosHtml}<table><thead><tr><th>Data</th><th>Veículo</th><th>Motorista</th><th>Litros</th><th>Tipo</th><th>Valor</th><th>Posto</th><th>NF</th><th>Status</th></tr></thead><tbody>${filtered.map(a => `<tr><td>${parseLocalDate(a.data).toLocaleDateString("pt-BR")}</td><td>${_esc((a.veiculos as any)?.placa || "-")}</td><td>${_esc((a.entregadores as any)?.nome || a.motorista || "-")}</td><td>${Number(a.litros)}L</td><td>${_esc(a.tipo)}</td><td>R$ ${Number(a.valor).toFixed(2)}</td><td>${_esc(a.posto || "-")}</td><td>${_esc(a.nota_fiscal || "-")}</td><td>${a.status === "acertado" ? "Acertado" : "Pendente"}</td></tr>`).join("")}</tbody></table><p class="total">Total: R$ ${totalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} | ${totalLit.toFixed(1)}L | Média R$/L: R$ ${mediaPorLitro.toFixed(2)}${kmPorLitro ? ` | Km/L: ${kmPorLitro.toFixed(2)}` : ""}</p></body></html>`;
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
        entregador_id: form.entregador_id || null,
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
      setForm({ veiculo_id: "", entregador_id: "", motorista: "", data: getBrasiliaDateString(), km: "", litros: "", tipo: "Gasolina", valor: "", posto: "", nota_fiscal: "" });
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{hasFiltro ? "Gasto Filtrado" : "Gasto Mensal"}</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">R$ {(hasFiltro ? totalValorFiltrado : gastoMensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><p className="text-xs text-muted-foreground">{hasFiltro ? `${filtered.length} registro(s)` : "Este mês"}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Litros Consumidos</CardTitle><Fuel className="h-4 w-4 text-orange-600" /></CardHeader>
            <CardContent><div className="text-2xl font-bold text-orange-600">{(hasFiltro ? totalLitrosFiltrado : litrosMensal).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} L</div><p className="text-xs text-muted-foreground">{hasFiltro ? `Média R$/L: R$ ${mediaPorLitro.toFixed(2)}` : "Este mês"}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pendentes Acerto</CardTitle><Receipt className="h-4 w-4 text-yellow-600" /></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendentes.length}</div>
              <p className="text-xs text-muted-foreground">R$ {pendentes.reduce((s, a) => s + Number(a.valor), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{filtroVeiculo !== "todos" && kmPorLitro != null ? "Km/L Estimado" : "Veículos Ativos"}</CardTitle><Truck className="h-4 w-4 text-blue-600" /></CardHeader>
            <CardContent>
              {filtroVeiculo !== "todos" && kmPorLitro != null ? (
                <><div className="text-2xl font-bold text-blue-600">{kmPorLitro.toFixed(2)}</div><p className="text-xs text-muted-foreground">km por litro</p></>
              ) : (
                <><div className="text-2xl font-bold text-blue-600">{veiculosAtivos}</div><p className="text-xs text-muted-foreground">Na frota</p></>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filtros: Veículo / Motorista / Tipo */}
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> Veículo</Label>
                  <Select value={filtroVeiculo} onValueChange={setFiltroVeiculo}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os veículos</SelectItem>
                      {veiculos.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.placa}{v.modelo ? ` - ${v.modelo}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Filter className="h-3 w-3" /> Motorista</Label>
                  <Select value={filtroMotorista} onValueChange={setFiltroMotorista}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os motoristas</SelectItem>
                      {entregadores.length > 0 && (
                        <>
                          {entregadores.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                          ))}
                        </>
                      )}
                      {motoristasLegado.map(nome => (
                        <SelectItem key={`l-${nome}`} value={`${MOTORISTA_LIVRE_PREFIX}${nome}`}>{nome} <span className="text-muted-foreground text-xs">(livre)</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1"><Fuel className="h-3 w-3" /> Combustível</Label>
                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os tipos</SelectItem>
                      {TIPOS_COMBUSTIVEL.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {hasFiltro && (
                <Button variant="outline" size="sm" onClick={limparFiltros} className="shrink-0">Limpar filtros</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resumo Mensal por Despesa */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Resumo Mensal de Combustível</CardTitle>
              <span className="text-xs text-muted-foreground">{filtrosLabel || "Todos os registros"}</span>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {resumoMensal.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">Sem dados no recorte atual</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Abastecimentos</TableHead>
                      <TableHead className="text-right">Litros</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Média R$/L</TableHead>
                      <TableHead>Por tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoMensal.map((r) => (
                      <TableRow key={r.key}>
                        <TableCell className="font-medium capitalize">{r.label}</TableCell>
                        <TableCell className="text-right">{r.qtd}</TableCell>
                        <TableCell className="text-right font-semibold text-orange-600">{r.litros.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L</TableCell>
                        <TableCell className="text-right font-semibold">R$ {r.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">R$ {(r.litros > 0 ? r.valor / r.litros : 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(r.porTipo).map(([t, l]) => (
                              <Badge key={t} variant="outline" className="text-xs">{t}: {l.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}L</Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Histórico de Abastecimentos</CardTitle>
              <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                  <div>
                    <Label className="text-xs text-muted-foreground">De:</Label>
                    <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Até:</Label>
                    <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select value={filtroStatus} onValueChange={(v: any) => setFiltroStatus(v)}>
                    <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pendente">Pendentes</SelectItem>
                      <SelectItem value="acertado">Acertados</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Buscar..." className="pl-10 w-full sm:w-[200px]" value={busca} onChange={(e) => setBusca(e.target.value)} />
                  </div>
                  <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={gerarPDF}>
                    <FileText className="h-4 w-4" /> PDF
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhum abastecimento encontrado</p>}
              {filtered.map((a) => (
                <div key={a.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{(a.veiculos as any)?.placa || "-"} <span className="text-muted-foreground font-normal">• {a.motorista}</span></p>
                      <p className="text-xs text-muted-foreground">{a.posto || "—"} • {parseLocalDate(a.data).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir abastecimento?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => handleDelete(a.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={a.status === "acertado" ? "default" : "secondary"} className="text-xs">{a.status === "acertado" ? "Acertado" : "Pendente"}</Badge>
                      <Badge variant="outline" className="text-xs">{a.tipo}</Badge>
                      <span className="text-xs text-muted-foreground">{Number(a.litros)}L</span>
                    </div>
                    <span className="font-bold text-sm">R$ {Number(a.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
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
                      <TableCell><Badge variant={a.status === "acertado" ? "default" : "secondary"}>{a.status === "acertado" ? "Acertado" : "Pendente"}</Badge></TableCell>
                      <TableCell>{a.entregador_id ? <Badge variant="outline" className="text-primary border-primary">📱 {(a.entregadores as any)?.nome || "Entregador"}</Badge> : <span className="text-xs text-muted-foreground">Gestão</span>}</TableCell>
                      <TableCell className="font-medium">{(a.veiculos as any)?.placa || "-"}</TableCell>
                      <TableCell>{(a.entregadores as any)?.nome || a.motorista}</TableCell>
                      <TableCell>{parseLocalDate(a.data).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{a.posto || "-"}</TableCell>
                      <TableCell>{a.nota_fiscal || "-"}</TableCell>
                      <TableCell>{Number(a.km).toLocaleString("pt-BR")} km</TableCell>
                      <TableCell>{Number(a.litros)} L</TableCell>
                      <TableCell><Badge variant="outline">{a.tipo}</Badge></TableCell>
                      <TableCell className="font-medium">R$ {Number(a.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{a.sem_saida_caixa ? <Badge variant="outline" className="text-muted-foreground">Sem saída</Badge> : <span className="text-xs text-muted-foreground">Normal</span>}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir abastecimento?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => handleDelete(a.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length > 0 && (
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={8} className="text-right text-sm">Totais ({filtered.length} registro{filtered.length > 1 ? "s" : ""}):</TableCell>
                      <TableCell className="text-sm">{totalLitrosFiltrado.toFixed(1)} L</TableCell>
                      <TableCell />
                      <TableCell className="text-sm">R$ {totalValorFiltrado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell colSpan={2} className="text-xs text-muted-foreground">Média R$/L: R$ {mediaPorLitro.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
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
            variant="photo"
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
              <Select
                value={form.entregador_id || "_livre"}
                onValueChange={(v) => {
                  if (v === "_livre") {
                    setForm({ ...form, entregador_id: "", motorista: "" });
                  } else {
                    const ent = entregadores.find(e => e.id === v);
                    setForm({ ...form, entregador_id: v, motorista: ent?.nome || "" });
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {entregadores.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                  <SelectItem value="_livre">Outro (digitar)</SelectItem>
                </SelectContent>
              </Select>
              {!form.entregador_id && (
                <Input
                  className="mt-2"
                  value={form.motorista}
                  onChange={(e) => setForm({ ...form, motorista: e.target.value })}
                  placeholder="Nome do motorista"
                />
              )}
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
