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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Plus, Search, Edit, Trash2, User, Car, ExternalLink, Eye, MapPin, Fuel, WifiOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { VeiculoDetalheDialog } from "@/components/frota/VeiculoDetalheDialog";

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
}

const statusOptions = [
  { value: "ativo", label: "Ativo", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
  { value: "terceiro", label: "Terceiro", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  { value: "inativo", label: "Inativo", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
  { value: "excluido", label: "Excluído", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
];

const emptyForm = { placa: "", modelo: "", marca: "", ano: "", km_atual: "", tipo: "moto", entregador_id: "", valor_fipe: "", status: "ativo" };

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
  const { unidadeAtual } = useUnidade();

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
    const payload: any = {
      placa: form.placa.toUpperCase(),
      modelo: form.modelo,
      marca: form.marca || null,
      ano: form.ano ? parseInt(form.ano) : null,
      km_atual: form.km_atual ? parseFloat(form.km_atual) : 0,
      tipo: form.tipo || "moto",
      entregador_id: form.entregador_id || null,
      valor_fipe: form.valor_fipe ? parseFloat(form.valor_fipe) : null,
      status: form.status || "ativo",
      ativo: form.status !== "excluido",
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
      <Header title="Veículos" subtitle="Gerencie a frota de veículos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Top actions */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Tabs value={filtroStatus} onValueChange={setFiltroStatus}>
            <TabsList>
              <TabsTrigger value="todos">Todos ({veiculos.length})</TabsTrigger>
              <TabsTrigger value="ativo">Ativos ({countByStatus("ativo")})</TabsTrigger>
              <TabsTrigger value="terceiro">Terceiros ({countByStatus("terceiro")})</TabsTrigger>
              <TabsTrigger value="inativo">Inativos ({countByStatus("inativo")})</TabsTrigger>
              <TabsTrigger value="excluido">Excluídos ({countByStatus("excluido")})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Novo Veículo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Veículo" : "Cadastrar Novo Veículo"}</DialogTitle>
                <DialogDescription>Preencha os dados do veículo</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Placa *</Label>
                  <Input value={form.placa} onChange={e => setForm({...form, placa: e.target.value.toUpperCase()})} placeholder="ABC1D23" />
                </div>
                <div className="space-y-2">
                  <Label>Modelo *</Label>
                  <Input value={form.modelo} onChange={e => setForm({...form, modelo: e.target.value})} placeholder="Fiorino 1.4" />
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
                  <Input type="number" value={form.valor_fipe} onChange={e => setForm({...form, valor_fipe: e.target.value})} placeholder="25000.00" />
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
                <div className="col-span-2 space-y-2">
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
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave}>{editId ? "Atualizar" : "Salvar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">Ativos</CardTitle>
              <Car className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{countByStatus("ativo")}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">Terceiros</CardTitle>
              <ExternalLink className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{countByStatus("terceiro")}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">GPS Online</CardTitle>
              <MapPin className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{gpsOnlineCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">KM/L Médio</CardTitle>
              <Fuel className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{avgKmL > 0 ? avgKmL.toFixed(1) : "—"}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">Com Entregador</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{veiculos.filter(v => v.entregador_id && (v.status || "ativo") !== "excluido").length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">Valor FIPE</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-lg font-bold">R$ {totalFipe.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div></CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lista de Veículos</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar placa, modelo, marca..." className="pl-10 w-[280px]" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground">Carregando...</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>KM</TableHead>
                    <TableHead>KM/L</TableHead>
                    <TableHead>GPS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entregador</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(v => {
                    const gps = getGpsStatus(v.entregador_id);
                    const kmL = getKmL(v.id);
                    return (
                    <TableRow key={v.id} className={(v.status === "excluido" || v.status === "inativo") ? "opacity-60" : ""}>
                      <TableCell className="font-mono font-bold">{v.placa}</TableCell>
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
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nenhum veículo encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detalhe Dialog */}
        <VeiculoDetalheDialog
          open={!!detalheVeiculo}
          onOpenChange={(o) => { if (!o) setDetalheVeiculo(null); }}
          veiculo={detalheVeiculo}
        />
      </div>
    </MainLayout>
  );
}
