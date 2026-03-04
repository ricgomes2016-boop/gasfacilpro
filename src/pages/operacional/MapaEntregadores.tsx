import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Truck, RefreshCw, Route, History, User, Clock, Eye, EyeOff, Loader2 } from "lucide-react";
import { DeliveryRoutesMap, Entregador, ClienteEntrega, PercursoPonto } from "@/components/mapa/DeliveryRoutesMap";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

export default function MapaEntregadores() {
  const { unidadeAtual } = useUnidade();
  const [selectedEntregador, setSelectedEntregador] = useState<string | null>(null);
  const [showPercurso, setShowPercurso] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [clientes, setClientes] = useState<ClienteEntrega[]>([]);
  const [percurso, setPercurso] = useState<PercursoPonto[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);

  const fetchData = useCallback(async () => {
    try {
      // Fetch unit coords for map center
      if (unidadeAtual?.id) {
        const { data: unidade } = await supabase
          .from("unidades").select("latitude, longitude").eq("id", unidadeAtual.id).single();
        if (unidade?.latitude && unidade?.longitude) {
          setMapCenter([unidade.latitude, unidade.longitude]);
        }
      }

      // Fetch entregadores
      let eq = supabase.from("entregadores").select("id, nome, status, latitude, longitude, telefone, updated_at").eq("ativo", true);
      if (unidadeAtual?.id) eq = eq.eq("unidade_id", unidadeAtual.id);
      const { data: entregs } = await eq;

      const mapped: Entregador[] = (entregs || [])
        .filter(e => e.latitude && e.longitude)
        .map(e => {
          const updatedAt = new Date(e.updated_at);
          const diffMs = Date.now() - updatedAt.getTime();
          const diffMin = Math.floor(diffMs / 60000);
          let ultimaAtt = "agora";
          if (diffMin >= 1440) ultimaAtt = `há ${Math.floor(diffMin / 1440)}d`;
          else if (diffMin >= 60) ultimaAtt = `há ${Math.floor(diffMin / 60)}h`;
          else if (diffMin > 1) ultimaAtt = `há ${diffMin}min`;
          return {
            id: e.id,
            nome: e.nome,
            status: (e.status || "disponivel") as "disponivel" | "em_rota" | "offline",
            lat: e.latitude!,
            lng: e.longitude!,
            ultimaAtualizacao: ultimaAtt,
          };
        });
      setEntregadores(mapped);

      // Fetch today's active orders
      const hojeInicio = new Date(); hojeInicio.setHours(0, 0, 0, 0);
      let pq = supabase.from("pedidos")
        .select("*, clientes(nome, endereco, bairro, latitude, longitude)")
        .gte("created_at", hojeInicio.toISOString())
        .in("status", ["pendente", "confirmado", "em_rota"]);
      if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);
      const { data: pedidos } = await pq;

      const clientesMapa: ClienteEntrega[] = (pedidos || [])
        .map(p => {
          const lat = p.latitude || (p.clientes as any)?.latitude;
          const lng = p.longitude || (p.clientes as any)?.longitude;
          if (!lat || !lng) return null;
          return {
            id: p.id,
            cliente: (p.clientes as any)?.nome || "Cliente",
            endereco: p.endereco_entrega || (p.clientes as any)?.endereco || "",
            lat, lng,
            status: p.status || "pendente",
            entregadorId: p.entregador_id || undefined,
            horarioPrevisto: new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          };
        })
        .filter(Boolean) as ClienteEntrega[];
      setClientes(clientesMapa);
    } catch (e) {
      console.error("Erro ao carregar dados do mapa:", e);
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch percurso when entregador selected
  useEffect(() => {
    if (!selectedEntregador || !showPercurso) {
      setPercurso([]);
      return;
    }
    const fetchPercurso = async () => {
      // Find active route for this driver
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

  const entregadorSelecionado = entregadores.find(e => e.id === selectedEntregador);
  const clientesDoEntregador = clientes.filter(c => c.entregadorId === selectedEntregador);

  // Also include drivers without GPS for the list
  const [allEntregadores, setAllEntregadores] = useState<any[]>([]);
  useEffect(() => {
    const fetchAll = async () => {
      let eq = supabase.from("entregadores").select("id, nome, status, latitude, longitude, updated_at").eq("ativo", true);
      if (unidadeAtual?.id) eq = eq.eq("unidade_id", unidadeAtual.id);
      const { data } = await eq;
      setAllEntregadores(data || []);
    };
    fetchAll();
  }, [unidadeAtual]);

  if (loading) {
    return (
      <MainLayout>
        <Header title="Mapa dos Entregadores" subtitle="Acompanhe a localização em tempo real" />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Mapa dos Entregadores" subtitle="Acompanhe a localização em tempo real" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {selectedEntregador && (
              <Button
                variant={showPercurso ? "default" : "outline"}
                onClick={() => setShowPercurso(!showPercurso)}
              >
                <History className="h-4 w-4 mr-2" />
                {showPercurso ? "Ocultar Percurso" : "Ver Percurso"}
              </Button>
            )}
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-success/10">
                <Truck className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {allEntregadores.filter(e => e.status === "em_rota").length}
                </p>
                <p className="text-sm text-muted-foreground">Em Rota</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {allEntregadores.filter(e => e.status === "disponivel").length}
                </p>
                <p className="text-sm text-muted-foreground">Disponíveis</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-warning/10">
                <MapPin className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {clientes.filter(c => c.status === "pendente").length}
                </p>
                <p className="text-sm text-muted-foreground">Entregas Pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-muted">
                <MapPin className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{entregadores.length}</p>
                <p className="text-sm text-muted-foreground">Com GPS ativo</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lista de Entregadores */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Entregadores ({allEntregadores.length})
            </h3>
            {allEntregadores.map((entregador) => {
              const hasGps = entregador.latitude && entregador.longitude;
              return (
                <Card
                  key={entregador.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedEntregador === entregador.id
                      ? "ring-2 ring-primary shadow-lg"
                      : ""
                  } ${!hasGps ? "opacity-60" : ""}`}
                  onClick={() => {
                    if (hasGps) {
                      setSelectedEntregador(
                        selectedEntregador === entregador.id ? null : entregador.id
                      );
                    }
                  }}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        entregador.status === "em_rota"
                          ? "bg-success/10"
                          : "bg-primary/10"
                      }`}>
                        <Truck className={`h-5 w-5 ${
                          entregador.status === "em_rota"
                            ? "text-success"
                            : "text-primary"
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{entregador.nome}</p>
                          <Badge
                            variant={
                              entregador.status === "em_rota" ? "default" : "secondary"
                            }
                          >
                            {entregador.status === "em_rota" ? "Em Rota" : "Disponível"}
                          </Badge>
                        </div>
                        {!hasGps && (
                          <p className="text-xs text-destructive mt-1">📍 Sem localização GPS</p>
                        )}
                        {hasGps && entregador.updated_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            📍 Atualizado {(() => {
                              const diffMs = Date.now() - new Date(entregador.updated_at).getTime();
                              const diffMin = Math.floor(diffMs / 60000);
                              if (diffMin >= 1440) return `há ${Math.floor(diffMin / 1440)}d`;
                              if (diffMin >= 60) return `há ${Math.floor(diffMin / 60)}h`;
                              if (diffMin > 1) return `há ${diffMin}min`;
                              return "agora";
                            })()}
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedEntregador === entregador.id && hasGps && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-muted-foreground">Entregas na rota:</span>
                          <span className="text-sm font-medium">
                            {clientesDoEntregador.length}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPercurso(!showPercurso);
                          }}
                        >
                          {showPercurso ? (
                            <>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Ocultar Percurso
                            </>
                          ) : (
                            <>
                              <Route className="h-4 w-4 mr-2" />
                              Ver Percurso do Dia
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Mapa */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Mapa em Tempo Real
                {entregadorSelecionado && (
                  <Badge variant="outline" className="ml-2">
                    {entregadorSelecionado.nome}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px] rounded-b-lg overflow-hidden">
                <DeliveryRoutesMap
                  entregadores={entregadores}
                  clientes={clientes}
                  percurso={percurso}
                  selectedEntregador={selectedEntregador}
                  onSelectEntregador={setSelectedEntregador}
                  showPercurso={showPercurso}
                  defaultCenter={mapCenter}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de entregas do dia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-warning" />
              Entregas do Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clientes.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhuma entrega ativa com localização</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {clientes.map((cliente) => {
                  const entregadorAssociado = entregadores.find(e => e.id === cliente.entregadorId);
                  return (
                    <div
                      key={cliente.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        cliente.status === "pendente"
                          ? "bg-warning/10"
                          : cliente.status === "em_rota"
                          ? "bg-primary/10"
                          : "bg-success/10"
                      }`}>
                        <MapPin className={`h-5 w-5 ${
                          cliente.status === "pendente"
                            ? "text-warning"
                            : cliente.status === "em_rota"
                            ? "text-primary"
                            : "text-success"
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{cliente.cliente}</p>
                          <Badge
                            variant={cliente.status === "pendente" ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {cliente.status === "pendente" ? "Pendente" : cliente.status === "em_rota" ? "Em Rota" : "Confirmado"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{cliente.endereco}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            ⏰ {cliente.horarioPrevisto}
                          </span>
                          {entregadorAssociado && (
                            <span className="text-xs text-primary">
                              {entregadorAssociado.nome}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
