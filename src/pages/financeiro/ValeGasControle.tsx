import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useValeGas, StatusVale } from "@/contexts/ValeGasContext";
import { 
  Search, QrCode, User, MapPin, Phone, CheckCircle2, Clock,
  Package, XCircle, Filter, AlertTriangle, TrendingUp,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ValeGasQRCode } from "@/components/valegas/ValeGasQRCode";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = ["hsl(217, 91%, 60%)", "hsl(38, 92%, 50%)", "hsl(142, 71%, 45%)", "hsl(0, 84%, 60%)"];

export default function ValeGasControle({ embedded }: { embedded?: boolean } = {}) {
  const { vales, parceiros, registrarVendaConsumidor, utilizarVale, isLoading } = useValeGas();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterParceiro, setFilterParceiro] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [selectedVale, setSelectedVale] = useState<string | null>(null);
  const [vendaDialogOpen, setVendaDialogOpen] = useState(false);
  const [utilizacaoDialogOpen, setUtilizacaoDialogOpen] = useState(false);
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);
  const [qrCodeVale, setQrCodeVale] = useState<{ numero: number; codigo: string; valor: number; parceiroNome?: string } | null>(null);
  
  const [consumidorData, setConsumidorData] = useState({ nome: "", endereco: "", telefone: "" });

  const valesFiltrados = useMemo(() => {
    return vales.filter(vale => {
      if (filterParceiro !== "todos" && vale.parceiro_id !== filterParceiro) return false;
      if (filterStatus !== "todos" && vale.status !== filterStatus) return false;
      if (searchTerm) {
        const termo = searchTerm.toLowerCase();
        const matchNumero = vale.numero.toString().includes(termo);
        const matchCodigo = vale.codigo.toLowerCase().includes(termo);
        const matchConsumidor = vale.consumidor_nome?.toLowerCase().includes(termo);
        if (!matchNumero && !matchCodigo && !matchConsumidor) return false;
      }
      return true;
    });
  }, [vales, filterParceiro, filterStatus, searchTerm]);

  const estatisticas = useMemo(() => ({
    total: vales.length,
    disponiveis: vales.filter(v => v.status === "disponivel").length,
    vendidos: vales.filter(v => v.status === "vendido").length,
    utilizados: vales.filter(v => v.status === "utilizado").length,
  }), [vales]);

  // Dashboard data
  const statusChartData = useMemo(() => [
    { name: "Disponível", value: estatisticas.disponiveis },
    { name: "Vendido", value: estatisticas.vendidos },
    { name: "Utilizado", value: estatisticas.utilizados },
    { name: "Cancelado", value: vales.filter(v => v.status === "cancelado").length },
  ].filter(d => d.value > 0), [vales, estatisticas]);

  const parceiroChartData = useMemo(() => {
    const map: Record<string, { nome: string; qtd: number }> = {};
    vales.forEach(v => {
      const p = parceiros.find(p => p.id === v.parceiro_id);
      if (!p) return;
      if (!map[v.parceiro_id]) map[v.parceiro_id] = { nome: p.nome, qtd: 0 };
      map[v.parceiro_id].qtd++;
    });
    return Object.values(map);
  }, [vales, parceiros]);

  // Alerts
  const alertas = useMemo(() => {
    const alerts: { tipo: string; msg: string }[] = [];
    if (estatisticas.disponiveis < 10 && vales.length > 0) {
      alerts.push({ tipo: "warning", msg: `Estoque baixo: apenas ${estatisticas.disponiveis} vales disponíveis` });
    }
    parceiros.forEach(p => {
      const dispP = vales.filter(v => v.parceiro_id === p.id && v.status === "disponivel").length;
      if (dispP === 0 && vales.filter(v => v.parceiro_id === p.id).length > 0) {
        alerts.push({ tipo: "error", msg: `${p.nome}: sem vales disponíveis` });
      }
    });
    return alerts;
  }, [vales, parceiros, estatisticas]);

  const handleBuscarVale = () => {
    const numero = parseInt(searchTerm);
    let vale = null;
    if (!isNaN(numero)) vale = vales.find(v => v.numero === numero);
    else vale = vales.find(v => v.codigo === searchTerm);
    if (vale) {
      setSelectedVale(vale.id);
      toast.success(`Vale ${vale.numero} encontrado!`);
    } else {
      toast.error("Vale não encontrado");
    }
  };

  const handleRegistrarVenda = async () => {
    if (!selectedVale || !consumidorData.nome) {
      toast.error("Preencha os dados do consumidor");
      return;
    }
    await registrarVendaConsumidor(selectedVale, consumidorData);
    toast.success("Venda registrada!");
    setVendaDialogOpen(false);
    setConsumidorData({ nome: "", endereco: "", telefone: "" });
    setSelectedVale(null);
  };

  const handleUtilizarVale = async () => {
    if (!selectedVale) return;
    const resultado = await utilizarVale(selectedVale, "ent-demo", "Entregador Demo", "venda-demo");
    if (resultado.sucesso) toast.success(resultado.mensagem);
    else toast.error(resultado.mensagem);
    setUtilizacaoDialogOpen(false);
    setSelectedVale(null);
  };

  const getStatusIcon = (status: StatusVale) => {
    switch (status) {
      case "disponivel": return <Package className="h-4 w-4 text-blue-500" />;
      case "vendido": return <Clock className="h-4 w-4 text-amber-500" />;
      case "utilizado": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "cancelado": return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: StatusVale) => {
    switch (status) {
      case "disponivel": return <Badge variant="secondary">Disponível</Badge>;
      case "vendido": return <Badge className="bg-amber-500">Vendido</Badge>;
      case "utilizado": return <Badge className="bg-green-600">Utilizado</Badge>;
      case "cancelado": return <Badge variant="destructive">Cancelado</Badge>;
    }
  };

  const valeAtual = vales.find(v => v.id === selectedVale);
  const parceiroValeAtual = valeAtual ? parceiros.find(p => p.id === valeAtual.parceiro_id) : null;

  const content = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="space-y-2">
            {alertas.map((a, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${a.tipo === "error" ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400"}`}>
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{a.msg}</span>
              </div>
            ))}
          </div>
        )}

        {/* Cards resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10"><Package className="h-6 w-6 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{estatisticas.total}</p>
                  <p className="text-sm text-muted-foreground">Total Vales</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10"><Package className="h-6 w-6 text-blue-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{estatisticas.disponiveis}</p>
                  <p className="text-sm text-muted-foreground">Disponíveis</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10"><Clock className="h-6 w-6 text-amber-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{estatisticas.vendidos}</p>
                  <p className="text-sm text-muted-foreground">Vendidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10"><CheckCircle2 className="h-6 w-6 text-green-500" /></div>
                <div>
                  <p className="text-2xl font-bold">{estatisticas.utilizados}</p>
                  <p className="text-sm text-muted-foreground">Utilizados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos visuais */}
        {vales.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Distribuição por Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {statusChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Vales por Parceiro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={parceiroChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="qtd" name="Vales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Busca e filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Buscar Vale</CardTitle>
            <CardDescription>Digite o número ou código do vale</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Número ou código do vale"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleBuscarVale()}
                />
              </div>
              <Button onClick={handleBuscarVale} className="gap-2"><Search className="h-4 w-4" /> Buscar</Button>
            </div>
            <div className="flex gap-4 mt-4">
              <div className="w-48">
                <Select value={filterParceiro} onValueChange={setFilterParceiro}>
                  <SelectTrigger><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Parceiro" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Parceiros</SelectItem>
                    {parceiros.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos Status</SelectItem>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="vendido">Vendido</SelectItem>
                    <SelectItem value="utilizado">Utilizado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de vales */}
        <Card>
          <CardHeader><CardTitle>Vales ({valesFiltrados.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Nº</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Consumidor</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                  ) : valesFiltrados.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum vale encontrado</TableCell></TableRow>
                  ) : valesFiltrados.slice(0, 50).map(vale => {
                    const parceiro = parceiros.find(p => p.id === vale.parceiro_id);
                    return (
                      <TableRow key={vale.id}>
                        <TableCell className="font-mono font-bold">{vale.numero}</TableCell>
                        <TableCell className="font-mono text-xs">{vale.codigo}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{parceiro?.nome}</p>
                            <Badge variant="outline" className="text-xs">
                              {parceiro?.tipo === "prepago" ? "Pré-pago" : "Consignado"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {vale.consumidor_nome ? (
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium">{vale.consumidor_nome}</p>
                              {vale.consumidor_endereco && <p className="text-xs text-muted-foreground">{vale.consumidor_endereco}</p>}
                            </div>
                          ) : <span className="text-muted-foreground text-sm">-</span>}
                        </TableCell>
                        <TableCell className="text-right">R$ {Number(vale.valor).toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getStatusIcon(vale.status)}
                            {getStatusBadge(vale.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => {
                              setQrCodeVale({ numero: vale.numero, codigo: vale.codigo, valor: Number(vale.valor), parceiroNome: parceiro?.nome });
                              setQrCodeDialogOpen(true);
                            }}><QrCode className="h-4 w-4" /></Button>
                            {vale.status === "disponivel" && (
                              <Button size="sm" variant="outline" onClick={() => { setSelectedVale(vale.id); setVendaDialogOpen(true); }}>Vender</Button>
                            )}
                            {vale.status === "vendido" && (
                              <Button size="sm" onClick={() => { setSelectedVale(vale.id); setUtilizacaoDialogOpen(true); }}>Utilizar</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {valesFiltrados.length > 50 && (
                <p className="text-center text-sm text-muted-foreground py-4">Mostrando 50 de {valesFiltrados.length} vales.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dialog de venda */}
        <Dialog open={vendaDialogOpen} onOpenChange={setVendaDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Venda do Vale</DialogTitle></DialogHeader>
            {valeAtual && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-lg font-mono font-bold">Vale Nº {valeAtual.numero}</p>
                      <p className="text-sm text-muted-foreground">{parceiroValeAtual?.nome}</p>
                    </div>
                    <p className="text-xl font-bold">R$ {Number(valeAtual.valor).toFixed(2)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><User className="h-4 w-4" /> Nome do Consumidor</Label>
                  <Input value={consumidorData.nome} onChange={e => setConsumidorData(prev => ({ ...prev, nome: e.target.value }))} placeholder="Nome completo" required />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Endereço</Label>
                  <Input value={consumidorData.endereco} onChange={e => setConsumidorData(prev => ({ ...prev, endereco: e.target.value }))} placeholder="Rua, número, bairro..." />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Telefone</Label>
                  <Input value={consumidorData.telefone} onChange={e => setConsumidorData(prev => ({ ...prev, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setVendaDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleRegistrarVenda}>Registrar Venda</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de utilização */}
        <Dialog open={utilizacaoDialogOpen} onOpenChange={setUtilizacaoDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Confirmar Utilização</DialogTitle></DialogHeader>
            {valeAtual && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-lg font-mono font-bold">Vale Nº {valeAtual.numero}</p>
                      <p className="text-sm text-muted-foreground">{valeAtual.codigo}</p>
                    </div>
                    <p className="text-xl font-bold text-green-600">R$ {Number(valeAtual.valor).toFixed(2)}</p>
                  </div>
                  <div className="border-t pt-3 space-y-1">
                    <p className="text-sm"><strong>Parceiro:</strong> {parceiroValeAtual?.nome}</p>
                    <p className="text-sm"><strong>Consumidor:</strong> {valeAtual.consumidor_nome}</p>
                    <p className="text-sm"><strong>Endereço:</strong> {valeAtual.consumidor_endereco}</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setUtilizacaoDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleUtilizarVale} className="bg-green-600 hover:bg-green-700">Confirmar Utilização</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {qrCodeVale && (
          <ValeGasQRCode open={qrCodeDialogOpen} onClose={() => { setQrCodeDialogOpen(false); setQrCodeVale(null); }} vale={qrCodeVale} />
        )}
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Controle de Vales Gás" subtitle="Gerencie a numeração e status dos vales" />
      {content}
    </MainLayout>
  );
}
