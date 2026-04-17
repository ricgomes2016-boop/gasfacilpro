import { useEffect, useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Truck, RefreshCw, Clock, Package, AlertTriangle, CheckCircle, Maximize2, Minimize2, Radio, Phone, WifiOff, Route, EyeOff } from "lucide-react";
import { DeliveryRoutesMap, Entregador, ClienteEntrega, PercursoPonto } from "@/components/mapa/DeliveryRoutesMap";
import { NearestDriversPanel } from "@/components/mapa/NearestDriversPanel";
import { TrilhaPolyline } from "@/components/operacional/mapa/TrilhaPolyline";
import { ParadasLayer } from "@/components/operacional/mapa/ParadasLayer";
import { PainelLateral } from "@/components/operacional/mapa/PainelLateral";
import { useMapaOperacionalData } from "@/hooks/useMapaOperacionalData";
import { useOperacional } from "@/hooks/useOperacional";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { cn } from "@/lib/utils";

export default function MapaOperacional() {
  const { unidadeAtual } = useUnidade();
  const [selectedEntregador, setSelectedEntregador] = useState<string | null>(null);
  const [showPercurso, setShowPercurso] = useState(false);
  const [pedidosAtivos, setPedidosAtivos] = useState<any[]>([]);
  const [entregadoresData, setEntregadoresData] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<ClienteEntrega | null>(null);
  const [routeToClienteLine, setRouteToClienteLine] = useState<[number, number][]>([]);
  const [percurso, setPercurso] = useState<PercursoPonto[]>([]);

  // Inteligência operacional (trilha, paradas, ETA, sugestões)
  const { entregadores: entsOp, pedidos: pedsOp, pontosCache, refresh } = useMapaOperacionalData({
    unidadeId: unidadeAtual?.id,
  });
  const dadosOp = useOperacional(entsOp, pedsOp, pontosCache);

  // Buscar coordenadas da unidade para centralizar o mapa
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

  const fetchData = useCallback(async () => {
    try {
      const hojeInicio = new Date(); hojeInicio.setHours(0, 0, 0, 0);

      let pq = supabase.from("pedidos").select("*, clientes(nome, bairro, endereco, telefone, latitude, longitude)").gte("created_at", hojeInicio.toISOString()).in("status", ["pendente", "confirmado", "em_rota"]);
      if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);
      const { data: pedidos } = await pq;
      setPedidosAtivos(pedidos || []);

      let eq = supabase.from("entregadores").select("*").eq("ativo", true);
      if (unidadeAtual?.id) eq = eq.eq("unidade_id", unidadeAtual.id);
      const { data: entregs } = await eq;
      setEntregadoresData(entregs || []);

      const newAlertas: string[] = [];
      const pendentes = pedidos?.filter(p => p.status === "pendente") || [];
      if (pendentes.length > 5) newAlertas.push(`${pendentes.length} pedidos aguardando atribuição`);
      const disponiveisCount = entregs?.filter(e => e.status === "disponivel").length || 0;
      if (disponiveisCount === 0 && pendentes.length > 0) newAlertas.push("Nenhum entregador disponível!");

      const emRotaLonge = pedidos?.filter(p => {
        if (p.status !== "em_rota") return false;
        const criado = new Date(p.created_at);
        return (Date.now() - criado.getTime()) > 45 * 60 * 1000;
      }) || [];
      if (emRotaLonge.length > 0) newAlertas.push(`${emRotaLonge.length} entrega(s) há mais de 45min`);

      setAlertas(newAlertas);
      setLastUpdate(new Date());
    } catch (e) { console.error(e); }
  }, [unidadeAtual]);

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 30000); return () => clearInterval(interval); }, [fetchData]);

  // Fetch percurso do entregador selecionado
  useEffect(() => {
    if (!selectedEntregador || !showPercurso) {
      setPercurso([]);
      return;
    }
    const fetchPercurso = async () => {
      const { data: rota } = await supabase
        .from("rotas")
        .select("id")
        .eq("entregador_id", selectedEntregador)
        .eq("status", "em_andamento")
        .maybeSingle();
      if (!rota) { setPercurso([]); return; }

      const { data: historico } = await supabase
        .from("rota_historico")
        .select("latitude, longitude, timestamp")
        .eq("rota_id", rota.id)
        .order("timestamp", { ascending: true });

      setPercurso(
        (historico || []).map(h => ({
          lat: h.latitude,
          lng: h.longitude,
          hora: new Date(h.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        }))
      );
    };
    fetchPercurso();
  }, [selectedEntregador, showPercurso]);

  const GPS_OFFLINE_MS = 5 * 60 * 1000;

  const entregadoresMapa: Entregador[] = entregadoresData.filter(e => e.latitude && e.longitude).map((e) => {
    const diffMs = Date.now() - new Date(e.updated_at).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const ultimaAtt = diffMin < 1 ? "agora" : diffMin < 60 ? `há ${diffMin}min` : `há ${Math.floor(diffMin / 60)}h`;
    return {
      id: e.id, nome: e.nome, status: e.status || "disponivel",
      lat: e.latitude, lng: e.longitude, ultimaAtualizacao: ultimaAtt,
      updatedAt: e.updated_at,
    };
  });

  // Build client markers from pedidos - use pedido lat/lng or fallback to client lat/lng
  const clientesMapa: ClienteEntrega[] = pedidosAtivos
    .map((p) => {
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
    })
    .filter(Boolean) as ClienteEntrega[];

  const totalEmRota = entregadoresData.filter(e => e.status === "em_rota").length;
  const totalDisponivel = entregadoresData.filter(e => e.status === "disponivel").length;
  const totalPendentes = pedidosAtivos.filter(p => p.status === "pendente").length;
  const totalConfirmados = pedidosAtivos.filter(p => p.status === "confirmado" || p.status === "em_rota").length;

  const pedidosFiltrados = filtroStatus === "todos" ? pedidosAtivos : pedidosAtivos.filter(p => p.status === filtroStatus);

  const tempoDesdeUpdate = () => {
    const diff = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
    if (diff < 60) return `${diff}s atrás`;
    return `${Math.floor(diff / 60)}min atrás`;
  };

  // Handle selecting a route from driver to client
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
    if (!cliente) {
      setRouteToClienteLine([]);
    }
  };

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
            <Button variant="outline" size="sm" onClick={fetchData}>
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

        {/* KPIs compactos */}
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
          <Card className="border-l-4 border-l-chart-3">
            <CardContent className="flex items-center gap-3 py-2.5 px-3">
              <Truck className="h-5 w-5 text-chart-3" />
              <div>
                <p className="text-lg font-bold">{totalEmRota}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Em Rota</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="flex items-center gap-3 py-2.5 px-3">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold">{totalDisponivel}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Disponíveis</p>
              </div>
            </CardContent>
          </Card>
          <Card className={cn("border-l-4 border-l-chart-4", totalPendentes > 3 && "border-l-destructive")}>
            <CardContent className="flex items-center gap-3 py-2.5 px-3">
              <Clock className={cn("h-5 w-5 text-chart-4", totalPendentes > 3 && "text-destructive")} />
              <div>
                <p className="text-lg font-bold">{totalPendentes}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-chart-2">
            <CardContent className="flex items-center gap-3 py-2.5 px-3">
              <Package className="h-5 w-5 text-chart-2" />
              <div>
                <p className="text-lg font-bold">{totalConfirmados}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Em Andamento</p>
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
              {/* Painel de entregadores mais próximos */}
              <NearestDriversPanel
                selectedCliente={selectedCliente}
                entregadores={entregadoresMapa}
                onClose={() => {
                  setSelectedCliente(null);
                  setRouteToClienteLine([]);
                }}
                onSelectRoute={handleSelectRoute}
              />
            </CardContent>
          </Card>

          {/* Painel lateral */}
          <div className="space-y-4">
            {/* Inteligência Operacional */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />Inteligência Operacional
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PainelLateral
                  entregadores={entsOp}
                  pedidos={pedsOp}
                  dadosOp={dadosOp}
                  onRefresh={refresh}
                />
              </CardContent>
            </Card>

            {/* Entregadores */}
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Truck className="h-4 w-4" />Entregadores
                </CardTitle>
                <Badge variant="secondary" className="text-[10px]">{entregadoresData.length}</Badge>
              </CardHeader>
              <CardContent className="max-h-[200px] overflow-y-auto space-y-1.5">
                {entregadoresData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum entregador ativo</p>}
                {entregadoresData.map((e, idx) => {
                  const gpsOff = e.latitude && e.longitude && e.updated_at
                    ? (Date.now() - new Date(e.updated_at).getTime() > GPS_OFFLINE_MS)
                    : false;
                  return (
                  <div key={e.id} className="space-y-1">
                    <button
                      onClick={() => {
                        if (e.latitude && e.longitude) {
                          const newId = selectedEntregador === e.id ? null : e.id;
                          setSelectedEntregador(newId);
                          if (!newId) setShowPercurso(false);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg border text-sm w-full text-left transition-colors hover:bg-accent/50",
                        selectedEntregador === e.id && "bg-primary/10 border-primary/30",
                        gpsOff && "border-destructive/30 bg-destructive/5"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          gpsOff ? "bg-destructive" : e.status === "em_rota" ? "bg-chart-3 animate-pulse" : "bg-primary"
                        )} />
                        <div>
                          <span className="font-medium block">{e.nome}</span>
                          {!e.latitude && <span className="text-[10px] text-muted-foreground">Sem localização</span>}
                          {gpsOff && (
                            <span className="text-[10px] text-destructive flex items-center gap-0.5">
                              <WifiOff className="h-2.5 w-2.5" /> GPS Offline
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {gpsOff && (
                          <Badge variant="destructive" className="text-[10px]">Offline</Badge>
                        )}
                        <Badge variant={e.status === "em_rota" ? "default" : "secondary"} className="text-[10px]">
                          {e.status === "em_rota" ? "Em Rota" : "Livre"}
                        </Badge>
                        {e.telefone && (
                          <a href={`tel:${e.telefone}`} onClick={(ev) => ev.stopPropagation()} className="text-muted-foreground hover:text-primary">
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </button>
                    {selectedEntregador === e.id && e.latitude && (
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
                <Badge variant="secondary" className="text-[10px]">{pedidosAtivos.length}</Badge>
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
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full" style={{ background: "hsl(45, 93%, 47%)" }} />
            <span>Pendente</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full" style={{ background: "hsl(142, 71%, 45%)" }} />
            <span>Confirmado</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full" style={{ background: "hsl(217, 91%, 60%)" }} />
            <span>Em Rota</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full" style={{ background: "hsl(var(--success))" }} />
            <span>Entregador</span>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
