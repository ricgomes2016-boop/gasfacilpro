import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, Phone, MessageSquare, Clock, CheckCircle, AlertCircle, Search, Loader2,
  MapPin, TrendingDown, Bell, Star, Flame, Target, TrendingUp, BarChart3,
  UserCheck, Filter, ChevronRight, Crown, Zap, AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { ClienteHeatMap } from "@/components/clientes/ClienteHeatMap";
import { ChurnAnalysis } from "@/components/clientes/ChurnAnalysis";
import { ReguaRelacionamento } from "@/components/clientes/ReguaRelacionamento";
import { useNavigate } from "react-router-dom";

interface ClienteComScore extends Record<string, any> {
  score: number;
  tier: "vip" | "ativo" | "em_risco" | "inativo";
  diasSemCompra: number;
}

const calcularScore = (cliente: any, pedidos: any[]): ClienteComScore => {
  const pedidosCliente = pedidos.filter(p => p.cliente_id === cliente.id);
  const totalGasto = pedidosCliente.reduce((s, p) => s + (p.valor_total || 0), 0);
  const qtdPedidos = pedidosCliente.length;

  const ultimoPedido = pedidosCliente.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  const diasSemCompra = ultimoPedido
    ? Math.floor((Date.now() - new Date(ultimoPedido.created_at).getTime()) / 86400000)
    : 999;

  // Score: frequência (40%) + valor (40%) + recência (20%)
  const freqScore = Math.min(40, qtdPedidos * 2);
  const valorScore = Math.min(40, totalGasto / 50);
  const recenciaScore = diasSemCompra < 15 ? 20 : diasSemCompra < 30 ? 15 : diasSemCompra < 60 ? 8 : 0;
  const score = Math.round(freqScore + valorScore + recenciaScore);

  let tier: ClienteComScore["tier"] = "inativo";
  if (score >= 70) tier = "vip";
  else if (score >= 40) tier = "ativo";
  else if (score >= 20) tier = "em_risco";

  return { ...cliente, score, tier, diasSemCompra, totalGasto, qtdPedidos };
};

