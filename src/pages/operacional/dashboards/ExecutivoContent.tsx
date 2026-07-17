import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSectionLoader } from "@/components/ui/page-loader";
import { DollarSign, Package, Users, Target, Calendar } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { getBrasiliaDate } from "@/lib/utils";
import { KpiCard, SectionCard } from "@/components/shared";

const COLORS = ["hsl(var(--success))", "hsl(var(--info))", "hsl(var(--warning))", "hsl(var(--secondary))", "hsl(var(--destructive))"];

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

  if (loading) return <PageSectionLoader label="Carregando visão executiva..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        {getBrasiliaDate().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Faturamento Mensal" value={`R$ ${faturamento.toLocaleString("pt-BR")}`} tone="primary" />
        <KpiCard icon={Package} label="Vendas Realizadas" value={totalVendas} tone="info" />
        <KpiCard icon={Users} label="Clientes Ativos" value={clientesAtivos} tone="success" />
        <KpiCard icon={Target} label="Ticket Médio" value={`R$ ${ticketMedio.toFixed(2)}`} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Vendas da Semana">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={vendasSemana} margin={{ top: 12, right: 18, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="hsl(var(--border) / 0.5)" />
              <XAxis dataKey="dia" axisLine={false} tickLine={false} tickMargin={10} />
              <YAxis axisLine={false} tickLine={false} tickMargin={10} width={58} tickFormatter={(value) => `R$ ${(Number(value) / 1000).toFixed(0)}k`} />
              <Tooltip
                cursor={{ stroke: "hsl(var(--success))", strokeWidth: 1, strokeDasharray: "4 4" }}
                contentStyle={{ borderRadius: 12, borderColor: "hsl(var(--border) / 0.55)", boxShadow: "0 18px 45px hsl(var(--foreground) / 0.10)" }}
                formatter={(value) => [`R$ ${Number(value).toLocaleString("pt-BR")}`, "Vendas"]}
              />
              <Line type="monotone" dataKey="valor" stroke="hsl(var(--success))" strokeWidth={3} dot={{ fill: "hsl(var(--success))", strokeWidth: 2, r: 4 }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="Produtos Mais Vendidos">
          {produtosVendidos.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={produtosVendidos} cx="50%" cy="48%" innerRadius={58} outerRadius={96} paddingAngle={3} label={false} dataKey="valor">
                {produtosVendidos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: "hsl(var(--border) / 0.55)", boxShadow: "0 18px 45px hsl(var(--foreground) / 0.10)" }}
                  formatter={(value, name, item) => [`${value}%`, item.payload.nome]}
                />
                <Legend iconType="circle" verticalAlign="bottom" height={42} formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              compact
              icon={Package}
              title="Sem produtos vendidos"
              description="Os produtos mais vendidos aparecerão aqui quando houver itens em pedidos."
            />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Progresso da Meta Mensal" icon={Target}>
        <div className="space-y-3">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Faturamento</span><span className="font-medium text-foreground">R$ {faturamento.toLocaleString("pt-BR")}</span></div>
          <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min((faturamento / 150000) * 100, 100)}%` }} /></div>
        </div>
      </SectionCard>
    </div>
  );
}
