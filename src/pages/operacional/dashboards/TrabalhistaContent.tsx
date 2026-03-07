import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Clock, AlertTriangle, CheckCircle, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button><FileText className="h-4 w-4 mr-2" />Gerar Relatório</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><Users className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">{totalFuncionarios}</p><p className="text-sm text-muted-foreground">Funcionários</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-chart-2/10"><Clock className="h-6 w-6 text-chart-2" /></div><div><p className="text-2xl font-bold">{totalFuncionarios * 44}h</p><p className="text-sm text-muted-foreground">Horas Previstas</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-chart-4/10"><AlertTriangle className="h-6 w-6 text-chart-4" /></div><div><p className="text-2xl font-bold">{alertasAtivos}</p><p className="text-sm text-muted-foreground">Alertas Ativos</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-chart-3/10"><CheckCircle className="h-6 w-6 text-chart-3" /></div><div><p className="text-2xl font-bold">{totalFuncionarios > 0 ? Math.round(((totalFuncionarios - alertasAtivos) / totalFuncionarios) * 100) : 0}%</p><p className="text-sm text-muted-foreground">Conformidade</p></div></div></CardContent></Card>
      </div>

      {alertas.length > 0 && (
        <Card className="border-chart-4/50">
          <CardHeader><CardTitle className="flex items-center gap-2 text-chart-4"><AlertTriangle className="h-5 w-5" />Alertas de Jornada</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertas.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-chart-4/10">
                  <div><p className="font-medium">{(a.funcionarios as any)?.nome} - {a.tipo}</p><p className="text-sm text-muted-foreground">{a.descricao}</p></div>
                  <Badge variant={a.nivel === "alto" ? "destructive" : "default"}>{a.nivel}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Controle de Jornada</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Funcionário</TableHead><TableHead>Cargo</TableHead><TableHead>Horas Semanais</TableHead><TableHead>Horas Extras</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {funcionarios.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell>{f.cargo || "-"}</TableCell>
                  <TableCell>{f.horasSemanais}h</TableCell>
                  <TableCell>{f.horasExtras}h</TableCell>
                  <TableCell><Badge variant={f.status === "regular" ? "default" : "destructive"}>{f.status === "regular" ? "Regular" : "Alerta"}</Badge></TableCell>
                </TableRow>
              ))}
              {funcionarios.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum funcionário encontrado</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
