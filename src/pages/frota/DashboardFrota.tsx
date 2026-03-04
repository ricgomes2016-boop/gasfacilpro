import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Truck, Fuel, Wrench, AlertTriangle, FileWarning, DollarSign,
  CheckCircle2, Clock, Loader2, ChevronRight, Shield, ClipboardCheck,
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

export default function DashboardFrota() {
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [veiculosTotal, setVeiculosTotal] = useState(0);
  const [veiculosManutencao, setVeiculosManutencao] = useState(0);
  const [gastoMesComb, setGastoMesComb] = useState(0);
  const [gastoMesManut, setGastoMesManut] = useState(0);
  const [multasPendentes, setMultasPendentes] = useState(0);
  const [multasValor, setMultasValor] = useState(0);
  const [checklistsHoje, setChecklistsHoje] = useState(0);
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
      // Veículos
      const { data: veiculos } = await supabase.from("veiculos").select("id, placa, modelo, ativo, crlv_vencimento, seguro_vencimento").eq("ativo", true);
      setVeiculosTotal(veiculos?.length || 0);

      // Manutenções em andamento
      let mq = supabase.from("manutencoes").select("id", { count: "exact" }).eq("status", "Em andamento");
      if (unidadeAtual?.id) mq = mq.eq("unidade_id", unidadeAtual.id);
      const { count: manutCount } = await mq;
      setVeiculosManutencao(manutCount || 0);

      // Gastos do mês - combustível
      let aq = supabase.from("abastecimentos").select("valor").gte("data", mesInicio);
      if (unidadeAtual?.id) aq = aq.eq("unidade_id", unidadeAtual.id);
      const { data: abasts } = await aq;
      setGastoMesComb(abasts?.reduce((s, a) => s + Number(a.valor), 0) || 0);

      // Gastos do mês - manutenção
      let maq = supabase.from("manutencoes").select("valor").gte("data", mesInicio);
      if (unidadeAtual?.id) maq = maq.eq("unidade_id", unidadeAtual.id);
      const { data: manuts } = await maq;
      setGastoMesManut(manuts?.reduce((s, m) => s + Number(m.valor), 0) || 0);

      // Multas pendentes
      let muq = (supabase as any).from("multas_frota").select("valor").eq("status", "pendente");
      if (unidadeAtual?.id) muq = muq.eq("unidade_id", unidadeAtual.id);
      const { data: multas } = await muq;
      setMultasPendentes(multas?.length || 0);
      setMultasValor(multas?.reduce((s: number, m: any) => s + Number(m.valor), 0) || 0);

      // Checklists hoje
      let cq = (supabase as any).from("checklist_saida_veiculo").select("id", { count: "exact" }).eq("data", hojeStr);
      if (unidadeAtual?.id) cq = cq.eq("unidade_id", unidadeAtual.id);
      const { count: checkCount } = await cq;
      setChecklistsHoje(checkCount || 0);

      // Alertas de documentos
      const alertas: AlertaDoc[] = [];
      const em30dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      veiculos?.forEach((v: any) => {
        if (v.crlv_vencimento && v.crlv_vencimento <= em30dias) {
          const dias = Math.ceil((new Date(v.crlv_vencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          alertas.push({ tipo: "crlv", nome: `${v.placa} - ${v.modelo}`, placa: v.placa, vencimento: v.crlv_vencimento, dias });
        }
        if (v.seguro_vencimento && v.seguro_vencimento <= em30dias) {
          const dias = Math.ceil((new Date(v.seguro_vencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          alertas.push({ tipo: "seguro", nome: `${v.placa} - ${v.modelo}`, placa: v.placa, vencimento: v.seguro_vencimento, dias });
        }
      });

      // CNH vencimento
      const { data: entregadores } = await supabase.from("entregadores").select("nome, cnh_vencimento").eq("ativo", true);
      entregadores?.forEach((e: any) => {
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

  if (loading) {
    return (
      <MainLayout>
        <Header title="Dashboard de Frota" subtitle="Visão geral da frota" />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  const gastoTotal = gastoMesComb + gastoMesManut;

  return (
    <MainLayout>
      <Header title="Dashboard de Frota" subtitle="Visão geral da frota" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/cadastros/veiculos")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Veículos Ativos</CardTitle>
              <Truck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{veiculosTotal}</div>
              <p className="text-xs text-muted-foreground">{veiculosManutencao} em manutenção</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/frota/combustivel")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Custo Mensal</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {gastoTotal.toLocaleString("pt-BR")}</div>
              <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                <span><Fuel className="h-3 w-3 inline mr-1" />R$ {gastoMesComb.toLocaleString("pt-BR")}</span>
                <span><Wrench className="h-3 w-3 inline mr-1" />R$ {gastoMesManut.toLocaleString("pt-BR")}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/frota/multas")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Multas Pendentes</CardTitle>
              <FileWarning className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{multasPendentes}</div>
              <p className="text-xs text-muted-foreground">R$ {multasValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/frota/checklist")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Checklists Hoje</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{checklistsHoje}</div>
              <p className="text-xs text-muted-foreground">Inspeções realizadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Alertas de Documentos */}
        {alertasDoc.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-base">Alertas de Documentos ({alertasDoc.length})</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/frota/documentos")}>
                  Ver todos <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertasDoc.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md bg-background border">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 shrink-0 ${a.dias <= 0 ? "text-destructive" : "text-yellow-500"}`} />
                    <div>
                      <span className="text-sm font-medium">{a.nome}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {a.tipo === "crlv" ? "CRLV" : a.tipo === "seguro" ? "Seguro" : "CNH"}
                      </span>
                    </div>
                  </div>
                  <Badge variant={a.dias <= 0 ? "destructive" : "secondary"}>
                    {a.dias <= 0 ? `Vencido há ${Math.abs(a.dias)}d` : `${a.dias}d restantes`}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Combustível", icon: Fuel, path: "/frota/combustivel", color: "text-orange-600" },
            { label: "Manutenção", icon: Wrench, path: "/frota/manutencao", color: "text-blue-600" },
            { label: "Relatórios", icon: DollarSign, path: "/frota/relatorios", color: "text-primary" },
            { label: "Documentos", icon: Shield, path: "/frota/documentos", color: "text-green-600" },
            { label: "Gamificação", icon: CheckCircle2, path: "/frota/gamificacao", color: "text-purple-600" },
          ].map((item) => (
            <Card
              key={item.path}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(item.path)}
            >
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <item.icon className={`h-6 w-6 ${item.color}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
