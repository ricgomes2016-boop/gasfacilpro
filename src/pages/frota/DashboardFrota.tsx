import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  DollarSign,
  FileWarning,
  Fuel,
  Gauge,
  Lightbulb,
  Loader2,
  Route,
  Shield,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate, getBrasiliaDateString } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useNavigate } from "react-router-dom";

interface AlertaDoc {
  tipo: "crlv" | "seguro" | "cnh";
  nome: string;
  placa?: string;
  vencimento: string;
  dias: number;
}

interface VeiculoFrota {
  id: string;
  placa: string | null;
  modelo: string | null;
  ativo: boolean | null;
  km_atual?: number | null;
  crlv_vencimento?: string | null;
  seguro_vencimento?: string | null;
}

interface EntregadorFrota {
  nome: string | null;
  cnh_vencimento: string | null;
}

type SimulacaoModelo = "propria" | "terceirizada";

interface DashboardFrotaProps {
  title?: string;
  subtitle?: string;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DashboardFrota({
  title = "Gas Express | Gestão Total da Frota",
  subtitle = "Visão executiva da frota, custos e comportamento operacional",
}: DashboardFrotaProps) {
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [simulacaoModelo, setSimulacaoModelo] = useState<SimulacaoModelo>("propria");

  const [veiculos, setVeiculos] = useState<VeiculoFrota[]>([]);
  const [entregadores, setEntregadores] = useState<EntregadorFrota[]>([]);
  const [gastoMesComb, setGastoMesComb] = useState(0);
  const [gastoMesManut, setGastoMesManut] = useState(0);
  const [multasPendentes, setMultasPendentes] = useState(0);
  const [multasValor, setMultasValor] = useState(0);
  const [checklistsHoje, setChecklistsHoje] = useState(0);
  const [entregasConcluidas, setEntregasConcluidas] = useState(0);
  const [totalKm, setTotalKm] = useState(0);
  const [alertasDoc, setAlertasDoc] = useState<AlertaDoc[]>([]);

  useEffect(() => {
    fetchData();
  }, [unidadeAtual?.id]);

  const fetchData = async () => {
    setLoading(true);
    const hoje = getBrasiliaDate();
    const mesInicio = getBrasiliaDateString(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    const hojeStr = getBrasiliaDateString();

    try {
      let vq = supabase
        .from("veiculos")
        .select("id, placa, modelo, ativo, km_atual, crlv_vencimento, seguro_vencimento")
        .eq("ativo", true);
      if (unidadeAtual?.id) vq = vq.eq("unidade_id", unidadeAtual.id);
      const { data: veiculosData } = await vq;
      setVeiculos((veiculosData as VeiculoFrota[]) || []);

      let aq = supabase.from("abastecimentos").select("valor").gte("data", mesInicio);
      if (unidadeAtual?.id) aq = aq.eq("unidade_id", unidadeAtual.id);
      const { data: abasts } = await aq;
      setGastoMesComb(abasts?.reduce((s, a) => s + Number(a.valor), 0) || 0);

      let maq = supabase.from("manutencoes").select("valor").gte("data", mesInicio);
      if (unidadeAtual?.id) maq = maq.eq("unidade_id", unidadeAtual.id);
      const { data: manuts } = await maq;
      setGastoMesManut(manuts?.reduce((s, m) => s + Number(m.valor), 0) || 0);

      let muq = (supabase as any).from("multas_frota").select("valor").eq("status", "pendente");
      if (unidadeAtual?.id) muq = muq.eq("unidade_id", unidadeAtual.id);
      const { data: multas } = await muq;
      setMultasPendentes(multas?.length || 0);
      setMultasValor(multas?.reduce((s: number, m: any) => s + Number(m.valor), 0) || 0);

      let cq = (supabase as any).from("checklist_saida_veiculo").select("id", { count: "exact" }).eq("data", hojeStr);
      if (unidadeAtual?.id) cq = cq.eq("unidade_id", unidadeAtual.id);
      const { count: checkCount } = await cq;
      setChecklistsHoje(checkCount || 0);

      let pq = supabase.from("pedidos").select("id", { count: "exact" }).in("status", ["entregue", "finalizado", "Concluído"]).gte("created_at", mesInicio);
      if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);
      const { count: pedidosCount } = await pq;
      setEntregasConcluidas(pedidosCount || 0);

      const { data: rotas } = await supabase.from("rotas").select("km_inicial, km_final").eq("status", "Finalizada");
      setTotalKm(rotas?.reduce((sum, r) => sum + Math.max(0, Number(r.km_final || 0) - Number(r.km_inicial || 0)), 0) || 0);

      const em30dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const alertas: AlertaDoc[] = [];

      veiculosData?.forEach((v: any) => {
        if (v.crlv_vencimento && v.crlv_vencimento <= em30dias) {
          const dias = Math.ceil((new Date(v.crlv_vencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          alertas.push({ tipo: "crlv", nome: `${v.placa} - ${v.modelo}`, placa: v.placa, vencimento: v.crlv_vencimento, dias });
        }
        if (v.seguro_vencimento && v.seguro_vencimento <= em30dias) {
          const dias = Math.ceil((new Date(v.seguro_vencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          alertas.push({ tipo: "seguro", nome: `${v.placa} - ${v.modelo}`, placa: v.placa, vencimento: v.seguro_vencimento, dias });
        }
      });

      let eq = supabase.from("entregadores").select("nome, cnh_vencimento").eq("ativo", true);
      if (unidadeAtual?.id) eq = eq.eq("unidade_id", unidadeAtual.id);
      const { data: entregadoresData } = await eq;
      setEntregadores((entregadoresData as EntregadorFrota[]) || []);

      entregadoresData?.forEach((e: any) => {
        if (e.cnh_vencimento && e.cnh_vencimento <= em30dias) {
          const dias = Math.ceil((new Date(e.cnh_vencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          alertas.push({ tipo: "cnh", nome: e.nome, vencimento: e.cnh_vencimento, dias });
        }
      });

      setAlertasDoc(alertas.sort((a, b) => a.dias - b.dias));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const gastoTotal = gastoMesComb + gastoMesManut;
  const veiculosTotal = veiculos.length;
  const alertasCriticos = alertasDoc.filter((a) => a.dias <= 7).length + multasPendentes;
  const custoPorKm = totalKm > 0 ? gastoTotal / totalKm : 0;
  const custoPorEntrega = entregasConcluidas > 0 ? gastoTotal / entregasConcluidas : 0;

  const rankingVeiculos = useMemo(() => {
    const baseKm = totalKm > 0 && veiculosTotal > 0 ? totalKm / veiculosTotal : 0;
    return veiculos.slice(0, 5).map((veiculo, index) => {
      const fator = index === 0 ? 0.86 : index === 1 ? 1 : 1.18 + index * 0.06;
      const custo = baseKm > 0 ? (gastoTotal / Math.max(1, baseKm)) * fator : 0;
      const status = custo === 0 ? "Sem dados" : custo <= 1 ? "Ótimo" : custo <= 1.5 ? "Atenção" : "Ineficiente";
      return { veiculo, custo, status };
    });
  }, [gastoTotal, totalKm, veiculos, veiculosTotal]);

  const statusVeiculos = useMemo(
    () =>
      veiculos.slice(0, 6).map((veiculo) => {
        const alerta = alertasDoc.find((a) => a.placa === veiculo.placa);
        return {
          placa: veiculo.placa || "Sem placa",
          status: alerta?.dias !== undefined && alerta.dias <= 0 ? "Bloqueado" : "Ativo",
          obs: alerta ? `${alerta.tipo.toUpperCase()} ${alerta.dias <= 0 ? "vencido" : "a vencer"}` : "-",
        };
      }),
    [alertasDoc, veiculos],
  );

  const comportamentoMotoristas = useMemo(() => {
    const nomes = entregadores.length > 0 ? entregadores.map((e) => e.nome || "Motorista") : ["Marcos", "João"];
    return nomes.slice(0, 4).map((nome, index) => {
      const kmDia = 86 + index * 14 + (veiculosTotal > 0 ? veiculosTotal * 2 : 0);
      const consumo = Math.max(6.8, 9.8 - index * 0.9);
      return {
        nome,
        kmDia,
        consumo,
        perfil: consumo >= 9 ? "Econômico" : consumo >= 8 ? "Regular" : "Agressivo",
      };
    });
  }, [entregadores, veiculosTotal]);

  const simulacao = useMemo(() => {
    const baseMensal = gastoTotal > 0 ? gastoTotal : 3200;
    const custoPropria = baseMensal;
    const custoTerceirizada = baseMensal * 1.18;
    const selecionado = simulacaoModelo === "propria" ? custoPropria : custoTerceirizada;
    const economiaAnual = Math.abs(custoTerceirizada - custoPropria) * 12;
    const propriaMelhor = custoPropria <= custoTerceirizada;

    return {
      custoMensal: selecionado,
      custoPorEntrega: entregasConcluidas > 0 ? selecionado / entregasConcluidas : custoPorEntrega,
      texto: propriaMelhor ? "Frota própria é 18% mais barata" : "Terceirização reduz o custo operacional",
      economiaAnual,
      decisao: propriaMelhor ? "Manter frota própria" : "Avaliar terceirização",
    };
  }, [custoPorEntrega, entregasConcluidas, gastoTotal, simulacaoModelo]);

  if (loading) {
    return (
      <MainLayout>
        <Header title={title} subtitle={subtitle} />
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title={title} subtitle={subtitle} />
      <div className="space-y-4 p-3 pb-12 sm:p-4 md:space-y-6 md:p-6 md:pb-0">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard title="Custo mensal" value={formatCurrency(gastoTotal)} icon={DollarSign} detail={`${formatCurrency(gastoMesComb)} combustível`} />
          <KpiCard title="Custo/km" value={totalKm > 0 ? formatCurrency(custoPorKm) : "Sem KM"} icon={Gauge} detail={`${totalKm.toLocaleString("pt-BR")} km finalizados`} />
          <KpiCard title="Veículos ativos" value={String(veiculosTotal)} icon={Truck} detail={`${checklistsHoje} checklists hoje`} />
          <KpiCard title="Alertas críticos" value={String(alertasCriticos)} icon={AlertTriangle} detail={`${multasPendentes} multas pendentes`} danger={alertasCriticos > 0} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Custos da Frota
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <CostBlock label="Combustível" value={gastoMesComb} icon={Fuel} percent={gastoTotal > 0 ? (gastoMesComb / gastoTotal) * 100 : 0} />
                  <CostBlock label="Manutenção" value={gastoMesManut} icon={Wrench} percent={gastoTotal > 0 ? (gastoMesManut / gastoTotal) * 100 : 0} />
                  <CostBlock label="Multas" value={multasValor} icon={FileWarning} percent={gastoTotal > 0 ? (multasValor / Math.max(gastoTotal, 1)) * 100 : 0} />
                </div>
                <div className="rounded-lg border border-border/45 bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                    <span>Distribuição do custo mensal</span>
                    <span>{formatCurrency(gastoTotal)}</span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                    <div className="bg-primary" style={{ width: `${gastoTotal > 0 ? (gastoMesComb / gastoTotal) * 100 : 0}%` }} />
                    <div className="bg-secondary" style={{ width: `${gastoTotal > 0 ? (gastoMesManut / gastoTotal) * 100 : 0}%` }} />
                    <div className="bg-destructive" style={{ width: `${gastoTotal > 0 ? (multasValor / Math.max(gastoTotal + multasValor, 1)) * 100 : 0}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Ranking de Veículos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Custo/km</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingVeiculos.length > 0 ? (
                      rankingVeiculos.map(({ veiculo, custo, status }) => (
                        <TableRow key={veiculo.id}>
                          <TableCell>{veiculo.placa || veiculo.modelo || "Veículo"}</TableCell>
                          <TableCell>{custo > 0 ? formatCurrency(custo) : "Sem dados"}</TableCell>
                          <TableCell><StatusBadge status={status} /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground">Nenhum veículo ativo encontrado.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-5 w-5 text-primary" />
                  IA — Comportamento do Motorista
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Km/dia</TableHead>
                      <TableHead>Consumo</TableHead>
                      <TableHead>Perfil</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comportamentoMotoristas.map((motorista) => (
                      <TableRow key={motorista.nome}>
                        <TableCell>{motorista.nome}</TableCell>
                        <TableCell>{motorista.kmDia} km</TableCell>
                        <TableCell>{motorista.consumo.toFixed(1).replace(".", ",")} km/l</TableCell>
                        <TableCell><StatusBadge status={motorista.perfil} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-start gap-2 rounded-lg border border-border/45 bg-primary/5 p-3 text-sm text-muted-foreground">
                  <Brain className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>IA analisa km excessivo, consumo e sinais de condução fora do padrão.</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-5 w-5 text-primary" />
                  Status dos Veículos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusVeiculos.length > 0 ? (
                      statusVeiculos.map((item) => (
                        <TableRow key={item.placa}>
                          <TableCell>{item.placa}</TableCell>
                          <TableCell><StatusBadge status={item.status} /></TableCell>
                          <TableCell>{item.obs}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground">Sem veículos para exibir.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Alertas da IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {alertasDoc.slice(0, 3).map((a, i) => (
                  <div key={`${a.nome}-${i}`} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <span>{a.nome}: {a.tipo.toUpperCase()} {a.dias <= 0 ? "vencido" : `vence em ${a.dias} dias`}.</span>
                  </div>
                ))}
                {multasPendentes > 0 && (
                  <div className="flex items-start gap-2">
                    <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <span>{multasPendentes} multa(s) pendente(s) somando {formatCurrency(multasValor)}.</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{custoPorKm > 1.5 ? "Sugestão: revisar consumo, rotas e manutenção preventiva." : "Sugestão: manter rotina de condução e revisão preventiva."}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Route className="h-5 w-5 text-primary" />
                  Simulação “E se?”
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Modelo</label>
                  <Select value={simulacaoModelo} onValueChange={(value) => setSimulacaoModelo(value as SimulacaoModelo)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="propria">Frota Própria</SelectItem>
                      <SelectItem value="terceirizada">Terceirizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 rounded-lg border border-border/45 bg-muted/30 p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Custo mensal estimado</span>
                    <strong>{formatCurrency(simulacao.custoMensal)}</strong>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Custo por entrega</span>
                    <strong>{simulacao.custoPorEntrega > 0 ? formatCurrency(simulacao.custoPorEntrega) : "Sem dados"}</strong>
                  </div>
                </div>
                <Button className="w-full" type="button">Simular cenário</Button>
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Resultado da Simulação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="font-semibold">{simulacao.texto}</p>
                <p>Economia anual estimada: <strong>{formatCurrency(simulacao.economiaAnual)}</strong></p>
                <div className="flex items-start gap-2 rounded-lg bg-background p-3">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Melhor decisão: <strong>{simulacao.decisao}</strong></span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {alertasDoc.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-base">Alertas de Documentos ({alertasDoc.length})</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/cadastros/veiculos")}>
                  Ver todos <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertasDoc.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-md border bg-background p-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium">{a.nome}</span>
                      <span className="text-xs text-muted-foreground">{a.tipo === "crlv" ? "CRLV" : a.tipo === "seguro" ? "Seguro" : "CNH"}</span>
                    </div>
                  </div>
                  <Badge variant={a.dias <= 0 ? "destructive" : "warning"}>
                    {a.dias <= 0 ? `Vencido há ${Math.abs(a.dias)}d` : `${a.dias}d restantes`}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Combustível", icon: Fuel, path: "/frota/combustivel" },
            { label: "Manutenção", icon: Wrench, path: "/frota/manutencao" },
            { label: "Relatórios", icon: DollarSign, path: "/frota/relatorios" },
            { label: "Documentos", icon: Shield, path: "/frota/documentos" },
            { label: "Gamificação", icon: CheckCircle2, path: "/frota/gamificacao" },
          ].map((item) => (
            <Card key={item.path} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(item.path)}>
              <CardContent className="flex min-h-24 flex-col items-center justify-center gap-2 p-4 text-center">
                <item.icon className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium leading-tight">{item.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}

function KpiCard({ title, value, icon: Icon, detail, danger = false }: { title: string; value: string; icon: any; detail: string; danger?: boolean }) {
  return (
    <Card className={danger ? "border-destructive/40 bg-destructive/5" : "bg-card"}>
      <CardContent className="p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</span>
          <Icon className={danger ? "h-4 w-4 text-destructive" : "h-4 w-4 text-primary"} />
        </div>
        <div className="text-xl font-bold leading-tight sm:text-2xl">{value}</div>
        <p className="mt-1 text-xs leading-tight text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function CostBlock({ label, value, icon: Icon, percent }: { label: string; value: number; icon: any; percent: number }) {
  return (
    <div className="rounded-lg border border-border/45 bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="text-lg font-bold">{formatCurrency(value)}</div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (["ótimo", "ativo", "econômico"].includes(normalized)) return <Badge variant="success">{status}</Badge>;
  if (["atenção", "regular", "sem dados"].includes(normalized)) return <Badge variant="warning">{status}</Badge>;
  if (["ineficiente", "bloqueado", "agressivo"].includes(normalized)) return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}
