import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDate(d: string | null) {
  if (!d) return "—";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  return `${day}/${m}/${y}`;
}

function tipoLabel(fp: string | null): string {
  switch (fp) {
    case "cartao_credito": return "crédito";
    case "cartao_debito": return "débito";
    case "pix_maquininha": return "pix maquininha";
    default: return fp || "—";
  }
}

export function VendasOperadoraTab({ operadoraId }: { operadoraId: string }) {
  const { unidadeAtual } = useUnidade();
  const [busca, setBusca] = useState("");
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [inicio, setInicio] = useState(primeiroDia.toISOString().slice(0, 10));
  const [fim, setFim] = useState(hoje.toISOString().slice(0, 10));

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vendas-operadora-cr", operadoraId, unidadeAtual?.id, inicio, fim],
    queryFn: async () => {
      let q = supabase
        .from("contas_receber")
        .select("id,created_at,forma_pagamento,valor,valor_taxa,valor_liquido,status,pedido_id,descricao,total_parcelas,vencimento,data_recebimento")
        .eq("operadora_id", operadoraId)
        .in("forma_pagamento", ["cartao_credito", "cartao_debito", "pix_maquininha"])
        .gte("created_at", `${inicio}T00:00:00`)
        .lte("created_at", `${fim}T23:59:59`)
        .order("created_at", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r: any) =>
      [r.forma_pagamento, r.descricao].some((x) =>
        String(x || "").toLowerCase().includes(t)
      )
    );
  }, [rows, busca]);

  const exportCsv = () => {
    const head = ["Data", "Descrição", "Parcelas", "Valor da venda", "Valor líquido"];
    const lines = filtered.map((r: any) => [
      fmtDate(r.created_at),
      tipoLabel(r.forma_pagamento),
      r.total_parcelas || 1,
      Number(r.valor || 0).toFixed(2),
      Number(r.valor_liquido || (r.valor - (r.valor_taxa || 0)) || 0).toFixed(2),
    ].join(";"));
    const blob = new Blob([[head.join(";"), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vendas_operadora_${inicio}_${fim}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">

      <div className="flex gap-2 flex-wrap items-center">
        <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-[160px]" />
        <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-[160px]" />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Forma, descrição..." className="pl-8" />
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
          <Download className="h-4 w-4" />CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor da venda</TableHead>
                <TableHead className="text-right">Valor líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma venda no período</TableCell></TableRow>
              )}
              {filtered.map((r: any) => {
                const liquido = Number(r.valor_liquido ?? (Number(r.valor) - Number(r.valor_taxa || 0)));
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium capitalize">{tipoLabel(r.forma_pagamento)}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {r.total_parcelas > 1 ? `${r.total_parcelas}x • ` : ""}{r.descricao || ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(r.valor))}</TableCell>
                    <TableCell className="text-right text-emerald-700 dark:text-emerald-400 font-semibold">
                      {fmt(liquido)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
