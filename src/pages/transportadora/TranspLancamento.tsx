import { useState, useRef, useMemo } from "react";
import { TransportadoraLayout } from "@/components/transportadora/TransportadoraLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/transp-utils";
import { toast } from "sonner";
import { Plus, Receipt, Camera, Loader2, Sparkles, FileText, X, TrendingUp, Truck, BarChart3, Calendar, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";

const TIPOS_DESPESA = [
  { value: "combustivel", label: "Combustível" },
  { value: "manutencao", label: "Manutenção" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "salario", label: "Salários" },
  { value: "pedagio", label: "Pedágio" },
  { value: "outros", label: "Outros" },
];

type PeriodoPreset = "mes_atual" | "mes_anterior" | "ultimos_30" | "personalizado";

function rangeFromPreset(preset: PeriodoPreset, ci?: string, cf?: string) {
  const hoje = new Date();
  if (preset === "mes_atual") return { ini: format(startOfMonth(hoje), "yyyy-MM-dd"), fim: format(endOfMonth(hoje), "yyyy-MM-dd") };
  if (preset === "mes_anterior") {
    const p = subMonths(hoje, 1);
    return { ini: format(startOfMonth(p), "yyyy-MM-dd"), fim: format(endOfMonth(p), "yyyy-MM-dd") };
  }
  if (preset === "ultimos_30") return { ini: format(subDays(hoje, 30), "yyyy-MM-dd"), fim: format(hoje, "yyyy-MM-dd") };
  return { ini: ci || format(startOfMonth(hoje), "yyyy-MM-dd"), fim: cf || format(endOfMonth(hoje), "yyyy-MM-dd") };
}

export default function TranspLancamento() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [removeComprovante, setRemoveComprovante] = useState(false);
  const [existingComprovante, setExistingComprovante] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    tipo: "combustivel", descricao: "", valor: 0,
    data: format(new Date(), "yyyy-MM-dd"), veiculo_id: "", comprovante: null as File | null,
  });

  // Filtros
  const [preset, setPreset] = useState<PeriodoPreset>("mes_atual");
  const [customIni, setCustomIni] = useState("");
  const [customFim, setCustomFim] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroVeiculo, setFiltroVeiculo] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const { ini, fim } = useMemo(() => rangeFromPreset(preset, customIni, customFim), [preset, customIni, customFim]);

  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ["transp-despesas", ini, fim],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transp_despesas")
        .select("*")
        .gte("data", ini)
        .lte("data", fim)
        .order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ["transp-veiculos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transp_veiculos").select("id, placa").eq("ativo", true);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-empresa", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("empresa_id").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const placaById = useMemo(() => {
    const m: Record<string, string> = {};
    (veiculos as any[]).forEach((v) => { m[v.id] = v.placa; });
    return m;
  }, [veiculos]);

  const filtered = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (despesas as any[]).filter((d) => {
      if (filtroTipo !== "todos" && d.tipo !== filtroTipo) return false;
      if (filtroVeiculo === "sem") { if (d.veiculo_id) return false; }
      else if (filtroVeiculo !== "todos" && d.veiculo_id !== filtroVeiculo) return false;
      if (b && !(d.descricao || "").toLowerCase().includes(b)) return false;
      return true;
    });
  }, [despesas, filtroTipo, filtroVeiculo, busca]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filtered.reduce((a, d) => a + Number(d.valor || 0), 0);
    const qtd = filtered.length;
    const ticket = qtd > 0 ? total / qtd : 0;
    const maior = filtered.reduce((m, d) => (Number(d.valor) > Number(m?.valor || 0) ? d : m), null as any);
    return { total, qtd, ticket, maior };
  }, [filtered]);

  // Resumo por tipo
  const resumoTipo = useMemo(() => {
    const map: Record<string, { qtd: number; total: number }> = {};
    filtered.forEach((d) => {
      const k = d.tipo || "outros";
      if (!map[k]) map[k] = { qtd: 0, total: 0 };
      map[k].qtd += 1;
      map[k].total += Number(d.valor || 0);
    });
    const total = kpis.total || 1;
    return Object.entries(map)
      .map(([tipo, v]) => ({ tipo, ...v, pct: (v.total / total) * 100 }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, kpis.total]);

  // Resumo por veículo
  const resumoVeiculo = useMemo(() => {
    const map: Record<string, { qtd: number; total: number }> = {};
    filtered.forEach((d) => {
      const k = d.veiculo_id || "__sem__";
      if (!map[k]) map[k] = { qtd: 0, total: 0 };
      map[k].qtd += 1;
      map[k].total += Number(d.valor || 0);
    });
    return Object.entries(map)
      .map(([id, v]) => ({ id, placa: id === "__sem__" ? "Sem veículo" : (placaById[id] || "—"), ...v }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, placaById]);

  // Resumo mensal
  const resumoMensal = useMemo(() => {
    const map: Record<string, { qtd: number; total: number; porTipo: Record<string, number> }> = {};
    filtered.forEach((d) => {
      const k = (d.data || "").slice(0, 7);
      if (!map[k]) map[k] = { qtd: 0, total: 0, porTipo: {} };
      map[k].qtd += 1;
      map[k].total += Number(d.valor || 0);
      map[k].porTipo[d.tipo] = (map[k].porTipo[d.tipo] || 0) + Number(d.valor || 0);
    });
    return Object.entries(map).map(([mes, v]) => ({ mes, ...v })).sort((a, b) => b.mes.localeCompare(a.mes));
  }, [filtered]);

  const handlePhotoCapture = async (file: File) => {
    setForm(f => ({ ...f, comprovante: file }));
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setScanning(true);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("receipt-ocr", { body: { image_base64: base64 } });
      if (error) throw error;

      if (data) {
        setForm(f => ({
          ...f,
          tipo: data.tipo && TIPOS_DESPESA.some(t => t.value === data.tipo) ? data.tipo : f.tipo,
          descricao: data.descricao || f.descricao,
          valor: data.valor != null ? data.valor : f.valor,
          data: data.data || f.data,
        }));
        toast.success("✨ Despesa reconhecida automaticamente!", { description: "Confira os campos e ajuste se necessário." });
      }
    } catch (e: any) {
      console.error("OCR error:", e);
      toast.error("Não foi possível ler a foto", { description: "Preencha manualmente." });
    } finally {
      setScanning(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      let comprovante_url: string | null | undefined = undefined;
      if (form.comprovante) {
        const ext = form.comprovante.name.split(".").pop();
        const path = `${profile?.empresa_id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("transp-comprovantes").upload(path, form.comprovante);
        if (upErr) throw upErr;
        comprovante_url = path;
      } else if (editingId && removeComprovante) {
        comprovante_url = null;
      }

      if (editingId) {
        const payload: any = {
          tipo: form.tipo, descricao: form.descricao || null, valor: form.valor,
          data: form.data, veiculo_id: form.veiculo_id && form.veiculo_id !== "nenhum" ? form.veiculo_id : null,
          mes_referencia: form.data.slice(0, 7),
        };
        if (comprovante_url !== undefined) payload.comprovante_url = comprovante_url;
        const { error } = await (supabase as any).from("transp_despesas").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("transp_despesas").insert({
          empresa_id: profile?.empresa_id,
          tipo: form.tipo, descricao: form.descricao || null, valor: form.valor,
          data: form.data, veiculo_id: form.veiculo_id && form.veiculo_id !== "nenhum" ? form.veiculo_id : null,
          mes_referencia: form.data.slice(0, 7), comprovante_url: comprovante_url ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-despesas"] });
      toast.success(editingId ? "Despesa atualizada!" : "Despesa registrada!");
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("transp_despesas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-despesas"] });
      toast.success("Despesa excluída!");
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({ tipo: "combustivel", descricao: "", valor: 0, data: format(new Date(), "yyyy-MM-dd"), veiculo_id: "", comprovante: null });
    setPreviewUrl(null);
    setEditingId(null);
    setRemoveComprovante(false);
    setExistingComprovante(null);
  };

  const abrirEdicao = (d: any) => {
    setEditingId(d.id);
    setForm({
      tipo: d.tipo || "combustivel",
      descricao: d.descricao || "",
      valor: Number(d.valor) || 0,
      data: d.data || format(new Date(), "yyyy-MM-dd"),
      veiculo_id: d.veiculo_id || "",
      comprovante: null,
    });
    setExistingComprovante(d.comprovante_url || null);
    setRemoveComprovante(false);
    setPreviewUrl(null);
    setOpen(true);
  };

  const limparFiltros = () => {
    setPreset("mes_atual");
    setCustomIni(""); setCustomFim("");
    setFiltroTipo("todos"); setFiltroVeiculo("todos"); setBusca("");
  };

  const tipoLabel = (v: string) => TIPOS_DESPESA.find(t => t.value === v)?.label || v;

  const abrirComprovante = async (path: string) => {
    const { data } = await supabase.storage.from("transp-comprovantes").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <TransportadoraLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Despesas</h1>
            <p className="text-muted-foreground text-sm">
              Período: <strong>{ini}</strong> a <strong>{fim}</strong> · {kpis.qtd} lançamento(s)
            </p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Nova Despesa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editingId ? "Editar Despesa" : "Registrar Despesa"}</DialogTitle></DialogHeader>
              {editingId && existingComprovante && !previewUrl && !removeComprovante && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs">
                  <button type="button" onClick={() => abrirComprovante(existingComprovante)} className="flex items-center gap-1 text-primary hover:underline">
                    <FileText className="h-3.5 w-3.5" /> Ver comprovante atual
                  </button>
                  <button type="button" onClick={() => setRemoveComprovante(true)} className="text-destructive hover:underline">Remover</button>
                </div>
              )}

              <div className="relative">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoCapture(file);
                    e.target.value = "";
                  }}
                />

                {previewUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img src={previewUrl} alt="Comprovante" className="w-full max-h-48 object-cover" />
                    {scanning && (
                      <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium text-foreground">Analisando com IA...</p>
                        <p className="text-xs text-muted-foreground">Reconhecendo dados do comprovante</p>
                      </div>
                    )}
                    {!scanning && (
                      <div className="absolute top-2 right-2">
                        <span className="inline-flex items-center gap-1 bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded-full">
                          <Sparkles className="h-3 w-3" /> Reconhecido
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-info/40 bg-info/10 p-6 flex flex-col items-center gap-2 text-info shadow-sm shadow-info/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-info/45 hover:bg-info hover:text-info-foreground hover:shadow-md hover:shadow-info/25 active:translate-y-0 active:scale-[0.98]"
                  >
                    <div className="h-12 w-12 rounded-full bg-current/10 flex items-center justify-center">
                      <Camera className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium">Tirar foto do comprovante</p>
                    <p className="text-xs opacity-80">A IA preenche automaticamente</p>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">ou preencha manualmente</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({...form, tipo: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS_DESPESA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({...form, data: e.target.value})} /></div>
                </div>
                <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({...form, valor: +e.target.value})} /></div>
                  <div><Label>Veículo</Label>
                    <Select value={form.veiculo_id} onValueChange={(v) => setForm({...form, veiculo_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        {veiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!previewUrl && (
                  <div>
                    <Label>Comprovante (arquivo)</Label>
                    <Input type="file" accept="image/*,application/pdf" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setForm({...form, comprovante: file});
                    }} />
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={save.isPending || scanning}>
                  {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : "Registrar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtros */}
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs">Período</Label>
                <Select value={preset} onValueChange={(v) => setPreset(v as PeriodoPreset)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mes_atual">Mês atual</SelectItem>
                    <SelectItem value="mes_anterior">Mês anterior</SelectItem>
                    <SelectItem value="ultimos_30">Últimos 30 dias</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {preset === "personalizado" && (
                <>
                  <div>
                    <Label className="text-xs">De</Label>
                    <Input type="date" value={customIni} onChange={(e) => setCustomIni(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Até</Label>
                    <Input type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)} />
                  </div>
                </>
              )}
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {TIPOS_DESPESA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Veículo</Label>
                <Select value={filtroVeiculo} onValueChange={setFiltroVeiculo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sem">Sem veículo</SelectItem>
                    {veiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Buscar</Label>
                <Input placeholder="Descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1">
                <X className="h-3 w-3" /> Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-border/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total no período</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(kpis.total)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Lançamentos</p>
              <p className="text-xl font-bold text-foreground">{kpis.qtd}</p>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Ticket médio</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(kpis.ticket)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Maior despesa</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(Number(kpis.maior?.valor || 0))}</p>
              <p className="text-xs text-muted-foreground capitalize">{kpis.maior ? tipoLabel(kpis.maior.tipo) : "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Resumo por tipo + por veículo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" /> Resumo por categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resumoTipo.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem dados no recorte atual</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-[140px]">% do total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoTipo.map((r) => (
                      <TableRow key={r.tipo}>
                        <TableCell className="font-medium">{tipoLabel(r.tipo)}</TableCell>
                        <TableCell className="text-right">{r.qtd}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(r.total)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${Math.min(100, r.pct)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-10 text-right">{r.pct.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" /> Resumo por veículo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resumoVeiculo.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem dados no recorte atual</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placa</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoVeiculo.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.placa}</TableCell>
                        <TableCell className="text-right">{r.qtd}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(r.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resumo mensal (>1 mês) */}
        {resumoMensal.length > 1 && (
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" /> Resumo mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Por tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumoMensal.map((m) => (
                    <TableRow key={m.mes}>
                      <TableCell className="font-medium">{m.mes}</TableCell>
                      <TableCell className="text-right">{m.qtd}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(m.total)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(m.porTipo).sort((a, b) => b[1] - a[1]).map(([t, v]) => (
                            <Badge key={t} variant="secondary" className="text-[11px]">
                              {tipoLabel(t)}: {formatCurrency(v)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Tabela de lançamentos */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" /> Lançamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma despesa no recorte</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead className="text-center">Comp.</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">{d.data}</TableCell>
                      <TableCell className="capitalize">{tipoLabel(d.tipo)}</TableCell>
                      <TableCell className="text-muted-foreground">{d.descricao || "—"}</TableCell>
                      <TableCell>{d.veiculo_id ? (placaById[d.veiculo_id] || "—") : "—"}</TableCell>
                      <TableCell className="text-center">
                        {d.comprovante_url ? (
                          <button onClick={() => abrirComprovante(d.comprovante_url)} className="text-primary hover:underline">
                            <FileText className="h-4 w-4 inline" />
                          </button>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(Number(d.valor))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEdicao(d)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(d.id)} title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="font-semibold">Total ({kpis.qtd})</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(kpis.total)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </TransportadoraLayout>
  );
}
