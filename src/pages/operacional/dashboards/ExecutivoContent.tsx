import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DollarSign, Package, Users, Target, Calendar, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { getBrasiliaDate } from "@/lib/utils";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export default function ExecutivoContent() {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const [loading, setLoading] = useState(true);
  const [faturamento, setFaturamento] = useState(0);
  const [totalVendas, setTotalVendas] = useState(0);
  const [clientesAtivos, setClientesAtivos] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [vendasSemana, setVendasSemana] = useState<any[]>([]);
  const [produtosVendidos, setProdutosVendidos] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      let pedidosQuery = supabase.from("pedidos").select("valor_total, created_at").gte("created_at", mesInicio).lte("created_at", now.toISOString()).neq("status", "cancelado");
      if (unidadeAtual?.id) pedidosQuery = pedidosQuery.eq("unidade_id", unidadeAtual.id);
      const { data: pedidos } = await pedidosQuery;

      const totalFat = pedidos?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0;
      setFaturamento(totalFat);
      setTotalVendas(pedidos?.length || 0);
      setTicketMedio(pedidos?.length ? totalFat / pedidos.length : 0);

      let cliQuery = supabase.from("clientes").select("id", { count: "exact" }).eq("ativo", true);
      if (empresa?.id) cliQuery = cliQuery.eq("empresa_id", empresa.id);
      const { count: cliCount } = await cliQuery;
      setClientesAtivos(cliCount || 0);

      const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const semanaData: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const diaInicio = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const diaFim = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
        let dq = supabase.from("pedidos").select("valor_total").gte("created_at", diaInicio).lt("created_at", diaFim).neq("status", "cancelado");
        if (unidadeAtual?.id) dq = dq.eq("unidade_id", unidadeAtual.id);
        const { data: dp } = await dq;
        semanaData.push({ dia: dias[d.getDay()], valor: dp?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0 });
      }
      setVendasSemana(semanaData);

      const { data: itens } = await supabase.from("pedido_itens").select("quantidade, produto:produtos(nome)");
      const prodMap: Record<string, number> = {};
      itens?.forEach((item: any) => { const nome = item.produto?.nome || "Outros"; prodMap[nome] = (prodMap[nome] || 0) + item.quantidade; });
      const totalQtd = Object.values(prodMap).reduce((s, v) => s + v, 0) || 1;
      setProdutosVendidos(Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([nome, qtd]) => ({ nome, valor: Math.round((qtd / totalQtd) * 100) })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {getBrasiliaDate().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Faturamento Mensal</p><p className="text-2xl font-bold">R$ {faturamento.toLocaleString("pt-BR")}</p></div><div className="p-3 rounded-lg bg-primary/10"><DollarSign className="h-6 w-6 text-primary" /></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Vendas Realizadas</p><p className="text-2xl font-bold">{totalVendas}</p></div><div className="p-3 rounded-lg bg-chart-2/10"><Package className="h-6 w-6 text-chart-2" /></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Clientes Ativos</p><p className="text-2xl font-bold">{clientesAtivos}</p></div><div className="p-3 rounded-lg bg-chart-3/10"><Users className="h-6 w-6 text-chart-3" /></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Ticket Médio</p><p className="text-2xl font-bold">R$ {ticketMedio.toFixed(2)}</p></div><div className="p-3 rounded-lg bg-chart-4/10"><Target className="h-6 w-6 text-chart-4" /></div></div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Vendas da Semana</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={vendasSemana}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" /><YAxis />
                <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString("pt-BR")}`, "Vendas"]} />
                <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Produtos Mais Vendidos</CardTitle></CardHeader>
          <CardContent>
            {produtosVendidos.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart><Pie data={produtosVendidos} cx="50%" cy="50%" labelLine={false} label={({ nome, valor }) => `${nome}: ${valor}%`} outerRadius={100} dataKey="valor">
                  {produtosVendidos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                compact
                icon={Package}
                title="Sem produtos vendidos"
                description="Os produtos mais vendidos aparecerão aqui quando houver itens em pedidos."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Progresso da Meta Mensal</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm"><span>Faturamento</span><span className="font-medium">R$ {faturamento.toLocaleString("pt-BR")}</span></div>
            <div className="h-4 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min((faturamento / 150000) * 100, 100)}%` }} /></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
