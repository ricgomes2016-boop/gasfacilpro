import { useEffect, useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin, Truck, RefreshCw, Clock, Package, AlertTriangle, CheckCircle,
  Maximize2, Minimize2, Radio, Phone, WifiOff, Route, EyeOff, Activity, Boxes,
} from "lucide-react";
import { DeliveryRoutesMap, Entregador, ClienteEntrega, PercursoPonto } from "@/components/mapa/DeliveryRoutesMap";
import { NearestDriversPanel } from "@/components/mapa/NearestDriversPanel";
import { TrilhaPolyline } from "@/components/operacional/mapa/TrilhaPolyline";
import { ParadasLayer } from "@/components/operacional/mapa/ParadasLayer";
import { PainelLateral } from "@/components/operacional/mapa/PainelLateral";
import { useMapaOperacionalData } from "@/hooks/useMapaOperacionalData";
import { useOperacional } from "@/hooks/useOperacional";
import { useEntregadorPresenca, type Presenca } from "@/hooks/useEntregadorPresenca";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { cn } from "@/lib/utils";

const PRESENCE_COLOR: Record<Presenca, string> = {
  em_rota: "bg-chart-3 animate-pulse",
  online: "bg-primary",
  instavel: "bg-warning",
  offline: "bg-muted-foreground/50",
};

const PRESENCE_BADGE: Record<Presenca, { label: string; variant: any }> = {
  em_rota: { label: "Em Rota", variant: "default" },
  online: { label: "Online", variant: "secondary" },
  instavel: { label: "GPS instável", variant: "outline" },
  offline: { label: "Offline", variant: "outline" },
};

