import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Loader2, Zap, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface EntregadorProdutividade {
  nome: string;
  entregasHoje: number;
  tempoMedio: number; // minutos
  entregasOntem: number;
}

export function ProdutividadeWidget() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<{
    totalEntregasHoje: number;
    totalEntregasOntem: number;
    tempoMedioGeral: number;
    entregadoresAtivos: number;
    entregasPorHora: number;
    ranking: EntregadorProdutividade[];
  }>({
    totalEntregasHoje: 0, totalEntregasOntem: 0,
    tempoMedioGeral: 0, entregadoresAtivos: 0,
    entregasPorHora: 0, ranking: [],
  });

  useEffect(() => {
    fetchProdutividade();
    const interval = setInterval(fetchProdutividade, 60000); // atualiza a cada 1 min
    return () => clearInterval(interval);
  }, [unidadeAtual]);

  const fetchProdutividade = async () => {
    try {
      const now = new Date();
      const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const ontemInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
      const horasPassadas = Math.max(now.getHours() + now.getMinutes() / 60, 1);

      // Entregas hoje por entregador
      let qHoje = supabase.from("pedidos")
        .select("entregador_id, created_at, entregadores(nome)")
        .gte("created_at", hojeInicio)
        .eq("status", "entregue");
      if (unidadeAtual?.id) qHoje = qHoje.eq("unidade_id", unidadeAtual.id);
      const { data: entregasHoje } = await qHoje;

      // Entregas ontem por entregador
      let qOntem = supabase.from("pedidos")
        .select("entregador_id")
        .gte("created_at", ontemInicio)
        .lt("created_at", hojeInicio)
        .eq("status", "entregue");
      if (unidadeAtual?.id) qOntem = qOntem.eq("unidade_id", unidadeAtual.id);
      const { data: entregasOntem } = await qOntem;

      // Agrupar por entregador
      const porEntregador: Record<string, EntregadorProdutividade> = {};
      (entregasHoje || []).forEach((e: any) => {
        if (!e.entregador_id) return;
        if (!porEntregador[e.entregador_id]) {
          porEntregador[e.entregador_id] = {
            nome: e.entregadores?.nome || "Sem nome",
            entregasHoje: 0, tempoMedio: 0, entregasOntem: 0,
          };
        }
        porEntregador[e.entregador_id].entregasHoje++;
      });

      const ontemPorEntregador: Record<string, number> = {};
      (entregasOntem || []).forEach((e: any) => {
        if (!e.entregador_id) return;
        ontemPorEntregador[e.entregador_id] = (ontemPorEntregador[e.entregador_id] || 0) + 1;
      });

      Object.keys(porEntregador).forEach(id => {
        porEntregador[id].entregasOntem = ontemPorEntregador[id] || 0;
      });

      const ranking = Object.values(porEntregador).sort((a, b) => b.entregasHoje - a.entregasHoje).slice(0, 5);
      const totalHoje = entregasHoje?.length || 0;
      const totalOntem = entregasOntem?.length || 0;

      setDados({
        totalEntregasHoje: totalHoje,
        totalEntregasOntem: totalOntem,
        tempoMedioGeral: 0,
        entregadoresAtivos: Object.keys(porEntregador).length,
        entregasPorHora: parseFloat((totalHoje / horasPassadas).toFixed(1)),
        ranking,
      });
    } catch (e) {
      console.error("Produtividade error:", e);
    } finally {
      setLoading(false);
    }
  };

  const variacao = dados.totalEntregasOntem > 0
    ? ((dados.totalEntregasHoje - dados.totalEntregasOntem) / dados.totalEntregasOntem * 100)
    : 0;

  if (loading) return (
    <Card>
      <CardContent className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-primary" />
            Produtividade em Tempo Real
          </CardTitle>
          <Badge variant="outline" className="text-[10px] animate-pulse">● LIVE</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold">{dados.totalEntregasHoje}</p>
            <p className="text-[10px] text-muted-foreground">Entregas hoje</p>
            {variacao !== 0 && (
              <p className={`text-[10px] flex items-center justify-center gap-0.5 ${variacao > 0 ? "text-success" : "text-destructive"}`}>
                {variacao > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {variacao > 0 ? "+" : ""}{variacao.toFixed(0)}%
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{dados.entregasPorHora}</p>
            <p className="text-[10px] text-muted-foreground">Entregas/hora</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{dados.entregadoresAtivos}</p>
            <p className="text-[10px] text-muted-foreground">Entregadores ativos</p>
          </div>
        </div>

        {/* Ranking */}
        {dados.ranking.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Top Entregadores</p>
            {dados.ranking.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}°</span>
                  <span className="truncate max-w-[120px]">{e.nome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{e.entregasHoje} entregas</Badge>
                  {e.entregasOntem > 0 && (
                    <span className={`text-[10px] ${e.entregasHoje >= e.entregasOntem ? "text-success" : "text-destructive"}`}>
                      {e.entregasHoje >= e.entregasOntem ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {dados.ranking.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-3">Nenhuma entrega registrada hoje</p>
        )}
      </CardContent>
    </Card>
  );
}
