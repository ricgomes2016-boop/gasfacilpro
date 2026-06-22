import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subDays } from "date-fns";

interface Props {
  contaId: string;
  saldoAtual: number;
}

export default function ExtratoTabela({ contaId, saldoAtual }: Props) {
  const [inicio, setInicio] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [fim, setFim] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: movs = [], isLoading } = useQuery({
    queryKey: ["extrato-tabela", contaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes_bancarias")
        .select("*")
        .eq("conta_bancaria_id", contaId)
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const rows = useMemo(() => {
    // Calcula saldo acumulado de trás pra frente partindo do saldo atual
    const totalEntradas = movs.filter((m: any) => m.tipo === "entrada").reduce((s, m: any) => s + Number(m.valor), 0);
    const totalSaidas = movs.filter((m: any) => m.tipo === "saida").reduce((s, m: any) => s + Number(m.valor), 0);
    let saldoInicial = saldoAtual - totalEntradas + totalSaidas;
    let acc = saldoInicial;
    return movs.map((m: any) => {
      const entrada = m.tipo === "entrada" ? Number(m.valor) : 0;
      const saida = m.tipo === "saida" ? Number(m.valor) : 0;
      acc += entrada - saida;
      return { ...m, entrada, saida, total: acc };
    });
  }, [movs, saldoAtual]);

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">Início</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Entrada</TableHead>
                <TableHead className="text-right">Saída</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem movimentações no período.</TableCell></TableRow>
              )}
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.data), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">{r.descricao}</div>
                    {r.categoria && <div className="text-xs text-muted-foreground">{r.categoria}</div>}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-medium">{r.entrada ? fmt(r.entrada) : "-"}</TableCell>
                  <TableCell className="text-right text-destructive font-medium">{r.saida ? fmt(r.saida) : "-"}</TableCell>
                  <TableCell className="text-right font-bold">{fmt(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