const tierConfig = {
  vip: { label: "VIP", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30", icon: Crown },
  ativo: { label: "Ativo", color: "bg-green-500/10 text-green-600 border-green-500/30", icon: CheckCircle },
  em_risco: { label: "Em Risco", color: "bg-orange-500/10 text-orange-600 border-orange-500/30", icon: AlertTriangle },
  inativo: { label: "Inativo", color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertCircle },
};

type Etapa = { id: string; label: string; cor: string; clientes: ClienteComScore[] };

export default function CRM() {
  const { empresa } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteComScore[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroTier, setFiltroTier] = useState<string>("todos");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let clientesQ = supabase.from("clientes").select("*").eq("ativo", true).order("nome").limit(200);
        if (empresa?.id) clientesQ = clientesQ.eq("empresa_id", empresa.id);
        const [{ data: clientesData }, { data: pedidosData }] = await Promise.all([
          clientesQ,
          supabase.from("pedidos").select("id, cliente_id, valor_total, created_at").eq("status", "entregue").limit(1000),
        ]);
        const scored = (clientesData || []).map(c => calcularScore(c, pedidosData || []));
        setClientes(scored);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const filtered = clientes.filter(c => {
    const matchBusca = !busca || c.nome?.toLowerCase().includes(busca.toLowerCase()) || c.telefone?.includes(busca);
    const matchTier = filtroTier === "todos" || c.tier === filtroTier;
    return matchBusca && matchTier;
  }).sort((a, b) => b.score - a.score);

  const etapas: Etapa[] = [
    { id: "vip", label: "VIP 👑", cor: "border-yellow-400 bg-yellow-500/5", clientes: clientes.filter(c => c.tier === "vip") },
    { id: "ativo", label: "Ativo ✅", cor: "border-green-400 bg-green-500/5", clientes: clientes.filter(c => c.tier === "ativo") },
    { id: "em_risco", label: "Em Risco ⚠️", cor: "border-orange-400 bg-orange-500/5", clientes: clientes.filter(c => c.tier === "em_risco") },
    { id: "inativo", label: "Inativo 💤", cor: "border-destructive/40 bg-destructive/5", clientes: clientes.filter(c => c.tier === "inativo") },
  ];

  const stats = {
    total: clientes.length,
    vip: clientes.filter(c => c.tier === "vip").length,
    emRisco: clientes.filter(c => c.tier === "em_risco").length,
    inativo: clientes.filter(c => c.tier === "inativo").length,
    ticketMedio: clientes.length > 0
      ? clientes.reduce((s, c) => s + (c.totalGasto || 0), 0) / clientes.filter(c => c.qtdPedidos > 0).length || 0
      : 0,
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="CRM Avançado" subtitle="Gestão inteligente de relacionamento com clientes" />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="CRM Avançado" subtitle="Scoring, funil e automação de relacionamento" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total Clientes</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10"><Crown className="h-5 w-5 text-yellow-500" /></div>
                <div><p className="text-2xl font-bold">{stats.vip}</p><p className="text-xs text-muted-foreground">Clientes VIP</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10"><AlertTriangle className="h-5 w-5 text-orange-500" /></div>
                <div><p className="text-2xl font-bold">{stats.emRisco}</p><p className="text-xs text-muted-foreground">Em Risco</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><AlertCircle className="h-5 w-5 text-destructive" /></div>
                <div><p className="text-2xl font-bold">{stats.inativo}</p><p className="text-xs text-muted-foreground">Inativos</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="h-5 w-5 text-green-500" /></div>
                <div><p className="text-2xl font-bold">R$ {stats.ticketMedio.toFixed(0)}</p><p className="text-xs text-muted-foreground">Ticket Médio</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="funil" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="funil"><Target className="h-4 w-4 mr-1.5" />Funil de Clientes</TabsTrigger>
            <TabsTrigger value="scoring"><Star className="h-4 w-4 mr-1.5" />Scoring</TabsTrigger>
            <TabsTrigger value="mapa"><MapPin className="h-4 w-4 mr-1.5" />Mapa</TabsTrigger>
            <TabsTrigger value="regua"><Bell className="h-4 w-4 mr-1.5" />Régua</TabsTrigger>
            <TabsTrigger value="churn"><TrendingDown className="h-4 w-4 mr-1.5" />Churn</TabsTrigger>
          </TabsList>

          {/* FUNIL */}
          <TabsContent value="funil">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {etapas.map((etapa) => (
                <div key={etapa.id} className={`rounded-xl border-2 ${etapa.cor} p-4 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{etapa.label}</h3>
                    <Badge variant="outline">{etapa.clientes.length}</Badge>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {etapa.clientes.slice(0, 8).map(c => (
                      <button
                        key={c.id}
                        onClick={() => navigate(`/clientes/${c.id}`)}
                        className="w-full text-left p-2 bg-background rounded-lg border hover:border-primary/50 transition-colors"
                      >
                        <p className="font-medium text-xs truncate">{c.nome}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground">{c.diasSemCompra}d sem compra</span>
                          <span className="text-[10px] font-bold text-primary">{c.score}pts</span>
                        </div>
                      </button>
                    ))}
                    {etapa.clientes.length > 8 && (
                      <p className="text-xs text-center text-muted-foreground">+{etapa.clientes.length - 8} clientes</p>
                    )}
                    {etapa.clientes.length === 0 && (
                      <p className="text-xs text-center text-muted-foreground py-4">Nenhum cliente</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* SCORING */}
          <TabsContent value="scoring">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base">Ranking de Clientes por Score</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar cliente..." className="pl-8 w-48" value={busca} onChange={e => setBusca(e.target.value)} />
                    </div>
                    <select
                      className="border rounded-md px-3 py-1.5 text-sm bg-background"
                      value={filtroTier}
                      onChange={e => setFiltroTier(e.target.value)}
                    >
                      <option value="todos">Todos os tiers</option>
                      <option value="vip">VIP</option>
                      <option value="ativo">Ativo</option>
                      <option value="em_risco">Em Risco</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead>Total Gasto</TableHead>
                      <TableHead>Último Pedido</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado</TableCell></TableRow>
                    )}
                    {filtered.slice(0, 50).map((c, i) => {
                      const TierIcon = tierConfig[c.tier].icon;
                      return (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/clientes/${c.id}`)}>
                          <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{c.nome}</p>
                              <p className="text-xs text-muted-foreground">{c.telefone || "Sem telefone"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${tierConfig[c.tier].color}`}>
                              <TierIcon className="h-3 w-3 mr-1" />
                              {tierConfig[c.tier].label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <Progress value={c.score} className="h-2 flex-1" />
                              <span className="text-xs font-bold w-8">{c.score}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{c.qtdPedidos}</TableCell>
                          <TableCell className="text-sm font-medium">R$ {(c.totalGasto || 0).toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`text-xs ${c.diasSemCompra > 60 ? "text-destructive" : c.diasSemCompra > 30 ? "text-orange-500" : "text-green-600"}`}>
                              {c.diasSemCompra === 999 ? "Nunca" : `${c.diasSemCompra}d atrás`}
                            </span>
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mapa"><ClienteHeatMap /></TabsContent>
          <TabsContent value="regua"><ReguaRelacionamento /></TabsContent>
          <TabsContent value="churn"><ChurnAnalysis /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
