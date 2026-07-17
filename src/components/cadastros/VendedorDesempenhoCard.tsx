import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Target, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Props {
  funcionarioId: string;
}

interface Stats {
  qtdVendas: number;
  totalVendas: number;
  meta: number;
  comissaoEstimada: number;
}

export function VendedorDesempenhoCard({ funcionarioId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: meta } = await (supabase as any)
          .from("vendedor_metas")
          .select("user_id, meta_mensal, percentual, valor_fixo_comissao, tipo_comissao")
          .eq("funcionario_id", funcionarioId)
          .maybeSingle();

        if (!meta?.user_id) {
          setStats({ qtdVendas: 0, totalVendas: 0, meta: meta?.meta_mensal || 0, comissaoEstimada: 0 });
          return;
        }

        const inicio = new Date();
        inicio.setDate(1);
        inicio.setHours(0, 0, 0, 0);

        const { data: pedidos } = await (supabase as any)
          .from("pedidos")
          .select("total")
          .eq("vendedor_id", meta.user_id)
          .gte("created_at", inicio.toISOString());

        const qtdVendas = pedidos?.length || 0;
        const totalVendas = (pedidos || []).reduce((s: number, p: any) => s + (Number(p.total) || 0), 0);
        const comissaoEstimada =
          meta.tipo_comissao === "valor_fixo"
            ? qtdVendas * Number(meta.valor_fixo_comissao || 0)
            : totalVendas * (Number(meta.percentual || 0) / 100);

        setStats({
          qtdVendas,
          totalVendas,
          meta: Number(meta.meta_mensal || 0),
          comissaoEstimada,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [funcionarioId]);

  if (loading) return <p className="text-xs text-muted-foreground">Carregando desempenho…</p>;
  if (!stats) return null;

  const pct = stats.meta > 0 ? Math.min(100, (stats.totalVendas / stats.meta) * 100) : 0;

  return (
    <div className="space-y-3 p-3 rounded-md bg-background border">
      <p className="text-sm font-medium flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-success" />
        Desempenho do mês
      </p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Vendas</p>
          <p className="text-lg font-bold">{stats.qtdVendas}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold">
            R$ {stats.totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <DollarSign className="h-3 w-3" /> Comissão
          </p>
          <p className="text-lg font-bold text-success">
            R$ {stats.comissaoEstimada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
      {stats.meta > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" /> Meta: R$ {stats.meta.toLocaleString("pt-BR")}
            </span>
            <span className="font-medium">{pct.toFixed(0)}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      )}
    </div>
  );
}
