import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calendar, DollarSign, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, addDays, addMonths, startOfDay, endOfDay, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PrevisaoCaixa({ embedded }: { embedded?: boolean } = {}) {
  const { unidadeAtual } = useUnidade();

  // Saldo atual from movimentacoes_caixa
  const { data: saldoAtual = 0 } = useQuery({
    queryKey: ["previsao_saldo", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("movimentacoes_caixa")
        .select("tipo, valor")
        .eq("status", "aprovada");
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).reduce((acc, m) => {
        return acc + (m.tipo === "entrada" ? Number(m.valor) : -Number(m.valor));
      }, 0);
    },
  });

  // Contas a receber (próximos 30, 90 dias)
  const { data: aReceber = [] } = useQuery({
    queryKey: ["previsao_receber", unidadeAtual?.id],
    queryFn: async () => {
      const limite = format(addMonths(new Date(), 3), "yyyy-MM-dd");
      let query = supabase
        .from("contas_receber")
        .select("valor, vencimento, status")
        .eq("status", "pendente")
        .lte("vencimento", limite);
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Contas a pagar (próximos 30, 90 dias)
  const { data: aPagar = [] } = useQuery({
    queryKey: ["previsao_pagar", unidadeAtual?.id],
    queryFn: async () => {
      const limite = format(addMonths(new Date(), 3), "yyyy-MM-dd");
      let query = supabase
        .from("contas_pagar")
        .select("valor, vencimento, status")
        .eq("status", "pendente")
        .lte("vencimento", limite);
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Histórico mensal de movimentações (últimos 6 meses)
  const { data: historicoMensal = [] } = useQuery({
    queryKey: ["previsao_historico", unidadeAtual?.id],
    queryFn: async () => {
      const inicio = format(subMonths(startOfMonth(new Date()), 5), "yyyy-MM-dd");
      let query = supabase
        .from("movimentacoes_caixa")
        .select("tipo, valor, created_at")
        .eq("status", "aprovada")
        .gte("created_at", inicio);
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Compute chart data from historical movements
  const chartData = (() => {
    const meses: Record<string, { entradas: number; saidas: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, "yyyy-MM");
      meses[key] = { entradas: 0, saidas: 0 };
    }
    historicoMensal.forEach((m: any) => {
      const key = format(new Date(m.created_at), "yyyy-MM");
      if (meses[key]) {
        if (m.tipo === "entrada") meses[key].entradas += Number(m.valor);
        else meses[key].saidas += Number(m.valor);
      }
    });
    return Object.entries(meses).map(([key, val]) => ({
      mes: format(new Date(key + "-01"), "MMM", { locale: ptBR }),
      entradas: val.entradas,
      saidas: val.saidas,
    }));
  })();

  // Compute projections
  const hoje = getBrasiliaDate();
  const em7dias = format(addDays(hoje, 7), "yyyy-MM-dd");
  const em30dias = format(addDays(hoje, 30), "yyyy-MM-dd");
  const em90dias = format(addDays(hoje, 90), "yyyy-MM-dd");

  const calcProjecao = (limite: string) => {
    const entrada = aReceber
      .filter((r: any) => r.vencimento <= limite)
      .reduce((s: number, r: any) => s + Number(r.valor), 0);
    const saida = aPagar
      .filter((p: any) => p.vencimento <= limite)
      .reduce((s: number, p: any) => s + Number(p.valor), 0);
    return { entrada, saida, saldo: entrada - saida };
  };

  const projecoes = [
    { periodo: "Próxima Semana", ...calcProjecao(em7dias) },
    { periodo: "Próximo Mês", ...calcProjecao(em30dias) },
    { periodo: "Próximo Trimestre", ...calcProjecao(em90dias) },
  ];

  const receber30 = projecoes[1].entrada;
  const previsao30 = saldoAtual + projecoes[1].saldo;
  const alertas = projecoes.filter((p) => p.saldo < 0).length;

  const content = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">



        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {saldoAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Base para projeção</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Previsão 30 dias</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${previsao30 >= 0 ? "text-green-600" : "text-red-600"}`}>
                R$ {previsao30.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Saldo previsto</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">A Receber</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                R$ {receber30.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Próximos 30 dias</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Alertas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{alertas}</div>
              <p className="text-xs text-muted-foreground">Períodos com saldo negativo</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico Mensal - Entradas vs Saídas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR")}`} />
                <Legend />
                <Line type="monotone" dataKey="entradas" stroke="#22c55e" strokeWidth={2} name="Entradas" />
                <Line type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} name="Saídas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projecoes.map((proj) => (
            <Card key={proj.periodo}>
              <CardHeader>
                <CardTitle className="text-lg">{proj.periodo}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entradas Previstas</span>
                  <span className="font-medium text-green-600">
                    R$ {proj.entrada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saídas Previstas</span>
                  <span className="font-medium text-red-600">
                    R$ {proj.saida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-medium">Saldo Previsto</span>
                  <span className={`font-bold ${proj.saldo >= 0 ? "text-blue-600" : "text-red-600"}`}>
                    R$ {proj.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Previsão de Caixa" subtitle="Projeções financeiras baseadas em histórico" />
      {content}
    </MainLayout>
  );
}
