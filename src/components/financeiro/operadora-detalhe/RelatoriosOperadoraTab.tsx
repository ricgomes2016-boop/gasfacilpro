import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = String(d).split("-");
  return `${day}/${m}/${y}`;
}

type Modo = "vendi" | "futuro" | "recebido";

export function RelatoriosOperadoraTab({ operadoraId }: { operadoraId: string }) {
  const { unidadeAtual } = useUnidade();
  const [modo, setModo] = useState<Modo>("vendi");
  const hoje = new Date();
  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [inicio, setInicio] = useState(primeiro.toISOString().slice(0, 10));
  const [fim, setFim] = useState(hoje.toISOString().slice(0, 10));

  const { data: rows = [] } = useQuery({
    queryKey: ["relatorio-operadora", operadoraId, unidadeAtual?.id, modo, inicio, fim],
    queryFn: async () => {
      let q = supabase
        .from("conferencia_cartao")
        .select("data_venda,data_prevista_deposito,data_deposito_real,tipo,bandeira,valor_bruto,valor_taxa,valor_liquido_esperado,valor_liquido_recebido")
        .eq("operadora_id", operadoraId);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      if (modo === "vendi") q = q.gte("data_venda", inicio).lte("data_venda", fim);
      if (modo === "futuro") q = q.is("data_deposito_real", null).gte("data_prevista_deposito", inicio).lte("data_prevista_deposito", fim);
      if (modo === "recebido") q = q.not("data_deposito_real", "is", null).gte("data_deposito_real", inicio).lte("data_deposito_real", fim);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const grouped = useMemo(() => {
    const key = modo === "vendi" ? "data_venda" : modo === "futuro" ? "data_prevista_deposito" : "data_deposito_real";
    const map = new Map<string, { bruto: number; liq: number; n: number }>();
    rows.forEach((r: any) => {
      const k = r[key] || "—";
      const liq = Number(r.valor_liquido_recebido || r.valor_liquido_esperado || 0);
      const cur = map.get(k) || { bruto: 0, liq: 0, n: 0 };
      cur.bruto += Number(r.valor_bruto || 0);
      cur.liq += liq;
      cur.n += 1;
      map.set(k, cur);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows, modo]);

  const totBruto = grouped.reduce((s, [, v]) => s + v.bruto, 0);
  const totLiq = grouped.reduce((s, [, v]) => s + v.liq, 0);

  const exportCsv = () => {
    const head = ["Data", "Quantidade", "Bruto", "Líquido"];
    const lines = grouped.map(([d, v]) => [fmtDate(d), v.n, v.bruto.toFixed(2), v.liq.toFixed(2)].join(";"));
    const blob = new Blob([[head.join(";"), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio_${modo}_${inicio}_${fim}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
          {([
            { k: "vendi", label: "O que vendi" },
            { k: "futuro", label: "O que vou receber" },
            { k: "recebido", label: "Recebido" },
          ] as { k: Modo; label: string }[]).map((b) => (
            <button
              key={b.k}
              onClick={() => setModo(b.k)}
              className={`px-3 py-1.5 text-xs rounded-md transition ${modo === b.k ? "bg-background shadow-sm font-semibold" : "text-muted-foreground"}`}
            >{b.label}</button>
          ))}
        </div>
        <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-[160px]" />
        <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-[160px]" />
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 ml-auto">
          <Download className="h-4 w-4" />CSV
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs">Total bruto</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-primary">{fmt(totBruto)}</p></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs">Total líquido</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{fmt(totLiq)}</p></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs">Registros</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{rows.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sem dados no período</TableCell></TableRow>}
              {grouped.map(([d, v]) => (
                <TableRow key={d}>
                  <TableCell>{fmtDate(d)}</TableCell>
                  <TableCell className="text-right">{v.n}</TableCell>
                  <TableCell className="text-right">{fmt(v.bruto)}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">{fmt(v.liq)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
