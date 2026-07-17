import { Card, CardContent } from "@/components/ui/card";
import { Activity, Clock, Target } from "lucide-react";
import type { PedidoOp, EntregadorOp } from "@/hooks/useMapaOperacionalData";

interface Props {
  pedidos: PedidoOp[];
  entregadores: EntregadorOp[];
  dadosOp: Record<string, any>;
}

export function CardProdutividade({ pedidos, entregadores, dadosOp }: Props) {
  const entregues = pedidos.filter((p) => p.status === "entregue");
  const total = pedidos.length || 1;
  const noPrazo = entregues.filter((p) => {
    const t = (Date.now() - new Date(p.created_at).getTime()) / 60000;
    return t <= 60;
  }).length;

  // Tempo médio de rota a partir de dadosOp
  const temposRota = Object.values(dadosOp)
    .map((d: any) => d?.tempo)
    .filter((t: any) => typeof t === "number" && t > 0);
  const tempoMedioMin = temposRota.length
    ? Math.round((temposRota.reduce((a: number, b: number) => a + b, 0) / temposRota.length) / 60)
    : 0;

  const ativos = entregadores.filter((e) => (e.pedidosAtivos || 0) > 0).length || 1;
  const horas = Math.max(1, tempoMedioMin / 60 || 1);
  const entregasHora = (entregues.length / ativos / horas).toFixed(1);
  const pctPrazo = Math.round((noPrazo / Math.max(entregues.length, 1)) * 100);

  const cards = [
    { icon: Activity, label: "Entregas/hora", valor: entregasHora, cor: "text-info" },
    { icon: Clock, label: "Tempo médio", valor: `${tempoMedioMin}min`, cor: "text-success" },
    { icon: Target, label: "% no prazo", valor: `${pctPrazo}%`, cor: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-3 text-center">
            <c.icon className={`h-4 w-4 mx-auto mb-1 ${c.cor}`} />
            <p className="text-base font-bold">{c.valor}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{c.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
