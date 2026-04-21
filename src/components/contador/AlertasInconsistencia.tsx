import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Crown, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { ContadorUnidade } from "@/contexts/ContadorContext";

export interface UnidadeStats {
  id: string;
  nome: string;
  tipo: string;
  pedidos: number;
  despesas: number;
  xmls: number;
  extratos: number;
}

interface Props {
  unidades: ContadorUnidade[];
  statsPorUnidade: Record<string, UnidadeStats>;
}

interface Alerta {
  unidade: UnidadeStats;
  tipo: "amber" | "gray";
  texto: string;
  link: string;
}

export function AlertasInconsistencia({ unidades, statsPorUnidade }: Props) {
  if (unidades.length <= 1) return null;

  const alertas: Alerta[] = [];
  unidades.forEach((u) => {
    const s = statsPorUnidade[u.id];
    if (!s) return;
    if (s.pedidos === 0)
      alertas.push({ unidade: s, tipo: "amber", texto: "Sem receita registrada", link: "/contador/financeiro" });
    if (s.despesas === 0)
      alertas.push({ unidade: s, tipo: "amber", texto: "Sem despesas lançadas", link: "/contador/despesas" });
    if (s.xmls === 0)
      alertas.push({ unidade: s, tipo: "gray", texto: "Sem XMLs no período", link: "/contador/xml" });
    if (s.extratos === 0)
      alertas.push({ unidade: s, tipo: "gray", texto: "Sem extrato bancário", link: "/contador/financeiro" });
  });

  if (alertas.length === 0) {
    return (
      <Card className="bg-[hsl(150,40%,12%)] border-[hsl(150,60%,30%)]/40">
        <CardContent className="p-3 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-[hsl(150,70%,55%)] shrink-0" />
          <p className="text-sm text-[hsl(150,40%,80%)]">
            Todas as {unidades.length} lojas com lançamentos no período. ✓
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[hsl(220,22%,11%)] border-[hsl(38,80%,40%)]/40">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-[hsl(38,90%,60%)]" />
          <h3 className="text-sm font-semibold text-[hsl(0,0%,95%)]">
            Alertas de inconsistência ({alertas.length})
          </h3>
        </div>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {alertas.map((a, i) => (
            <Link
              key={i}
              to={a.link}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-[hsl(220,18%,13%)] hover:bg-[hsl(220,18%,16%)] border border-[hsl(220,15%,18%)] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {a.unidade.tipo === "matriz" ? (
                  <Crown className="h-3.5 w-3.5 text-[hsl(165,60%,55%)] shrink-0" />
                ) : (
                  <MapPin className="h-3.5 w-3.5 text-[hsl(220,10%,55%)] shrink-0" />
                )}
                <span className="text-sm text-[hsl(0,0%,90%)] truncate">{a.unidade.nome}</span>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  a.tipo === "amber"
                    ? "bg-[hsl(38,90%,55%)]/15 text-[hsl(38,90%,65%)] border border-[hsl(38,90%,55%)]/30"
                    : "bg-[hsl(220,15%,30%)]/30 text-[hsl(220,10%,70%)] border border-[hsl(220,15%,30%)]"
                }`}
              >
                {a.texto}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
