import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Target, TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

interface MesData {
  mes: string;
  realizado: number;
}

export default function PlanejamentoAnual({ embedded = false }: { embedded?: boolean }) {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [meses, setMeses] = useState<MesData[]>([]);

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const dados: MesData[] = [];

      for (let m = 0; m < 12; m++) {
        const inicio = new Date(now.getFullYear(), m, 1).toISOString();
        const fim = new Date(now.getFullYear(), m + 1, 1).toISOString();

        if (m <= now.getMonth()) {
          let pq = supabase.from("pedidos").select("valor_total").gte("created_at", inicio).lt("created_at", fim).neq("status", "cancelado");
          if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);
          const { data: pedidos } = await pq;
          dados.push({ mes: nomesMeses[m], realizado: pedidos?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0 });
        } else {
          dados.push({ mes: nomesMeses[m], realizado: 0 });
        }
      }
      setMeses(dados);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    const loader = <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    if (embedded) return loader;
    return (
      <MainLayout>
        <Header title="Planejamento Anual" subtitle={`Resultados ${new Date().getFullYear()}`} />
        {loader}
      </MainLayout>
    );
  }

  const totalRealizado = meses.reduce((s, m) => s + m.realizado, 0);

  const content = (
    <div className="space-y-6">


        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><Target className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">R$ {(totalRealizado / 1000).toFixed(1)}k</p><p className="text-sm text-muted-foreground">Total Anual</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-green-500/10"><TrendingUp className="h-6 w-6 text-green-500" /></div><div><p className="text-2xl font-bold">R$ {totalRealizado.toLocaleString("pt-BR")}</p><p className="text-sm text-muted-foreground">Realizado YTD</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-blue-500/10"><Calendar className="h-6 w-6 text-blue-500" /></div><div><p className="text-2xl font-bold">{new Date().getMonth() + 1}/12</p><p className="text-sm text-muted-foreground">Meses com dados</p></div></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Resultados Mensais</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Realizado</TableHead></TableRow></TableHeader>
              <TableBody>
                {meses.map((item) => (
                  <TableRow key={item.mes}>
                    <TableCell className="font-medium">{item.mes}</TableCell>
                    <TableCell className="text-right">{item.realizado > 0 ? `R$ ${item.realizado.toLocaleString("pt-BR")}` : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
      </Card>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Planejamento Anual" subtitle={`Resultados ${new Date().getFullYear()}`} />
      <div className="p-3 sm:p-4 md:p-6">{content}</div>
    </MainLayout>
  );
}
