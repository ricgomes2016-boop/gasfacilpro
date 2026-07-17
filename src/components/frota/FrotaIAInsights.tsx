import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, TrendingDown, AlertCircle, 
  Lightbulb, Zap, DollarSign, Fuel, Wrench, 
  Target, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Loader2 } from "lucide-react";

interface InsightData {
  title: string;
  value: string;
  description: string;
  trend: "up" | "down" | "neutral";
  icon: any;
  color: string;
}

interface Recommendation {
  text: string;
  type: "warning" | "tip" | "info";
}

export function FrotaIAInsights() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightData[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    fetchAIAnalysis();
  }, [unidadeAtual?.id]);

  const fetchAIAnalysis = async () => {
    setLoading(true);
    try {
      // 1. Fetch all relevant data
      const [
        { data: abasts },
        { data: manuts },
        { data: pedidos },
        { data: rotas },
        { data: veiculos }
      ] = await Promise.all([
        supabase.from("abastecimentos").select("valor, km").eq("unidade_id", unidadeAtual?.id),
        supabase.from("manutencoes").select("valor, km_atual").eq("unidade_id", unidadeAtual?.id),
        supabase.from("pedidos").select("id").eq("unidade_id", unidadeAtual?.id).eq("status", "Concluído"),
        supabase.from("rotas").select("km_inicial, km_final").eq("status", "Finalizada"),
        supabase.from("veiculos").select("id, placa, km_atual").eq("unidade_id", unidadeAtual?.id).eq("ativo", true)
      ]);

      // 2. Calculate Metrics
      const totalFuel = (abasts as any[])?.reduce((sum, a) => sum + Number(a.valor), 0) || 0;
      const totalMaint = (manuts as any[])?.reduce((sum, m) => sum + Number(m.valor), 0) || 0;
      const totalCost = totalFuel + totalMaint;
      const totalDeliveries = pedidos?.length || 0;

      // Delta KM - using routes as primary source
      const totalKM = rotas?.reduce((sum, r) => sum + (Number(r.km_final || 0) - Number(r.km_inicial || 0)), 0) || 0;

      const costPerKM = totalKM > 0 ? totalCost / totalKM : 0;
      const costPerDelivery = totalDeliveries > 0 ? totalCost / totalDeliveries : 0;

      // 3. Generate Insights
      const newInsights: InsightData[] = [
        {
          title: "Custo por KM",
          value: `R$ ${costPerKM.toFixed(2)}`,
          description: "Média de custo total por km rodado",
          trend: costPerKM < 2 ? "down" : "up",
          icon: Fuel,
          color: costPerKM < 3 ? "text-success" : "text-warning"
        },
        {
          title: "Custo por Entrega",
          value: `R$ ${costPerDelivery.toFixed(2)}`,
          description: "Impacto da frota no frete da venda",
          trend: "neutral",
          icon: Target,
          color: "text-info"
        },
        {
          title: "Eficiência de Manutenção",
          value: totalKM > 0 ? `${(totalMaint / totalKM).toFixed(2)} R$/km` : "R$ 0,00",
          description: "Desgaste financeiro por km",
          trend: "neutral",
          icon: Wrench,
          color: "text-primary"
        }
      ];

      // 4. Generate AI Recommendations
      const newRecs: Recommendation[] = [];
      
      if (costPerKM > 4) {
        newRecs.push({
          text: "O custo por KM está elevado. Verifique veículos com consumo acima da média ou rotas ineficientes.",
          type: "warning"
        });
      } else {
        newRecs.push({
          text: "Excelente! Seu custo por KM está dentro da meta de eficiência.",
          type: "tip"
        });
      }

      if (totalDeliveries > 0 && costPerDelivery > 10) {
        newRecs.push({
          text: "Considere agrupar mais entregas na mesma rota para reduzir o custo unitário por venda.",
          type: "info"
        });
      }

      // Previsão de manutenção (exemplo simples)
      veiculos?.forEach(v => {
          if (v.km_atual && v.km_atual > 0) {
              const kmParaRevisao = 10000 - (v.km_atual % 10000);
              if (kmParaRevisao < 1000) {
                  newRecs.push({
                      text: `Veículo ${v.placa} está próximo de uma revisão periódica (~${kmParaRevisao} km).`,
                      type: "warning"
                  });
              }
          }
      });

      setInsights(newInsights);
      setRecommendations(newRecs);
    } catch (err) {
      console.error("Error generating AI insights:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-muted/5 border-dashed">
        <CardContent className="h-40 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">O Agente de IA está analisando sua frota...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-5 w-5 text-warning fill-warning" />
        <h3 className="text-lg font-bold tracking-tight">Insights da IA</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insights.map((insight, i) => (
          <Card key={i} className="overflow-hidden border-l-4" style={{ borderColor: "var(--primary)" }}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{insight.title}</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${insight.color}`}>{insight.value}</span>
                  </div>
                </div>
                <div className={`p-2 rounded-lg bg-muted/50 ${insight.color}`}>
                  <insight.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{insight.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-primary/5 border-primary/20 shadow-sm">
        <CardHeader className="py-3 px-4 flex flex-row items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Sugestões e Otimizações</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          {recommendations.length > 0 ? (
            recommendations.map((rec, i) => (
              <div key={i} className="flex gap-3 text-sm items-start">
                {rec.type === "warning" ? (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                ) : rec.type === "tip" ? (
                  <TrendingUp className="h-4 w-4 text-success shrink-0 mt-0.5" />
                ) : (
                  <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
                )}
                <span className="leading-tight">{rec.text}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground italic">Nenhuma recomendação no momento. Continue o bom trabalho!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
