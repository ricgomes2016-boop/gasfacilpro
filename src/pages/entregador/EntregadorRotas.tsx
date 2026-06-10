import { useEffect, useState, useCallback } from "react";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Users,
  Package,
  Clock,
  Navigation,
  RefreshCw,
  Truck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface CargaItem {
  produto_nome: string;
  quantidade_saida: number;
  quantidade_vendida: number;
  quantidade_transferida: number;
  quantidade_restante: number;
}

interface RotaAtiva {
  carregamento_id: string;
  rota_nome: string;
  bairros: string[];
  distancia_km: number;
  tempo_estimado: string | null;
  data_saida: string;
  itens: CargaItem[];
}

export default function EntregadorRotas() {
  const { user } = useAuth();
  const [rotaAtiva, setRotaAtiva] = useState<RotaAtiva | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRotaAtiva = useCallback(async () => {
    if (!user) return;

    try {
      const { data: entregador } = await supabase
        .from("entregadores")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!entregador) {
        setIsLoading(false);
        return;
      }

      // Get active carregamento with rota info
      const { data: carregamento } = await supabase
        .from("carregamentos_rota")
        .select("id, data_saida, rota_definida_id, status")
        .eq("entregador_id", entregador.id)
        .eq("status", "em_rota")
        .order("data_saida", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!carregamento) {
        setRotaAtiva(null);
        setIsLoading(false);
        return;
      }

      // Get rota info
      let rotaNome = "Rota sem nome";
      let bairros: string[] = [];
      let distanciaKm = 0;
      let tempoEstimado: string | null = null;

      if (carregamento.rota_definida_id) {
        const { data: rota } = await supabase
          .from("rotas_definidas")
          .select("nome, bairros, distancia_km, tempo_estimado")
          .eq("id", carregamento.rota_definida_id)
          .maybeSingle();

        if (rota) {
          rotaNome = rota.nome || "Rota sem nome";
          bairros = (rota.bairros as string[]) || [];
          distanciaKm = Number(rota.distancia_km) || 0;
          tempoEstimado = rota.tempo_estimado;
        }
      }

      // Get cargo items
      const { data: carregItens } = await supabase
        .from("carregamento_rota_itens")
        .select("quantidade_saida, quantidade_vendida, quantidade_transferida, produtos:produto_id(nome)")
        .eq("carregamento_id", carregamento.id);

      const itens: CargaItem[] = (carregItens || []).map((item: any) => ({
        produto_nome: item.produtos?.nome || "Produto",
        quantidade_saida: item.quantidade_saida || 0,
        quantidade_vendida: item.quantidade_vendida || 0,
        quantidade_transferida: item.quantidade_transferida || 0,
        quantidade_restante:
          (item.quantidade_saida || 0) -
          (item.quantidade_vendida || 0) -
          (item.quantidade_transferida || 0),
      }));

      setRotaAtiva({
        carregamento_id: carregamento.id,
        rota_nome: rotaNome,
        bairros,
        distancia_km: distanciaKm,
        tempo_estimado: tempoEstimado,
        data_saida: carregamento.data_saida,
        itens,
      });
    } catch (err) {
      console.error("Erro ao buscar rota:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRotaAtiva();
  }, [fetchRotaAtiva]);

  // Realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`rota-entregador-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "carregamentos_rota" }, () => fetchRotaAtiva())
      .on("postgres_changes", { event: "*", schema: "public", table: "carregamento_rota_itens" }, () => fetchRotaAtiva())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRotaAtiva, user?.id]);

  const totalSaida = rotaAtiva?.itens.reduce((acc, i) => acc + i.quantidade_saida, 0) || 0;
  const totalVendido = rotaAtiva?.itens.reduce((acc, i) => acc + i.quantidade_vendida, 0) || 0;
  const totalRestante = rotaAtiva?.itens.reduce((acc, i) => acc + i.quantidade_restante, 0) || 0;

  return (
    <EntregadorLayout title="Rotas">
      <div className="p-4 space-y-4">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => { setIsLoading(true); fetchRotaAtiva(); }}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : !rotaAtiva ? (
          <div className="text-center py-16 text-muted-foreground">
            <Truck className="h-16 w-16 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">Nenhuma rota ativa</p>
            <p className="text-sm mt-1">Sua rota aparecerá aqui quando o gestor cadastrar um carregamento para você.</p>
          </div>
        ) : (
          <>
            {/* Rota atual */}
            <Card className="border-none shadow-md gradient-primary text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <Navigation className="h-5 w-5" />
                  Sua Rota de Hoje
                </CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="text-xl font-bold mb-3">{rotaAtiva.rota_nome}</h3>
                {rotaAtiva.bairros.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {rotaAtiva.bairros.map((bairro, idx) => (
                      <Badge
                        key={idx}
                        className="bg-white/20 text-white border-none"
                      >
                        {bairro}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <Package className="h-5 w-5 mx-auto mb-1 text-white/80" />
                    <p className="text-lg font-bold">{totalSaida}</p>
                    <p className="text-xs text-white/70">Carregado</p>
                  </div>
                  <div>
                    <MapPin className="h-5 w-5 mx-auto mb-1 text-white/80" />
                    <p className="text-lg font-bold">{rotaAtiva.distancia_km} km</p>
                    <p className="text-xs text-white/70">Distância</p>
                  </div>
                  <div>
                    <Clock className="h-5 w-5 mx-auto mb-1 text-white/80" />
                    <p className="text-lg font-bold">{rotaAtiva.tempo_estimado || "-"}</p>
                    <p className="text-xs text-white/70">Tempo est.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-none shadow-md">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{totalSaida}</p>
                  <p className="text-xs text-muted-foreground">Carregado</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-md">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-orange-500">{totalVendido}</p>
                  <p className="text-xs text-muted-foreground">Vendido</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-md">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{totalRestante}</p>
                  <p className="text-xs text-muted-foreground">Restante</p>
                </CardContent>
              </Card>
            </div>

            {rotaAtiva.data_saida && (
              <p className="text-xs text-muted-foreground text-center">
                Rota iniciada em {new Date(rotaAtiva.data_saida).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}

            {/* Item list */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Carga da Rota
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {rotaAtiva.itens.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhum produto carregado</p>
                ) : (
                  rotaAtiva.itens.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.produto_nome}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            Saída: {item.quantidade_saida}
                          </span>
                          <span className="text-xs text-orange-500">
                            Vend: {item.quantidade_vendida}
                          </span>
                          {item.quantidade_transferida > 0 && (
                            <span className="text-xs text-blue-500">
                              Transf: {item.quantidade_transferida}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={
                          item.quantidade_restante <= 0
                            ? "bg-destructive text-destructive-foreground"
                            : item.quantidade_restante <= 2
                            ? "bg-orange-500 text-white"
                            : "bg-green-600 text-white"
                        }
                      >
                        {item.quantidade_restante}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </EntregadorLayout>
  );
}
