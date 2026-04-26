import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gift, Users, Star, Trophy, Heart, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

export default function Fidelidade() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [fidelidade, setFidelidade] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let q = supabase.from("fidelidade_clientes").select("*, clientes(nome)").order("pontos", { ascending: false }).limit(50);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      setFidelidade(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) {
    return (<MainLayout><Header title="Fidelidade" subtitle="Programa de fidelidade e indicações" /><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></MainLayout>);
  }

  const totalPontos = fidelidade.reduce((s, f) => s + f.pontos, 0);
  const totalIndicacoes = fidelidade.reduce((s, f) => s + f.indicacoes_realizadas, 0);
  const ouro = fidelidade.filter(f => f.nivel === "Ouro").length;

  const niveis = [
    { nome: "Bronze", min: 0, max: 200, beneficio: "5% desconto" },
    { nome: "Prata", min: 201, max: 400, beneficio: "10% desconto" },
    { nome: "Ouro", min: 401, max: 600, beneficio: "15% desconto + entrega grátis" },
  ];

  return (
    <MainLayout>
      <Header title="Fidelidade" subtitle="Programa de fidelidade e indicações" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between"><Button><Gift className="h-4 w-4 mr-2" />Configurar Programa</Button></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Card className="kpi-card kpi-card-primary"><CardContent className="kpi-card-content"><div className="status-card-icon status-card-icon-primary"><Users /></div><div><p className="kpi-value">{fidelidade.length}</p><p className="kpi-label">Participantes</p></div></CardContent></Card>
          <Card className="kpi-card kpi-card-warning"><CardContent className="kpi-card-content"><div className="status-card-icon status-card-icon-warning"><Star /></div><div><p className="kpi-value text-warning">{totalPontos.toLocaleString("pt-BR")}</p><p className="kpi-label">Pontos Ativos</p></div></CardContent></Card>
          <Card className="kpi-card kpi-card-success"><CardContent className="kpi-card-content"><div className="status-card-icon status-card-icon-success"><Heart /></div><div><p className="kpi-value text-success">{totalIndicacoes}</p><p className="kpi-label">Indicações</p></div></CardContent></Card>
          <Card className="kpi-card kpi-card-info"><CardContent className="kpi-card-content"><div className="status-card-icon status-card-icon-info"><Trophy /></div><div><p className="kpi-value text-info">{ouro}</p><p className="kpi-label">Clientes Ouro</p></div></CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle>Níveis do Programa</CardTitle></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-3">{niveis.map(n => (<div key={n.nome} className="modern-soft-panel p-4 text-center"><Badge className={n.nome === "Ouro" ? "bg-warning text-warning-foreground" : n.nome === "Prata" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}>{n.nome}</Badge><p className="text-sm text-muted-foreground mt-2">{n.min} - {n.max} pontos</p><p className="font-medium mt-1">{n.beneficio}</p></div>))}</div></CardContent></Card>
        <Card>
          <CardHeader><CardTitle>Top Clientes Fidelidade</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Pontos</TableHead><TableHead>Progresso</TableHead><TableHead>Nível</TableHead><TableHead>Indicações</TableHead></TableRow></TableHeader>
              <TableBody>
                {fidelidade.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum cliente no programa</TableCell></TableRow>}
                {fidelidade.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{(c.clientes as any)?.nome || "-"}</TableCell>
                    <TableCell>{c.pontos}</TableCell>
                    <TableCell className="w-32"><Progress value={(c.pontos / 600) * 100} /></TableCell>
                    <TableCell><Badge className={c.nivel === "Ouro" ? "bg-warning text-warning-foreground" : c.nivel === "Prata" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}>{c.nivel}</Badge></TableCell>
                    <TableCell>{c.indicacoes_realizadas}</TableCell>
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
