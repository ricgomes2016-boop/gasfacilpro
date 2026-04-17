import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Package, BarChart3, AlertTriangle, Clock, Sparkles, Route } from "lucide-react";
import { CardProdutividade } from "./CardProdutividade";
import type { EntregadorOp, PedidoOp } from "@/hooks/useMapaOperacionalData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { otimizarOrdem } from "@/services/iaOperacionalService";

interface Props {
  entregadores: EntregadorOp[];
  pedidos: PedidoOp[];
  dadosOp: Record<string, any>;
  onRefresh?: () => void;
}

export function PainelLateral({ entregadores, pedidos, dadosOp, onRefresh }: Props) {
  const pendentes = pedidos.filter((p) => p.status === "pendente");

  const atribuir = async (pedidoId: string, entregadorId: string, nome: string) => {
    const { error } = await supabase
      .from("pedidos")
      .update({ entregador_id: entregadorId, status: "confirmado" })
      .eq("id", pedidoId);
    if (error) {
      toast.error("Falha ao atribuir: " + error.message);
      return;
    }
    toast.success(`Pedido atribuído a ${nome}`);
    onRefresh?.();
  };

  const otimizar = (entregadorId: string) => {
    const ent = entregadores.find((e) => e.id === entregadorId);
    if (!ent?.localizacao) {
      toast.error("Entregador sem localização");
      return;
    }
    const meus = pedidos.filter(
      (p) => p.entregador_id === entregadorId && p.localizacao && p.status !== "entregue"
    );
    if (meus.length < 2) {
      toast.info("Menos de 2 pedidos para otimizar");
      return;
    }
    const ordenado = otimizarOrdem(
      meus.map((p) => ({ ...p, lat: p.localizacao!.lat, lng: p.localizacao!.lng })),
      { lat: ent.localizacao.lat, lng: ent.localizacao.lng }
    );
    toast.success(`Ordem otimizada: ${ordenado.length} entregas`);
  };

  return (
    <Tabs defaultValue="entregadores" className="w-full">
      <TabsList className="w-full h-9 grid grid-cols-3">
        <TabsTrigger value="entregadores" className="text-xs">
          <Truck className="h-3.5 w-3.5 mr-1" />Equipe
        </TabsTrigger>
        <TabsTrigger value="pedidos" className="text-xs">
          <Package className="h-3.5 w-3.5 mr-1" />Pedidos
        </TabsTrigger>
        <TabsTrigger value="produtividade" className="text-xs">
          <BarChart3 className="h-3.5 w-3.5 mr-1" />KPIs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="entregadores" className="space-y-2 mt-3 max-h-[420px] overflow-y-auto">
        {entregadores.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum entregador</p>
        )}
        {entregadores.map((e) => {
          const info = dadosOp[e.id] || {};
          const tempoMin = info.tempo ? Math.round(info.tempo / 60) : 0;
          const nParadas = info.paradas?.length || 0;
          const alertas = info.alertas || [];
          return (
            <Card key={e.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{e.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {e.pedidosAtivos || 0} entrega(s) ativa(s)
                    </p>
                  </div>
                  <Badge variant={e.status === "em_rota" ? "default" : "secondary"} className="text-[10px] shrink-0">
                    {e.status === "em_rota" ? "Em Rota" : "Livre"}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{tempoMin}min</div>
                  <div className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{nParadas} paradas</div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 p-0 text-[10px]"
                    onClick={() => otimizar(e.id)}
                  >
                    <Route className="h-3 w-3 mr-0.5" />Otimizar
                  </Button>
                </div>
                {alertas.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {alertas.map((a: string, i: number) => (
                      <Badge key={i} variant="destructive" className="text-[9px]">{a}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>

      <TabsContent value="pedidos" className="space-y-2 mt-3 max-h-[420px] overflow-y-auto">
        {pendentes.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Sem pedidos pendentes</p>
        )}
        {pendentes.map((p) => {
          const info = dadosOp[p.id] || {};
          const melhor = info.melhorEntregador;
          const eta = info.eta;
          const risco = info.risco;
          const corRisco = risco === "alto" ? "destructive" : risco === "medio" ? "secondary" : "default";
          return (
            <Card key={p.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {(p.clientes as any)?.nome || "Cliente"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {(p.clientes as any)?.bairro || p.endereco_entrega || "-"}
                    </p>
                  </div>
                  {eta != null && (
                    <Badge variant={corRisco as any} className="text-[10px] shrink-0">
                      ETA {eta}min
                    </Badge>
                  )}
                </div>
                {melhor && (
                  <Button
                    size="sm"
                    className="w-full h-8 text-[11px]"
                    onClick={() => atribuir(p.id, melhor.id, melhor.nome)}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Atribuir a {melhor.nome}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>

      <TabsContent value="produtividade" className="mt-3">
        <CardProdutividade pedidos={pedidos} entregadores={entregadores} dadosOp={dadosOp} />
      </TabsContent>
    </Tabs>
  );
}
