import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal, Crown, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function RankingClientes() {
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<any[]>([]);
  const [totalGeral, setTotalGeral] = useState(0);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Buscar pedidos agrupados por cliente
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

  const podium = [
    { Icon: Crown, card: "border-warning/35 bg-warning/5", icon: "status-card-icon-warning", badge: "bg-warning text-warning-foreground", r: ranking[0] },
    { Icon: Medal, card: "border-muted bg-muted/35", icon: "status-card-icon-muted", badge: "bg-muted text-muted-foreground", r: ranking[1] },
    { Icon: Trophy, card: "border-primary/25 bg-primary/5", icon: "status-card-icon-primary", badge: "bg-primary text-primary-foreground", r: ranking[2] },
  ];

  return (
    <MainLayout>
      <Header title="Ranking de Clientes" subtitle="Top clientes por volume de compras" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        

        {ranking.length >= 3 && (
          <div className="grid gap-4 md:grid-cols-3">
            {podium.map(({ Icon, card, icon, badge, r }, i) => (
              <Card key={i} className={`modern-status-card ${card}`}>
                <CardContent className="pt-6 text-center">
                  <div className={`status-card-icon ${icon} mx-auto mb-2`}><Icon /></div>
                  <Badge className={`${badge} mb-2`}>{r.posicao}º Lugar</Badge>
                  <p className="text-xl font-bold">{r.nome}</p>
                  <p className="text-2xl font-bold text-primary mt-2">R$ {r.valorTotal.toLocaleString("pt-BR")}</p>
                  <p className="text-sm text-muted-foreground">{r.compras} compras</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="kpi-card kpi-card-primary"><CardContent className="kpi-card-content"><div className="status-card-icon status-card-icon-primary"><DollarSign /></div><div><p className="kpi-value">R$ {totalGeral.toLocaleString("pt-BR")}</p><p className="kpi-label">Total Top Clientes</p></div></CardContent></Card>
          <Card className="kpi-card kpi-card-success"><CardContent className="kpi-card-content"><div className="status-card-icon status-card-icon-success"><TrendingUp /></div><div><p className="kpi-value">R$ {ranking.length > 0 ? (totalGeral / ranking.length).toFixed(0) : 0}</p><p className="kpi-label">Ticket Médio Top Clientes</p></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Ranking Completo</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead className="w-16">Pos.</TableHead><TableHead>Cliente</TableHead><TableHead>Compras</TableHead><TableHead>Valor Total</TableHead><TableHead>Última Compra</TableHead></TableRow></TableHeader>
              <TableBody>
                {ranking.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem dados de vendas</TableCell></TableRow>}
                {ranking.map(c => (
                  <TableRow key={c.posicao}>
                    <TableCell><Badge variant={c.posicao <= 3 ? "default" : "outline"} className={c.posicao === 1 ? "bg-warning text-warning-foreground" : c.posicao === 2 ? "bg-muted text-muted-foreground" : c.posicao === 3 ? "bg-primary text-primary-foreground" : ""}>#{c.posicao}</Badge></TableCell>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.compras}</TableCell>
                    <TableCell className="font-medium">R$ {c.valorTotal.toLocaleString("pt-BR")}</TableCell>
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