export default function MapaOperacional() {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const [selectedEntregador, setSelectedEntregador] = useState<string | null>(null);
  const [showPercurso, setShowPercurso] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [mostrarOffline, setMostrarOffline] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<ClienteEntrega | null>(null);
  const [routeToClienteLine, setRouteToClienteLine] = useState<[number, number][]>([]);
  const [percurso, setPercurso] = useState<PercursoPonto[]>([]);

  // Fonte única de verdade — escopada por empresa+unidade
  const {
    entregadores: ents, pedidos: peds, pontosCache,
    rotasAtivasPorEntregador, refresh,
  } = useMapaOperacionalData({ unidadeId: unidadeAtual?.id, empresaId: empresa?.id });
  const dadosOp = useOperacional(ents, peds, pontosCache);
  const presencaMap = useEntregadorPresenca(ents, rotasAtivasPorEntregador, pontosCache);

  // Atualização do timestamp visual
  useEffect(() => { setLastUpdate(new Date()); }, [ents, peds]);

  // Coordenadas da unidade para centrar mapa
  useEffect(() => {
    const fetchUnidadeCoords = async () => {
      if (!unidadeAtual?.id) return;
      const { data } = await supabase
        .from("unidades")
        .select("latitude, longitude")
        .eq("id", unidadeAtual.id)
        .single();
      if (data?.latitude && data?.longitude) {
        setMapCenter([data.latitude, data.longitude]);
      }
    };
    fetchUnidadeCoords();
  }, [unidadeAtual]);

  // Percurso do entregador selecionado
  useEffect(() => {
    if (!selectedEntregador || !showPercurso) { setPercurso([]); return; }
    const fetchPercurso = async () => {
      const rotaId = rotasAtivasPorEntregador[selectedEntregador];
      if (!rotaId) { setPercurso([]); return; }
      const { data: historico } = await supabase
        .from("rota_historico")
        .select("latitude, longitude, timestamp")
        .eq("rota_id", rotaId)
        .order("timestamp", { ascending: true });
      setPercurso(
        (historico || []).map(h => ({
          lat: h.latitude, lng: h.longitude,
          hora: new Date(h.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        }))
      );
    };
    fetchPercurso();
  }, [selectedEntregador, showPercurso, rotasAtivasPorEntregador]);

  // KPIs derivados de presença real
  const kpis = useMemo(() => {
    const arr = Object.values(presencaMap);
    return {
      emRota: arr.filter(p => p.presenca === "em_rota").length,
      online: arr.filter(p => p.presenca === "online").length,
      instavel: arr.filter(p => p.presenca === "instavel").length,
      offline: arr.filter(p => p.presenca === "offline").length,
      pendentes: peds.filter(p => p.status === "pendente").length,
    };
  }, [presencaMap, peds]);

  // Alertas inteligentes
  const alertas = useMemo(() => {
    const a: string[] = [];
    if (kpis.pendentes > 5) a.push(`${kpis.pendentes} pedidos aguardando atribuição`);
    if (kpis.online === 0 && kpis.emRota === 0 && kpis.pendentes > 0)
      a.push("Nenhum entregador online!");
    const emRotaLonge = peds.filter(p => {
      if (p.status !== "em_rota") return false;
      return Date.now() - new Date(p.created_at).getTime() > 45 * 60 * 1000;
    });
    if (emRotaLonge.length > 0) a.push(`${emRotaLonge.length} entrega(s) há mais de 45min`);
    // Entregadores marcados em_rota mas offline (bug clássico)
    const fantasmas = ents.filter(e => e.status === "em_rota" && presencaMap[e.id]?.presenca === "offline");
    if (fantasmas.length > 0) a.push(`${fantasmas.length} entregador(es) marcados em rota sem GPS — verificar app`);
    return a;
  }, [kpis, peds, ents, presencaMap]);

  // Markers no mapa: só quem tem GPS, esmaecido se instável, oculto se offline
  const entregadoresMapa: Entregador[] = useMemo(() => {
    return ents.filter(e => e.latitude && e.longitude).map((e) => {
      const pres = presencaMap[e.id];
      const diffMs = e.updated_at ? Date.now() - new Date(e.updated_at).getTime() : Infinity;
      const diffMin = Math.floor(diffMs / 60000);
      const ultimaAtt = diffMin < 1 ? "agora" : diffMin < 60 ? `há ${diffMin}min` : `há ${Math.floor(diffMin / 60)}h`;
      return {
        id: e.id, nome: e.nome,
        status: pres?.presenca === "em_rota" ? "em_rota" : "disponivel",
        lat: e.latitude!, lng: e.longitude!,
        ultimaAtualizacao: ultimaAtt,
        updatedAt: e.updated_at,
      } as Entregador;
    }).filter(e => {
      const pres = presencaMap[e.id];
      return pres?.presenca !== "offline"; // não mostra offline no mapa
    });
  }, [ents, presencaMap]);

  // Clientes (entregas) no mapa
  const clientesMapa: ClienteEntrega[] = useMemo(() => peds.map((p) => {
    const lat = p.latitude || (p.clientes as any)?.latitude;
    const lng = p.longitude || (p.clientes as any)?.longitude;
    if (!lat || !lng) return null;
    return {
      id: p.id,
      cliente: (p.clientes as any)?.nome || "Cliente",
      endereco: p.endereco_entrega || (p.clientes as any)?.endereco || "",
      lat, lng,
      status: p.status,
      entregadorId: p.entregador_id || undefined,
      horarioPrevisto: new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
  }).filter(Boolean) as ClienteEntrega[], [peds]);

  // Produtos em trânsito (agregado dos pedidos em rota)
  const produtosTransito = useMemo(() => {
    const acc: Record<string, { qtd: number; entregadores: Set<string> }> = {};
    peds.filter(p => p.status === "em_rota" || p.status === "saiu_entrega").forEach((p: any) => {
      (p.pedido_itens || []).forEach((it: any) => {
        const nome = it.produtos?.nome || "Item";
        const key = nome;
        if (!acc[key]) acc[key] = { qtd: 0, entregadores: new Set() };
        acc[key].qtd += Number(it.quantidade || 0);
        if (p.entregador_id) acc[key].entregadores.add(p.entregador_id);
      });
    });
    return Object.entries(acc)
      .map(([nome, v]) => ({ nome, qtd: v.qtd, entregadores: v.entregadores.size }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [peds]);

  // Saúde do rastreamento
  const saude = useMemo(() => {
    const total = ents.length;
    const pingRecente = Object.values(presencaMap).filter(p => p.ultimoPingMs < 5 * 60 * 1000).length;
    const offline24h = Object.values(presencaMap).filter(p => p.ultimoPingMs > 24 * 60 * 60 * 1000).length;
    const ultimosPings = Object.values(presencaMap)
      .map(p => p.ultimoPingMs)
      .filter(ms => isFinite(ms));
    const ultimoGlobal = ultimosPings.length ? Math.min(...ultimosPings) : Infinity;
    return {
      total, pingRecente, offline24h,
      pctSaudavel: total ? Math.round((pingRecente / total) * 100) : 0,
      ultimoGlobalMin: isFinite(ultimoGlobal) ? Math.round(ultimoGlobal / 60000) : null,
    };
  }, [ents, presencaMap]);

  const pedidosFiltrados = filtroStatus === "todos" ? peds : peds.filter(p => p.status === filtroStatus);

  const tempoDesdeUpdate = () => {
    const diff = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
    if (diff < 60) return `${diff}s atrás`;
    return `${Math.floor(diff / 60)}min atrás`;
  };

  const handleSelectRoute = (entregadorMapId: string) => {
    const entregador = entregadoresMapa.find(e => e.id === entregadorMapId);
    if (!entregador || !selectedCliente) return;
    setSelectedEntregador(entregadorMapId);
    setRouteToClienteLine([
      [entregador.lat, entregador.lng],
      [selectedCliente.lat, selectedCliente.lng],
    ]);
  };

  const handleSelectCliente = (cliente: ClienteEntrega | null) => {
    setSelectedCliente(cliente);
    if (!cliente) setRouteToClienteLine([]);
  };

  // Entregadores listados (com toggle "Mostrar offline")
  const entregadoresListados = useMemo(() => {
    return ents.filter(e => {
      const pres = presencaMap[e.id];
      if (!pres) return false;
      return mostrarOffline || pres.presenca !== "offline";
    });
  }, [ents, presencaMap, mostrarOffline]);

  // Itens carregados pelo entregador selecionado
  const itensDoSelecionado = useMemo(() => {
    if (!selectedEntregador) return [];
    const acc: Record<string, number> = {};
    peds.filter(p => p.entregador_id === selectedEntregador && (p.status === "em_rota" || p.status === "saiu_entrega"))
      .forEach((p: any) => {
        (p.pedido_itens || []).forEach((it: any) => {
          const nome = it.produtos?.nome || "Item";
          acc[nome] = (acc[nome] || 0) + Number(it.quantidade || 0);
        });
      });
    return Object.entries(acc).map(([nome, qtd]) => ({ nome, qtd }));
  }, [selectedEntregador, peds]);

  if (!unidadeAtual?.id) {
    return (
      <MainLayout>
        <Header title="Mapa Operacional" subtitle="Monitoramento em tempo real" />
        <div className="p-6">
          <Card>
            <CardContent className="py-12 flex flex-col items-center text-center gap-3">
              <MapPin className="h-10 w-10 text-muted-foreground" />
              <div className="font-medium">Selecione uma unidade</div>
              <div className="text-sm text-muted-foreground max-w-md">
                O Mapa Operacional mostra entregadores e pedidos da unidade selecionada. Escolha uma unidade no seletor para visualizar os dados.
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Mapa Operacional" subtitle="Monitoramento em tempo real" />
      <div className={cn("p-4 md:p-6 space-y-4", isFullscreen && "fixed inset-0 z-50 bg-background p-4")}>

        {/* Header compacto */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1">
                <Radio className="h-3 w-3 text-primary animate-pulse" />
                <span className="text-xs text-muted-foreground">Ao vivo</span>
              </div>
              <span className="text-xs text-muted-foreground">• Atualizado {tempoDesdeUpdate()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {alertas.map((a, i) => (
              <Badge key={i} variant="destructive" className="flex items-center gap-1 py-1 animate-pulse">
                <AlertTriangle className="h-3 w-3" />{a}
              </Badge>
            ))}
          </div>
        )}

        {/* KPIs derivados de presença real */}
        <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
          <Card className="border-l-4 border-l-chart-3">
            <CardContent className="flex items-center gap-3 py-2.5 px-3">
              <Truck className="h-5 w-5 text-chart-3" />
              <div>
                <p className="text-lg font-bold">{kpis.emRota}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Em Rota</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="flex items-center gap-3 py-2.5 px-3">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold">{kpis.online}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Online</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-warning">
            <CardContent className="flex items-center gap-3 py-2.5 px-3">
              <WifiOff className="h-5 w-5 text-warning" />
              <div>
                <p className="text-lg font-bold">{kpis.instavel + kpis.offline}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Offline / Instável</p>
              </div>
            </CardContent>
          </Card>
          <Card className={cn("border-l-4 border-l-chart-4", kpis.pendentes > 3 && "border-l-destructive")}>
            <CardContent className="flex items-center gap-3 py-2.5 px-3">
              <Clock className={cn("h-5 w-5 text-chart-4", kpis.pendentes > 3 && "text-destructive")} />
              <div>
                <p className="text-lg font-bold">{kpis.pendentes}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-chart-2 col-span-2 md:col-span-1">
            <CardContent className="flex items-center gap-3 py-2.5 px-3">
              <Activity className="h-5 w-5 text-chart-2" />
              <div>
                <p className="text-lg font-bold">{saude.pctSaudavel}%</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saúde GPS</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className={cn("grid gap-4 lg:grid-cols-3", isFullscreen && "flex-1")}>
          {/* Mapa */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5 text-primary" />Mapa em Tempo Real
              </CardTitle>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[10px]">
                  {entregadoresMapa.length} no mapa
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {clientesMapa.length} entregas
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 relative">
              <div className={cn("rounded-b-lg overflow-hidden", isFullscreen ? "h-[calc(100vh-300px)]" : "h-[500px]")}>
                <DeliveryRoutesMap
                  entregadores={entregadoresMapa}
                  clientes={clientesMapa}
                  percurso={percurso}
                  selectedEntregador={selectedEntregador}
                  onSelectEntregador={setSelectedEntregador}
                  showPercurso={showPercurso}
                  defaultCenter={mapCenter || undefined}
                  onSelectCliente={handleSelectCliente}
                  selectedClienteId={selectedCliente?.id || null}
                  routeToClienteLine={routeToClienteLine}
                  overlays={
                    <>
                      <TrilhaPolyline pontosCache={pontosCache} selectedEntregador={selectedEntregador} />
                      <ParadasLayer dadosOp={dadosOp} selectedEntregador={selectedEntregador} />
                    </>
                  }
                />
              </div>
              <NearestDriversPanel
                selectedCliente={selectedCliente}
                entregadores={entregadoresMapa}
                onClose={() => { setSelectedCliente(null); setRouteToClienteLine([]); }}
                onSelectRoute={handleSelectRoute}
              />
            </CardContent>
          </Card>

          {/* Painel lateral */}
          <div className="space-y-4">
            {/* Saúde do rastreamento */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-chart-2" />Saúde do Rastreamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Com ping &lt; 5min</span><span className="font-medium">{saude.pingRecente}/{saude.total}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Último ping global</span><span className="font-medium">{saude.ultimoGlobalMin == null ? "—" : `${saude.ultimoGlobalMin}min atrás`}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Offline &gt; 24h</span><span className="font-medium">{saude.offline24h}</span></div>
              </CardContent>
            </Card>

            {/* Produtos em trânsito */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-chart-4" />Produtos em Trânsito
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {produtosTransito.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nada em rota</p>
                )}
                {produtosTransito.map((p) => (
                  <div key={p.nome} className="flex items-center justify-between text-xs">
                    <span className="truncate">{p.nome}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">{p.qtd}x</Badge>
                      <span className="text-[10px] text-muted-foreground">· {p.entregadores} ent.</span>
                    </div>
                  </div>
                ))}
                {selectedEntregador && itensDoSelecionado.length > 0 && (
                  <div className="pt-2 mt-2 border-t">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Carregando agora</p>
                    {itensDoSelecionado.map((it) => (
                      <div key={it.nome} className="flex justify-between text-xs">
                        <span className="truncate">{it.nome}</span>
                        <span className="font-medium">{it.qtd}x</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inteligência Operacional */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />Inteligência Operacional
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PainelLateral entregadores={ents} pedidos={peds} dadosOp={dadosOp} onRefresh={refresh} />
              </CardContent>
            </Card>

            {/* Entregadores com presença real */}
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Truck className="h-4 w-4" />Entregadores
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Switch id="mostrar-offline" checked={mostrarOffline} onCheckedChange={setMostrarOffline} className="scale-75" />
                    <Label htmlFor="mostrar-offline" className="text-[10px] text-muted-foreground cursor-pointer">Offline</Label>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{entregadoresListados.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="max-h-[240px] overflow-y-auto space-y-1.5">
                {entregadoresListados.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {mostrarOffline ? "Nenhum entregador ativo" : "Nenhum entregador online agora"}
                  </p>
                )}
                {entregadoresListados.map((e) => {
                  const pres = presencaMap[e.id];
                  if (!pres) return null;
                  const badge = PRESENCE_BADGE[pres.presenca];
                  const podeMapa = !!(e.latitude && e.longitude) && pres.presenca !== "offline";
                  return (
                    <div key={e.id} className="space-y-1">
                      <button
                        onClick={() => {
                          if (!podeMapa) return;
                          const newId = selectedEntregador === e.id ? null : e.id;
                          setSelectedEntregador(newId);
                          if (!newId) setShowPercurso(false);
                        }}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg border text-sm w-full text-left transition-colors hover:bg-accent/50",
                          selectedEntregador === e.id && "bg-primary/10 border-primary/30",
                          pres.presenca === "offline" && "opacity-60",
                          pres.presenca === "instavel" && "border-warning/30 bg-warning/5",
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", PRESENCE_COLOR[pres.presenca])} />
                          <div className="min-w-0">
                            <span className="font-medium block truncate">{e.nome}</span>
                            <span className={cn(
                              "text-[10px] flex items-center gap-0.5",
                              pres.presenca === "offline" ? "text-muted-foreground" :
                              pres.presenca === "instavel" ? "text-warning" : "text-muted-foreground",
                            )}>
                              {pres.presenca === "instavel" && <WifiOff className="h-2.5 w-2.5" />}
                              {pres.label}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                          {e.telefone && (
                            <a href={`tel:${e.telefone}`} onClick={(ev) => ev.stopPropagation()} className="text-muted-foreground hover:text-primary">
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </button>
                      {selectedEntregador === e.id && podeMapa && pres.temRotaAtiva && (
                        <Button
                          size="sm"
                          variant={showPercurso ? "default" : "outline"}
                          className="w-full h-7 text-[10px]"
                          onClick={() => setShowPercurso(!showPercurso)}
                        >
                          {showPercurso ? (
                            <><EyeOff className="h-3 w-3 mr-1" />Ocultar Trajeto</>
                          ) : (
                            <><Route className="h-3 w-3 mr-1" />Trajeto do Dia</>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Pedidos Ativos */}
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />Pedidos
                </CardTitle>
                <Badge variant="secondary" className="text-[10px]">{peds.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <Tabs value={filtroStatus} onValueChange={setFiltroStatus} className="w-full">
                  <TabsList className="w-full h-7">
                    <TabsTrigger value="todos" className="text-[10px] flex-1">Todos</TabsTrigger>
                    <TabsTrigger value="pendente" className="text-[10px] flex-1">Pendentes</TabsTrigger>
                    <TabsTrigger value="em_rota" className="text-[10px] flex-1">Em Rota</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="max-h-[250px] overflow-y-auto space-y-1.5">
                  {pedidosFiltrados.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido</p>}
                  {pedidosFiltrados.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{(p.clientes as any)?.nome || "Cliente"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{(p.clientes as any)?.bairro || p.endereco_entrega || "-"}</p>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2">
                        <Badge variant={p.status === "pendente" ? "secondary" : "default"} className="text-[10px] whitespace-nowrap">
                          {p.status === "pendente" ? "Pendente" : p.status === "confirmado" ? "Confirmado" : "Em Rota"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          <span className="font-medium uppercase tracking-wider">Legenda:</span>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-full bg-chart-3 animate-pulse" /><span>Em Rota</span></div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-full bg-primary" /><span>Online</span></div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-full bg-warning" /><span>GPS instável</span></div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-full bg-muted-foreground/50" /><span>Offline</span></div>
        </div>
      </div>
    </MainLayout>
  );
}
