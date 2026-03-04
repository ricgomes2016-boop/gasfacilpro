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
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><Users className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">{fidelidade.length}</p><p className="text-sm text-muted-foreground">Participantes</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-yellow-500/10"><Star className="h-6 w-6 text-yellow-500" /></div><div><p className="text-2xl font-bold">{totalPontos.toLocaleString("pt-BR")}</p><p className="text-sm text-muted-foreground">Pontos Ativos</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-green-500/10"><Heart className="h-6 w-6 text-green-500" /></div><div><p className="text-2xl font-bold">{totalIndicacoes}</p><p className="text-sm text-muted-foreground">Indicações</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-blue-500/10"><Trophy className="h-6 w-6 text-blue-500" /></div><div><p className="text-2xl font-bold">{ouro}</p><p className="text-sm text-muted-foreground">Clientes Ouro</p></div></div></CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle>Níveis do Programa</CardTitle></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-3">{niveis.map(n => (<div key={n.nome} className="p-4 rounded-lg border text-center"><Badge className={n.nome === "Ouro" ? "bg-yellow-500" : n.nome === "Prata" ? "bg-gray-400" : "bg-amber-700"}>{n.nome}</Badge><p className="text-sm text-muted-foreground mt-2">{n.min} - {n.max} pontos</p><p className="font-medium mt-1">{n.beneficio}</p></div>))}</div></CardContent></Card>
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
                    <TableCell><Badge className={c.nivel === "Ouro" ? "bg-yellow-500" : c.nivel === "Prata" ? "bg-gray-400" : "bg-amber-700"}>{c.nivel}</Badge></TableCell>
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
