import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Plug, Zap, Shield } from "lucide-react";

interface IntegracoesKpisProps {
  conectadas: number;
  disponiveis: number;
  emBreve: number;
  total: number;
}

export function IntegracoesKpis({ conectadas, disponiveis, emBreve, total }: IntegracoesKpisProps) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{conectadas}</p>
              <p className="text-xs text-muted-foreground">Ativas</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-info/10">
              <Plug className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{disponiveis}</p>
              <p className="text-xs text-muted-foreground">Disponíveis</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-warning/10">
              <Zap className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{emBreve}</p>
              <p className="text-xs text-muted-foreground">Em breve</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-muted">
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
