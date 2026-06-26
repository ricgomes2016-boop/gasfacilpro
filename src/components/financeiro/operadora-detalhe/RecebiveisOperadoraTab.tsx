import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

const fmt = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = String(d).split("-");
  return `${day}/${m}/${y}`;
}

export function RecebiveisOperadoraTab({ operadoraId }: { operadoraId: string }) {
  const { unidadeAtual } = useUnidade();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["recebiveis-operadora", operadoraId, unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase
        .from("conferencia_cartao")
        .select("id,data_venda,data_prevista_deposito,data_deposito_real,tipo,bandeira,parcelas,valor_bruto,valor_taxa,valor_liquido_esperado,valor_liquido_recebido,status")
        .eq("operadora_id", operadoraId)
        .order("data_prevista_deposito", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const recebidos = rows.filter((r: any) => !!r.data_deposito_real);
  const aReceber = rows.filter((r: any) => !r.data_deposito_real);

  const totalRecebido = recebidos.reduce(
    (s: number, r: any) => s + Number(r.valor_liquido_recebido || r.valor_liquido_esperado || 0), 0
  );
  const totalAReceber = aReceber.reduce(
    (s: number, r: any) => s + Number(r.valor_liquido_esperado || 0), 0
  );

  const Tabela = ({ data, dateKey, dateLabel, valorKey, emptyMsg }: any) => (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dateLabel}</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Taxa</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{emptyMsg}</TableCell></TableRow>}
            {data.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{fmtDate(r[dateKey])}</TableCell>
                <TableCell>
                  <span className="capitalize font-medium">{r.tipo}</span>
                  {r.bandeira && <span className="text-muted-foreground"> • {r.bandeira}</span>}
                  {r.parcelas > 1 && <span className="text-[11px] text-muted-foreground ml-1">({r.parcelas}x)</span>}
                </TableCell>
                <TableCell className="text-right">{fmt(Number(r.valor_bruto))}</TableCell>
                <TableCell className="text-right text-destructive">{fmt(Number(r.valor_taxa || 0))}</TableCell>
                <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                  {fmt(Number(r[valorKey] || r.valor_liquido_esperado || 0))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">✅ Recebido</h3>
          <span className="text-xs text-muted-foreground">{recebidos.length} liquidação(ões)</span>
        </div>
        <Tabela data={recebidos} dateKey="data_deposito_real" dateLabel="Liquidação" valorKey="valor_liquido_recebido" emptyMsg="Nenhuma liquidação registrada" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">⏳ A receber</h3>
          <span className="text-xs text-muted-foreground">{aReceber.length} previsão(ões)</span>
        </div>
        <Tabela data={aReceber} dateKey="data_prevista_deposito" dateLabel="Previsão" valorKey="valor_liquido_esperado" emptyMsg="Nada previsto no momento" />
      </div>
    </div>
  );
}
