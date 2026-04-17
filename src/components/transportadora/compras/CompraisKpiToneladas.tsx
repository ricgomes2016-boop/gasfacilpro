import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Package } from "lucide-react";

interface Props { compras: any[]; }

export function ComprasKpiToneladas({ compras }: Props) {
  const stats = useMemo(() => {
    let p13 = 0, p20 = 0, p45 = 0, agua = 0;
    compras.forEach((c) => {
      p13 += Number(c.qtd_p13 || 0);
      p20 += Number(c.qtd_p20 || 0);
      p45 += Number(c.qtd_p45 || 0);
      agua += Number(c.qtd_agua || 0);
    });
    const toneladas = (p13 * 13 + p20 * 20 + p45 * 45) / 1000;
    return { p13, p20, p45, agua, toneladas };
  }, [compras]);

  const items = [
    { label: "P13 (13kg)", value: stats.p13, sub: "unidades", color: "text-foreground" },
    { label: "P20 (20kg)", value: stats.p20, sub: "unidades", color: "text-foreground" },
    { label: "P45 (45kg)", value: stats.p45, sub: "unidades", color: "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((i) => (
        <Card key={i.label} className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{i.label}</p>
            </div>
            <p className={`text-2xl font-bold ${i.color}`}>{i.value.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{i.sub}</p>
          </CardContent>
        </Card>
      ))}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs text-muted-foreground">Total GLP Cheio</p>
          </div>
          <p className="text-3xl font-bold text-primary">{stats.toneladas.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">toneladas</p>
        </CardContent>
      </Card>
    </div>
  );
}
