import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { Empenho } from "./EmpenhosPanel";

interface Props {
  empenho: Empenho | null;
  onClose: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  disponivel: "bg-blue-100 text-blue-700",
  utilizado: "bg-green-100 text-green-700",
  vendido: "bg-yellow-100 text-yellow-700",
  cancelado: "bg-red-100 text-red-700",
};

export function EmpenhoDetalheDialog({ empenho, onClose }: Props) {
  const { data: vales = [], isLoading } = useQuery({
    queryKey: ["empenho-vales", empenho?.id],
    enabled: !!empenho,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("vale_gas")
        .select("id, numero, status, data_utilizacao, cliente_final_id, venda_id")
        .eq("empenho_id", empenho!.id)
        .order("numero");
      return data || [];
    },
  });

  // Buscar nomes de clientes finais se relação não veio
  const { data: clientesMap = {} } = useQuery({
    queryKey: ["empenho-vales-clientes", empenho?.id],
    enabled: !!empenho && vales.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(vales.map((v: any) => v.cliente_final_id).filter(Boolean)));
      if (ids.length === 0) return {};
      const { data } = await (supabase as any).from("clientes").select("id, nome").in("id", ids);
      const map: Record<string, string> = {};
      (data || []).forEach((c: any) => { map[c.id] = c.nome; });
      return map;
    },
  });

  return (
    <Dialog open={!!empenho} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes do Empenho {empenho?.numero_empenho}</DialogTitle>
        </DialogHeader>
        {empenho && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div><span className="text-muted-foreground">Produto:</span> {empenho.produto_nome}</div>
              <div><span className="text-muted-foreground">Quantidade:</span> {empenho.quantidade}</div>
              <div><span className="text-muted-foreground">Entregue:</span> {empenho.quantidade_entregue}</div>
              <div><span className="text-muted-foreground">Saldo:</span> {empenho.quantidade - empenho.quantidade_entregue}</div>
              {empenho.nfe_numero && (
                <div className="col-span-full text-xs text-muted-foreground">
                  NF-e: <strong>{empenho.nfe_numero}</strong> · Obs: "Ref. ao Empenho nº {empenho.numero_empenho}"
                </div>
              )}
            </div>
            <div className="border rounded-lg max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Vale</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Consumido por</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
                  {!isLoading && vales.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhum vale vinculado ainda</TableCell></TableRow>
                  )}
                  {vales.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono">{v.numero}</TableCell>
                      <TableCell><Badge className={STATUS_COLOR[v.status]}>{v.status}</Badge></TableCell>
                      <TableCell>{v.cliente_final_id ? (clientesMap[v.cliente_final_id] ?? "—") : "—"}</TableCell>
                      <TableCell>{v.data_utilizacao ? format(new Date(v.data_utilizacao), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
