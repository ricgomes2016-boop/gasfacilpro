import { useState } from "react";
import { TransportadoraLayout } from "@/components/transportadora/TransportadoraLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatNumber } from "@/lib/transp-utils";
import { FileBarChart, Download } from "lucide-react";

export default function TranspRelatorios() {
  const { user } = useAuth();
  const [filtro, setFiltro] = useState("geral");
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));

  const { data: despesas = [] } = useQuery({
    queryKey: ["transp-despesas-rel"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transp_despesas").select("*").order("data", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: abastecimentos = [] } = useQuery({
    queryKey: ["transp-abastecimentos-rel"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transp_abastecimentos").select("*").order("data", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: entregas = [] } = useQuery({
    queryKey: ["transp-entregas-rel"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transp_entregas").select("*").order("data", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ["transp-veiculos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transp_veiculos").select("*").eq("ativo", true);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["unidades-transp"],
    queryFn: async () => {
      const { data } = await supabase.from("unidades").select("id, nome").eq("ativo", true);
      return data || [];
    },
    enabled: !!user,
  });

  const despesasPeriodo = despesas.filter((d: any) => d.data?.startsWith(periodo));
  const abastecimentosPeriodo = abastecimentos.filter((a: any) => a.data?.startsWith(periodo));
  const entregasPeriodo = entregas.filter((e: any) => e.data?.startsWith(periodo));

  const totalDespesas = despesasPeriodo.reduce((acc: number, d: any) => acc + Number(d.valor), 0);
  const totalP13 = abastecimentosPeriodo.reduce((acc: number, a: any) => acc + Number(a.p13_equivalente), 0);
  const custoReal = totalP13 > 0 ? totalDespesas / totalP13 : 0;

  // Per-vehicle cost
  const custosPorVeiculo = veiculos.map((v: any) => {
    const desp = despesasPeriodo.filter((d: any) => d.veiculo_id === v.id);
    return { placa: v.placa, total: desp.reduce((a: number, d: any) => a + Number(d.valor), 0) };
  }).filter((v: any) => v.total > 0).sort((a: any, b: any) => b.total - a.total);

  // Per-filial cost
  const custosPorFilial = unidades.map((u: any) => {
    const abs = abastecimentosPeriodo.filter((a: any) => a.destino_unidade_id === u.id);
    const totalCusto = abs.reduce((a: number, ab: any) => a + Number(ab.custo_logistico), 0);
    const totalUnid = abs.reduce((a: number, ab: any) => a + Number(ab.p13_equivalente), 0);
    return { nome: u.nome, totalCusto, totalUnid, custoUnit: totalUnid > 0 ? totalCusto / totalUnid : 0 };
  }).filter((f: any) => f.totalCusto > 0).sort((a: any, b: any) => b.totalCusto - a.totalCusto);

  const getUnidadeNome = (id: string) => unidades.find((u: any) => u.id === id)?.nome || "—";

  return (
    <TransportadoraLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground text-sm">Análise detalhada por período</p>
          </div>
          <div className="flex gap-3 items-end">
            <div><Label className="text-xs">Período</Label><Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-40" /></div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border/40"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Despesas</p><p className="text-xl font-bold text-foreground">{formatCurrency(totalDespesas)}</p></CardContent></Card>
          <Card className="border-border/40"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Transportado</p><p className="text-xl font-bold text-foreground">{formatNumber(totalP13, 0)} P13 eq.</p></CardContent></Card>
          <Card className="border-border/40"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Custo Real / P13</p><p className="text-xl font-bold text-primary">{formatCurrency(custoReal)}</p></CardContent></Card>
        </div>

        {/* Per Vehicle */}
        <Card className="border-border/40">
          <CardHeader><CardTitle className="text-base">Custo por Veículo</CardTitle></CardHeader>
          <CardContent>
            {custosPorVeiculo.length > 0 ? (
              <div className="space-y-2">
                {custosPorVeiculo.map((v: any) => (
                  <div key={v.placa} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium text-foreground">{v.placa}</span>
                    <span className="font-bold text-foreground">{formatCurrency(v.total)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Sem dados no período</p>}
          </CardContent>
        </Card>

        {/* Per Filial */}
        <Card className="border-border/40">
          <CardHeader><CardTitle className="text-base">Custo de Transferência por Filial</CardTitle></CardHeader>
          <CardContent>
            {custosPorFilial.length > 0 ? (
              <div className="space-y-2">
                {custosPorFilial.map((f: any) => (
                  <div key={f.nome} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-foreground">{f.nome}</span>
                      <span className="text-xs text-muted-foreground ml-2">({formatNumber(f.totalUnid, 0)} un · {formatCurrency(f.custoUnit)}/un)</span>
                    </div>
                    <span className="font-bold text-foreground">{formatCurrency(f.totalCusto)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Sem dados no período</p>}
          </CardContent>
        </Card>

        {/* Recent transfers */}
        <Card className="border-border/40">
          <CardHeader><CardTitle className="text-base">Últimas Transferências do Período</CardTitle></CardHeader>
          <CardContent>
            {abastecimentosPeriodo.length > 0 ? (
              <div className="space-y-2">
                {abastecimentosPeriodo.slice(0, 10).map((a: any) => (
                  <div key={a.id} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg text-sm">
                    <span className="text-foreground">{getUnidadeNome(a.origem_unidade_id)} → {getUnidadeNome(a.destino_unidade_id)}</span>
                    <span className="text-muted-foreground">{a.data}</span>
                    <span className="font-bold text-foreground">{formatCurrency(Number(a.custo_logistico))}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Sem transferências no período</p>}
          </CardContent>
        </Card>
      </div>
    </TransportadoraLayout>
  );
}
