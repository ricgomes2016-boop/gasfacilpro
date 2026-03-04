import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Fuel, Wrench, Truck, Loader2, DollarSign, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--accent-foreground))",
  "hsl(210 80% 50%)",
  "hsl(150 60% 40%)",
];

interface CustoVeiculo {
  placa: string;
  modelo: string;
  combustivel: number;
  manutencao: number;
  total: number;
  litros: number;
  km_atual: number;
  custo_km: string;
  consumo_medio: string;
}

export default function RelatoriosFrota() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [custoMensal, setCustoMensal] = useState<any[]>([]);
  const [custoPorVeiculo, setCustoPorVeiculo] = useState<CustoVeiculo[]>([]);
  const [consumoData, setConsumoData] = useState<any[]>([]);
  const [custoTotal, setCustoTotal] = useState(0);
  const [custoKmMedio, setCustoKmMedio] = useState("-");
  const [consumoMedio, setConsumoMedio] = useState("-");
  const [disponibilidade, setDisponibilidade] = useState(0);
  const [periodo, setPeriodo] = useState("6");

  useEffect(() => { fetchData(); }, [unidadeAtual, periodo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const mesesAtras = parseInt(periodo);
      const now = getBrasiliaDate();
      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const dados: any[] = [];

      for (let i = mesesAtras - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const inicio = d.toISOString().split("T")[0];
        const fim = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split("T")[0];

        let aq = supabase.from("abastecimentos").select("valor").gte("data", inicio).lt("data", fim);
        if (unidadeAtual?.id) aq = aq.eq("unidade_id", unidadeAtual.id);
        const { data: abast } = await aq;

        let mq = supabase.from("manutencoes").select("valor").gte("data", inicio).lt("data", fim);
        if (unidadeAtual?.id) mq = mq.eq("unidade_id", unidadeAtual.id);
        const { data: manut } = await mq;

        dados.push({
          mes: meses[d.getMonth()],
          combustivel: abast?.reduce((s, a) => s + Number(a.valor), 0) || 0,
          manutencao: manut?.reduce((s, m) => s + Number(m.valor), 0) || 0,
        });
      }
      setCustoMensal(dados);
      const ultimo = dados[dados.length - 1];
      setCustoTotal((ultimo?.combustivel || 0) + (ultimo?.manutencao || 0));

      // Veículos
      const { data: veiculos } = await supabase.from("veiculos").select("id, placa, modelo, km_atual, ativo");
      const ativos = veiculos?.filter(v => v.ativo) || [];
      const total = veiculos?.length || 1;
      setDisponibilidade(Math.round((ativos.length / total) * 100));

      // Custo por veículo
      let abastAll = supabase.from("abastecimentos").select("veiculo_id, valor, litros, km");
      if (unidadeAtual?.id) abastAll = abastAll.eq("unidade_id", unidadeAtual.id);
      const { data: allAbast } = await abastAll;

      let manutAll = supabase.from("manutencoes").select("veiculo_id, valor");
      if (unidadeAtual?.id) manutAll = manutAll.eq("unidade_id", unidadeAtual.id);
      const { data: allManut } = await manutAll;

      const custos: CustoVeiculo[] = ativos.map(v => {
        const abasts = (allAbast || []).filter(a => a.veiculo_id === v.id);
        const manuts = (allManut || []).filter(m => m.veiculo_id === v.id);
        const totalComb = abasts.reduce((s, a) => s + Number(a.valor), 0);
        const totalManut = manuts.reduce((s, m) => s + Number(m.valor), 0);
        const totalLitros = abasts.reduce((s, a) => s + Number(a.litros), 0);
        const kmAtual = v.km_atual || 0;

        // Consumo médio: km entre primeiro e último abastecimento / litros
        const kms = abasts.map(a => Number(a.km)).filter(k => k > 0).sort((a, b) => a - b);
        let consumo = "-";
        if (kms.length >= 2 && totalLitros > 0) {
          const kmPercorridos = kms[kms.length - 1] - kms[0];
          if (kmPercorridos > 0) {
            consumo = (kmPercorridos / totalLitros).toFixed(1);
          }
        }

        const custoKm = kmAtual > 0 ? ((totalComb + totalManut) / kmAtual).toFixed(2) : "-";

        return {
          placa: v.placa,
          modelo: v.modelo,
          combustivel: totalComb,
          manutencao: totalManut,
          total: totalComb + totalManut,
          litros: totalLitros,
          km_atual: kmAtual,
          custo_km: custoKm,
          consumo_medio: consumo,
        };
      }).sort((a, b) => b.total - a.total);

      setCustoPorVeiculo(custos);

      // Consumo médio global
      const veiculosComConsumo = custos.filter(c => c.consumo_medio !== "-");
      if (veiculosComConsumo.length > 0) {
        const media = veiculosComConsumo.reduce((s, c) => s + parseFloat(c.consumo_medio), 0) / veiculosComConsumo.length;
        setConsumoMedio(media.toFixed(1) + " km/L");
      }

      const veiculosComCusto = custos.filter(c => c.custo_km !== "-");
      if (veiculosComCusto.length > 0) {
        const media = veiculosComCusto.reduce((s, c) => s + parseFloat(c.custo_km), 0) / veiculosComCusto.length;
        setCustoKmMedio("R$ " + media.toFixed(2));
      }

      // Consumo por veículo para gráfico
      setConsumoData(custos.slice(0, 8).map(c => ({
        veiculo: c.placa,
        consumo: c.consumo_medio !== "-" ? parseFloat(c.consumo_medio) : 0,
        litros: c.litros,
      })));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Relatórios de Frota" subtitle="Análises de custo e consumo por veículo" />
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </MainLayout>
    );
  }

  const pieData = [
    { name: "Combustível", value: custoPorVeiculo.reduce((s, c) => s + c.combustivel, 0) },
    { name: "Manutenção", value: custoPorVeiculo.reduce((s, c) => s + c.manutencao, 0) },
  ].filter(d => d.value > 0);

  return (
    <MainLayout>
      <Header title="Relatórios de Frota" subtitle="Análises de custo e consumo por veículo" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Exportar PDF</Button>
            <Button variant="outline" className="gap-2"><FileText className="h-4 w-4" />Exportar Excel</Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Custo Total Mensal</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {custoTotal.toLocaleString("pt-BR")}</div>
              <p className="text-xs text-muted-foreground">Combustível + Manutenção</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Custo/KM</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{custoKmMedio}</div>
              <p className="text-xs text-muted-foreground">Média da frota</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Consumo Médio</CardTitle>
              <Fuel className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{consumoMedio}</div>
              <p className="text-xs text-muted-foreground">Toda a frota</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Disponibilidade</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{disponibilidade}%</div>
              <p className="text-xs text-muted-foreground">Veículos operacionais</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Custos Mensais</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={custoMensal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR")}`} />
                  <Legend />
                  <Bar dataKey="combustivel" fill="hsl(var(--primary))" name="Combustível" />
                  <Bar dataKey="manutencao" fill="hsl(var(--muted-foreground))" name="Manutenção" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Distribuição de Custos</CardTitle></CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR")}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">Sem dados</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Consumo por veículo */}
        <Card>
          <CardHeader><CardTitle>Consumo por Veículo (km/L)</CardTitle></CardHeader>
          <CardContent>
            {consumoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={consumoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="veiculo" type="category" width={80} />
                  <Tooltip formatter={(value, name) => name === "consumo" ? `${value} km/L` : `${value} L`} />
                  <Legend />
                  <Bar dataKey="consumo" fill="hsl(var(--primary))" name="Consumo (km/L)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados de consumo. Registre abastecimentos com KM para calcular.</p>
            )}
          </CardContent>
        </Card>

        {/* Tabela de custo por veículo */}
        <Card>
          <CardHeader><CardTitle>Custo Consolidado por Veículo</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>KM Atual</TableHead>
                  <TableHead>Combustível</TableHead>
                  <TableHead>Manutenção</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Custo/KM</TableHead>
                  <TableHead>Consumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {custoPorVeiculo.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum veículo com dados</TableCell></TableRow>
                )}
                {custoPorVeiculo.map((c) => (
                  <TableRow key={c.placa}>
                    <TableCell className="font-medium">{c.placa}</TableCell>
                    <TableCell>{c.modelo}</TableCell>
                    <TableCell>{c.km_atual.toLocaleString("pt-BR")} km</TableCell>
                    <TableCell>R$ {c.combustivel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>R$ {c.manutencao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="font-bold">R$ {c.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      {c.custo_km !== "-" ? (
                        <Badge variant="outline">R$ {c.custo_km}/km</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {c.consumo_medio !== "-" ? (
                        <Badge variant="secondary">{c.consumo_medio} km/L</Badge>
                      ) : "-"}
                    </TableCell>
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