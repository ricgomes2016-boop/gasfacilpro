import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageSectionLoader } from "@/components/ui/page-loader";
import { Users, Clock, AlertTriangle, CheckCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { KpiCard, SectionCard } from "@/components/shared";

export default function TrabalhistaContent() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [totalFuncionarios, setTotalFuncionarios] = useState(0);
  const [alertasAtivos, setAlertasAtivos] = useState(0);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let funcQ = supabase.from("funcionarios").select("id, nome, cargo").eq("ativo", true);
      if (unidadeAtual?.id) funcQ = funcQ.eq("unidade_id", unidadeAtual.id);
      const { data: funcs } = await funcQ;
      setTotalFuncionarios(funcs?.length || 0);

      let bhQuery = supabase.from("banco_horas").select("funcionario_id, saldo_positivo, saldo_negativo");
      if (unidadeAtual?.id) bhQuery = bhQuery.eq("unidade_id", unidadeAtual.id);
      const { data: bancoHoras } = await bhQuery;

      const listaFuncs = (funcs || []).slice(0, 10).map(f => {
        const bh = bancoHoras?.find(b => b.funcionario_id === f.id);
        const horasExtras = bh ? Number(bh.saldo_positivo) : 0;
        return { ...f, horasSemanais: 44, horasExtras, status: horasExtras > 10 ? "alerta" : "regular" };
      });
      setFuncionarios(listaFuncs);

      let aq = supabase.from("alertas_jornada").select("*, funcionarios(nome)").eq("resolvido", false);
      if (unidadeAtual?.id) aq = aq.eq("unidade_id", unidadeAtual.id);
      const { data: alertasData } = await aq;
      setAlertasAtivos(alertasData?.length || 0);
      setAlertas((alertasData || []).slice(0, 5));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <PageSectionLoader label="Carregando visão trabalhista..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button size="sm"><FileText className="h-4 w-4 mr-2" />Gerar Relatório</Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Funcionários" value={totalFuncionarios} tone="primary" />
        <KpiCard icon={Clock} label="Horas Previstas" value={`${totalFuncionarios * 44}h`} tone="info" />
        <KpiCard icon={AlertTriangle} label="Alertas Ativos" value={alertasAtivos} tone="warning" />
        <KpiCard icon={CheckCircle} label="Conformidade" value={`${totalFuncionarios > 0 ? Math.round(((totalFuncionarios - alertasAtivos) / totalFuncionarios) * 100) : 0}%`} tone="success" />
      </div>

      {alertas.length > 0 && (
        <SectionCard title="Alertas de Jornada" icon={AlertTriangle} className="border-warning/40">
          <div className="space-y-2">
            {alertas.map((a: any) => (
              <div key={a.id} className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="font-medium truncate">{(a.funcionarios as any)?.nome} — {a.tipo}</p><p className="text-sm text-muted-foreground truncate">{a.descricao}</p></div>
                <Badge variant={a.nivel === "alto" ? "destructive" : "default"} className="shrink-0">{a.nivel}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Controle de Jornada" icon={Users} noPadding>
        <Table>
          <TableHeader><TableRow><TableHead className="text-xs uppercase text-muted-foreground">Funcionário</TableHead><TableHead className="text-xs uppercase text-muted-foreground">Cargo</TableHead><TableHead className="text-xs uppercase text-muted-foreground">Horas Semanais</TableHead><TableHead className="text-xs uppercase text-muted-foreground">Horas Extras</TableHead><TableHead className="text-xs uppercase text-muted-foreground">Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {funcionarios.map((f) => (
              <TableRow key={f.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">{f.nome}</TableCell>
                <TableCell>{f.cargo || "-"}</TableCell>
                <TableCell>{f.horasSemanais}h</TableCell>
                <TableCell>{f.horasExtras}h</TableCell>
                <TableCell><Badge variant={f.status === "regular" ? "default" : "destructive"}>{f.status === "regular" ? "Regular" : "Alerta"}</Badge></TableCell>
              </TableRow>
            ))}
            {funcionarios.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum funcionário encontrado</TableCell></TableRow>}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
