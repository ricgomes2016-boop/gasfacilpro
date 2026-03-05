import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowDown, TrendingDown } from "lucide-react";

interface Alerta {
  produto: string;
  concorrente: string;
  precoConcorrente: number;
  nossoPreco: number;
  tipo: string;
  diff: number;
}

interface Props {
  alertas: Alerta[];
}

export function AlertasPreco({ alertas }: Props) {
  if (alertas.length === 0) return null;

  return (
    <Card className="border-orange-200 dark:border-orange-900">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          Alertas de Preço
          <Badge variant="destructive" className="text-[10px] ml-auto">{alertas.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alertas.slice(0, 5).map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/50">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{a.produto}</div>
              <div className="text-muted-foreground truncate">
                {a.concorrente} · {a.tipo === 'portaria' ? 'Portaria' : a.tipo === 'telefone' ? 'Telefone' : 'Único'}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1 text-red-600">
                <ArrowDown className="h-3 w-3" />
                R$ {a.precoConcorrente.toFixed(2)}
              </div>
              <div className="text-muted-foreground line-through">R$ {a.nossoPreco.toFixed(2)}</div>
            </div>
            <Badge variant="destructive" className="text-[9px] shrink-0">
              {a.diff.toFixed(0)}% menor
            </Badge>
          </div>
        ))}
        {alertas.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">+ {alertas.length - 5} mais alertas</p>
        )}
      </CardContent>
    </Card>
  );
}
