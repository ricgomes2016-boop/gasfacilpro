import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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

const isRecebido = (s: string) => s === "recebido" || s === "recebida";

export function RecebiveisOperadoraTab({ operadoraId }: { operadoraId: string }) {
  const { unidadeAtual } = useUnidade();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["recebiveis-operadora-cr", operadoraId, unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase
        .from("contas_receber")
        .select("id,created_at,vencimento,data_recebimento,forma_pagamento,total_parcelas,valor,valor_taxa,valor_liquido,status")
        .eq("operadora_id", operadoraId)
        .in("forma_pagamento", ["cartao_credito", "cartao_debito", "pix_maquininha"])
        .order("vencimento", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const recebidos = rows.filter((r: any) => isRecebido(r.status));
  const aReceber = rows.filter((r: any) => !isRecebido(r.status));

  const Tabela = ({ data, dateKey, dateLabel, emptyMsg }: any) => (
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
            {data.map((r: any) => {
              const liquido = Number(r.valor_liquido ?? (Number(r.valor) - Number(r.valor_taxa || 0)));
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(r[dateKey])}</TableCell>
                  <TableCell>
                    <span className="capitalize font-medium">{tipoLabel(r.forma_pagamento)}</span>
                    {r.total_parcelas > 1 && <span className="text-[11px] text-muted-foreground ml-1">({r.total_parcelas}x)</span>}
                  </TableCell>
                  <TableCell className="text-right">{fmt(Number(r.valor))}</TableCell>
                  <TableCell className="text-right text-destructive">{fmt(Number(r.valor_taxa || 0))}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    {fmt(liquido)}
                  </TableCell>
                </TableRow>
              );
            })}
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
        <Tabela data={recebidos} dateKey="data_recebimento" dateLabel="Liquidação" emptyMsg="Nenhuma liquidação registrada" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">⏳ A receber</h3>
          <span className="text-xs text-muted-foreground">{aReceber.length} previsão(ões)</span>
        </div>
        <Tabela data={aReceber} dateKey="vencimento" dateLabel="Previsão" emptyMsg="Nada previsto no momento" />
      </div>
    </div>
  );
}
