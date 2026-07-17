import { useEffect, useState, useCallback } from "react";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, RefreshCw, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface EstoqueItem {
  produto_id: string;
  produto_nome: string;
  quantidade_saida: number;
  quantidade_vendida: number;
  quantidade_transferida: number;
  quantidade_restante: number;
}

export default function EntregadorEstoque() {
  const { user } = useAuth();
  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [carregamentoStatus, setCarregamentoStatus] = useState<string | null>(null);
  const [dataSaida, setDataSaida] = useState<string | null>(null);

  const fetchEstoque = useCallback(async () => {
    if (!user) return;

    try {
      // Get entregador_id for this user
      const { data: entregador } = await supabase
        .from("entregadores")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!entregador) {
        setIsLoading(false);
        return;
      }

      // Check if there's an active journey with a carregamento_id saved
      let targetCarregamentoId: string | null = null;
      const { data: jornadaAtiva } = await supabase
        .from("rotas")
        .select("observacoes" as any)
        .eq("entregador_id", entregador.id)
        .eq("status", "em_andamento")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as any;

      if (jornadaAtiva?.observacoes) {
        try {
          const obs = JSON.parse(jornadaAtiva.observacoes);
          if (obs.carregamento_id) targetCarregamentoId = obs.carregamento_id;
        } catch {}
      }

      let carregamento: any = null;

      if (targetCarregamentoId) {
        // Use the carregamento linked to the active journey
        const { data } = await supabase
          .from("carregamentos_rota")
          .select("id, status, data_saida")
          .eq("id", targetCarregamentoId)
          .maybeSingle();
        if (data) carregamento = data;
      }

      if (!carregamento) {
        // Fallback: get active carregamento (em_rota)
        const { data } = await supabase
          .from("carregamentos_rota")
          .select("id, status, data_saida")
          .eq("entregador_id", entregador.id)
          .eq("status", "em_rota")
          .order("data_saida", { ascending: false })
          .limit(1)
          .maybeSingle();
        carregamento = data;
      }

      if (!carregamento) {
        setItens([]);
        setCarregamentoStatus(null);
        setIsLoading(false);
        return;
      }

      setCarregamentoStatus(carregamento.status);
      setDataSaida(carregamento.data_saida);

      // Get items for this carregamento
      const { data: carregItens } = await supabase
        .from("carregamento_rota_itens")
        .select("produto_id, quantidade_saida, quantidade_vendida, quantidade_transferida, produtos:produto_id(nome)")
        .eq("carregamento_id", carregamento.id);

      if (carregItens) {
        setItens(
          carregItens.map((item: any) => ({
            produto_id: item.produto_id,
            produto_nome: item.produtos?.nome || "Produto",
            quantidade_saida: item.quantidade_saida || 0,
            quantidade_vendida: item.quantidade_vendida || 0,
            quantidade_transferida: item.quantidade_transferida || 0,
            quantidade_restante: (item.quantidade_saida || 0) - (item.quantidade_vendida || 0) - (item.quantidade_transferida || 0),
          }))
        );
      }
    } catch (err) {
      console.error("Erro ao buscar estoque:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEstoque();
  }, [fetchEstoque]);

  // Realtime: listen for changes on carregamento_rota_itens and pedidos
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`estoque-entregador-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "carregamentos_rota" }, () => fetchEstoque())
      .on("postgres_changes", { event: "*", schema: "public", table: "carregamento_rota_itens" }, () => fetchEstoque())
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => fetchEstoque())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEstoque, user?.id]);

  const totalSaida = itens.reduce((acc, i) => acc + i.quantidade_saida, 0);
  const totalVendido = itens.reduce((acc, i) => acc + i.quantidade_vendida, 0);
  const totalTransferido = itens.reduce((acc, i) => acc + i.quantidade_transferida, 0);
  const totalRestante = itens.reduce((acc, i) => acc + i.quantidade_restante, 0);

  return (
    <EntregadorLayout title="Meu Estoque">
      <div className="p-4 space-y-4">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => { setIsLoading(true); fetchEstoque(); }}>
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
        ) : !carregamentoStatus ? (
          <div className="text-center py-16 text-muted-foreground">
            <Truck className="h-16 w-16 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">Nenhuma rota ativa</p>
            <p className="text-sm mt-1">O estoque aparecerá quando uma rota for cadastrada para você.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <Card className="border-none shadow-md">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{totalSaida}</p>
                  <p className="text-xs text-muted-foreground">Carregado</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-md">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-warning">{totalVendido}</p>
                  <p className="text-xs text-muted-foreground">Vendido</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-md">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-info">{totalTransferido}</p>
                  <p className="text-xs text-muted-foreground">Transf.</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-md">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-success">{totalRestante}</p>
                  <p className="text-xs text-muted-foreground">Restante</p>
                </CardContent>
              </Card>
            </div>

            {dataSaida && (
              <p className="text-xs text-muted-foreground text-center">
                Rota iniciada em {new Date(dataSaida).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}

            {/* Item list */}
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Produtos na Rota
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {itens.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhum produto carregado</p>
                ) : (
                  itens.map((item) => (
                    <div
                      key={item.produto_id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.produto_nome}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            Saída: {item.quantidade_saida}
                          </span>
                          <span className="text-xs text-warning">
                            Vend: {item.quantidade_vendida}
                          </span>
                          {item.quantidade_transferida > 0 && (
                            <span className="text-xs text-info">
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
                            ? "bg-warning text-white"
                            : "bg-success text-white"
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
