import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, TrendingDown, Clock, CalendarDays, Award, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--success, 142 76% 36%))", "hsl(var(--warning, 38 92% 50%))", "hsl(var(--accent))"];

export default function DashboardRH() {
  const { unidadeAtual } = useUnidade();

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["dashboard-rh-func", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("funcionarios").select("*").order("nome");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: folhas = [] } = useQuery({
    queryKey: ["dashboard-rh-folhas", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("folhas_pagamento").select("*").order("mes_referencia", { ascending: false }).limit(6);
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: atestados = [] } = useQuery({
    queryKey: ["dashboard-rh-atestados", unidadeAtual?.id],
    queryFn: async () => {
      const tresMesesAtras = format(subMonths(new Date(), 3), "yyyy-MM-dd");
      let query = supabase.from("atestados_faltas").select("*").gte("data_inicio", tresMesesAtras);
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["dashboard-rh-avaliacoes", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase.from("avaliacoes_desempenho").select("nota_geral").limit(100);
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data } = await query;
      return data || [];
    },
  });

  const ativos = funcionarios.filter((f: any) => f.ativo);
  const inativos = funcionarios.filter((f: any) => !f.ativo);
  const custoFolha = folhas.length > 0 ? Number((folhas as any)[0]?.total_liquido || 0) : 0;
  const mediaAvaliacao = avaliacoes.length > 0
    ? (avaliacoes.reduce((a: number, av: any) => a + Number(av.nota_geral), 0) / avaliacoes.length).toFixed(1)
    : "—";
  const totalFaltas = atestados.reduce((a: number, at: any) => a + (at.dias || 0), 0);

  // Headcount by sector
  const headcountSetor = useMemo(() => {
    const map = new Map<string, number>();
    ativos.forEach((f: any) => {
      const setor = f.setor || f.cargo || "Outros";
      map.set(setor, (map.get(setor) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [ativos]);

  // Payroll evolution
  const evolucaoFolha = useMemo(() => {
    return [...folhas].reverse().map((f: any) => ({
      mes: f.mes_referencia,
      bruto: Number(f.total_bruto),
      liquido: Number(f.total_liquido),
    }));
  }, [folhas]);

  return (
    <MainLayout>
      <Header title="Dashboard RH" subtitle="Visão geral de recursos humanos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Funcionários Ativos</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ativos.length}</div>
                  <p className="text-xs text-muted-foreground">{inativos.length} inativos</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Custo Folha (Último Mês)</CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R$ {custoFolha.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-muted-foreground">Líquido pago</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Média Avaliação</CardTitle>
                  <Award className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mediaAvaliacao}/5</div>
                  <p className="text-xs text-muted-foreground">{avaliacoes.length} avaliações</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Faltas (3 meses)</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{totalFaltas} dias</div>
                  <p className="text-xs text-muted-foreground">{atestados.length} registros</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Evolução da Folha</CardTitle></CardHeader>
                <CardContent>
                  {evolucaoFolha.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma folha fechada</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={evolucaoFolha}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" />
                        <YAxis />
                        <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                        <Bar dataKey="bruto" fill="hsl(var(--primary))" name="Bruto" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="liquido" fill="hsl(var(--accent))" name="Líquido" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Headcount por Setor/Cargo</CardTitle></CardHeader>
                <CardContent>
                  {headcountSetor.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Sem dados</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={headcountSetor} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label>
                          {headcountSetor.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
