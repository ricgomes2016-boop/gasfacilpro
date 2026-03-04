import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, DollarSign, TrendingUp, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

interface Categoria {
  nome: string;
  realizado: number;
}

export default function PlanejamentoMensal({ embedded = false }: { embedded?: boolean }) {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const mesFim = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const diasRestantes = diasNoMes - now.getDate();

      // Receita de vendas
      let pq = supabase.from("pedidos").select("valor_total").gte("created_at", mesInicio).lt("created_at", mesFim).neq("status", "cancelado");
      if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);
      const { data: pedidos } = await pq;
      const receita = pedidos?.reduce((s, p) => s + (p.valor_total || 0), 0) || 0;

      // Despesas por categoria
      let dq = supabase.from("movimentacoes_caixa").select("valor, categoria").eq("tipo", "saida").gte("created_at", mesInicio).lt("created_at", mesFim);
      if (unidadeAtual?.id) dq = dq.eq("unidade_id", unidadeAtual.id);
      const { data: despesas } = await dq;

      const catMap: Record<string, number> = {};
      despesas?.forEach(d => {
        const cat = d.categoria || "Outros";
        catMap[cat] = (catMap[cat] || 0) + Number(d.valor || 0);
      });

      const cats: Categoria[] = [
        { nome: "Receita de Vendas", realizado: receita },
        ...Object.entries(catMap).map(([nome, realizado]) => ({ nome, realizado: -realizado })),
      ];
      setCategorias(cats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    const loader = <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    if (embedded) return loader;
    return (
      <MainLayout>
        <Header title="Planejamento Financeiro" subtitle="Planejamento mensal de receitas e despesas" />
        {loader}
      </MainLayout>
    );
  }

  const totalRealizado = categorias.reduce((s, c) => s + c.realizado, 0);
  const now = new Date();
  const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const diasRestantes = diasNoMes - now.getDate();

  const content = (
    <div className="space-y-6">



        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-green-500/10"><TrendingUp className="h-6 w-6 text-green-500" /></div><div><p className="text-2xl font-bold">R$ {totalRealizado.toLocaleString("pt-BR")}</p><p className="text-sm text-muted-foreground">Resultado Atual</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-primary/10"><DollarSign className="h-6 w-6 text-primary" /></div><div><p className="text-2xl font-bold">{categorias.length}</p><p className="text-sm text-muted-foreground">Categorias</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center gap-4"><div className="p-3 rounded-lg bg-blue-500/10"><Calendar className="h-6 w-6 text-blue-500" /></div><div><p className="text-2xl font-bold">{diasRestantes} dias</p><p className="text-sm text-muted-foreground">Restantes no Mês</p></div></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Categorias</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categorias.map((cat) => (
                  <TableRow key={cat.nome}>
                    <TableCell className="font-medium">{cat.nome}</TableCell>
                    <TableCell className={`text-right ${cat.realizado < 0 ? "text-destructive" : "text-green-600"}`}>
                      R$ {cat.realizado.toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className={`text-right ${totalRealizado > 0 ? "text-green-600" : "text-destructive"}`}>
                    R$ {totalRealizado.toLocaleString("pt-BR")}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
      </Card>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Planejamento Financeiro" subtitle="Planejamento mensal de receitas e despesas" />
      <div className="p-3 sm:p-4 md:p-6">{content}</div>
    </MainLayout>
  );
}
