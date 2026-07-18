import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal, Crown, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FinancialHeroCard } from "@/components/ui/financial-hero-card";

export default function RankingClientes() {
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<any[]>([]);
  const [totalGeral, setTotalGeral] = useState(0);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: pedidos } = await supabase.from("pedidos").select("cliente_id, valor_total, created_at, clientes(nome)").neq("status", "cancelado").order("created_at", { ascending: false });

      const clienteMap: Record<string, { nome: string; compras: number; valorTotal: number; ultimaCompra: string }> = {};
      pedidos?.forEach((p: any) => {
        if (p.cliente_id) {
          if (!clienteMap[p.cliente_id]) clienteMap[p.cliente_id] = { nome: p.clientes?.nome || "Desconhecido", compras: 0, valorTotal: 0, ultimaCompra: p.created_at };
          clienteMap[p.cliente_id].compras++;
          clienteMap[p.cliente_id].valorTotal += Number(p.valor_total) || 0;
          if (p.created_at > clienteMap[p.cliente_id].ultimaCompra) clienteMap[p.cliente_id].ultimaCompra = p.created_at;
        }
      });

      const sorted = Object.values(clienteMap).sort((a, b) => b.valorTotal - a.valorTotal).slice(0, 20);
      setRanking(sorted.map((c, i) => ({ ...c, posicao: i + 1 })));
      setTotalGeral(sorted.reduce((s, c) => s + c.valorTotal, 0));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) {
    return (<MainLayout><Header title="Ranking de Clientes" subtitle="Top clientes por volume de compras" /><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></MainLayout>);
  }

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const first = ranking[0];
  const second = ranking[1];
  const third = ranking[2];
  const maxVal = first?.valorTotal || 1;

  return (
    <MainLayout>
      <Header title="Ranking de Clientes" subtitle="Top clientes por volume de compras" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        {first && (
          <div className="grid gap-4 lg:grid-cols-3">
            <FinancialHeroCard
              title="1º Lugar"
              value={fmt(first.valorTotal)}
              subtitle={first.nome}
              color="warning"
              icon={Crown}
              progress={100}
              details={[
                { label: "Compras", value: first.compras },
                { label: "Última", value: new Date(first.ultimaCompra).toLocaleDateString("pt-BR") },
              ]}
            />
            {second && (
              <FinancialHeroCard
                title="2º Lugar"
                value={fmt(second.valorTotal)}
                subtitle={second.nome}
                color="info"
                icon={Medal}
                progress={Math.round((second.valorTotal / maxVal) * 100)}
                details={[
                  { label: "Compras", value: second.compras },
                  { label: "Última", value: new Date(second.ultimaCompra).toLocaleDateString("pt-BR") },
                ]}
              />
            )}
            {third && (
              <FinancialHeroCard
                title="3º Lugar"
                value={fmt(third.valorTotal)}
                subtitle={third.nome}
                color="violet"
                icon={Trophy}
                progress={Math.round((third.valorTotal / maxVal) * 100)}
                details={[
                  { label: "Compras", value: third.compras },
                  { label: "Última", value: new Date(third.ultimaCompra).toLocaleDateString("pt-BR") },
                ]}
              />
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <FinancialHeroCard
            title="Total Top Clientes"
            value={fmt(totalGeral)}
            subtitle={`${ranking.length} clientes no ranking`}
            color="primary"
            icon={DollarSign}
          />
          <FinancialHeroCard
            title="Ticket Médio"
            value={fmt(ranking.length > 0 ? totalGeral / ranking.length : 0)}
            subtitle="Média entre os top clientes"
            color="success"
            icon={TrendingUp}
          />
        </div>

        <Card>
          <CardHeader><CardTitle>Ranking Completo</CardTitle></CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <Table>
              <TableHeader><TableRow><TableHead className="w-16">Pos.</TableHead><TableHead>Cliente</TableHead><TableHead>Compras</TableHead><TableHead>Valor Total</TableHead><TableHead>Última Compra</TableHead></TableRow></TableHeader>
              <TableBody>
                {ranking.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem dados de vendas</TableCell></TableRow>}
                {ranking.map(c => (
                  <TableRow key={c.posicao}>
                    <TableCell><Badge variant={c.posicao <= 3 ? "default" : "outline"} className={c.posicao === 1 ? "bg-warning text-warning-foreground" : c.posicao === 2 ? "bg-muted text-muted-foreground" : c.posicao === 3 ? "bg-primary text-primary-foreground" : ""}>#{c.posicao}</Badge></TableCell>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.compras}</TableCell>
                    <TableCell className="font-medium">{fmt(c.valorTotal)}</TableCell>
                    <TableCell>{new Date(c.ultimaCompra).toLocaleDateString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
