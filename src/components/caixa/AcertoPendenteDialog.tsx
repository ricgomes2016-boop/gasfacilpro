import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ExternalLink } from "lucide-react";

interface PendenteDetalhe {
  entregador: string;
  canal: string;
  pedidoId: string;
  valor: number;
  data: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detalhes: PendenteDetalhe[];
}

export function AcertoPendenteDialog({ open, onOpenChange, detalhes }: Props) {
  const navigate = useNavigate();

  // Agrupar por responsável (entregador ou canal)
  const agrupados = useMemo(() => {
    const map = new Map<string, { pedidos: number; total: number; canal: string }>();
    detalhes.forEach((d) => {
      const key = d.entregador;
      const cur = map.get(key) || { pedidos: 0, total: 0, canal: d.canal };
      cur.pedidos += 1;
      cur.total += d.valor;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([responsavel, v]) => ({ responsavel, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [detalhes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Acertos Pendentes — Detalhes
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[450px] overflow-y-auto">
          {detalhes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum acerto pendente</p>
          ) : (
            <>
              {/* Resumo agrupado por responsável */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Resumo por Responsável
                </p>
                {agrupados.map((g) => (
                  <div
                    key={g.responsavel}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{g.responsavel}</span>
                      <Badge variant="secondary" className="text-xs">{g.pedidos} pedido{g.pedidos > 1 ? "s" : ""}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm whitespace-nowrap">R$ {g.total.toFixed(2)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          onOpenChange(false);
                          navigate("/caixa/acerto");
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Acertar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Detalhes individuais */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Pedidos Detalhados
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalhes.map((d) => (
                      <TableRow key={d.pedidoId}>
                        <TableCell className="text-xs">{d.data}</TableCell>
                        <TableCell className="text-sm font-medium">{d.entregador}</TableCell>
                        <TableCell className="text-sm">{d.canal}</TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">R$ {d.valor.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        R$ {detalhes.reduce((s, d) => s + d.valor, 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
