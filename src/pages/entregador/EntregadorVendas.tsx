import { useEffect, useState } from "react";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Package, ShoppingBag, TrendingUp, BarChart3, Calendar, Award
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getBrasiliaDate, getBrasiliaDateString } from "@/lib/utils";

interface ProdutoQtd {
  nome: string;
  quantidade: number;
  valor: number;
}

interface DiaQtd {
  dia: string;
  quantidade: number;
}

export default function EntregadorVendas() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [produtosHoje, setProdutosHoje] = useState<ProdutoQtd[]>([]);
  const [produtosSemana, setProdutosSemana] = useState<ProdutoQtd[]>([]);
  const [produtosMes, setProdutosMes] = useState<ProdutoQtd[]>([]);
  const [graficoDias, setGraficoDias] = useState<DiaQtd[]>([]);
  const [totais, setTotais] = useState({ hoje: 0, semana: 0, mes: 0 });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data: ent } = await supabase
          .from("entregadores").select("id").eq("user_id", user.id).maybeSingle();
        if (!ent) { setLoading(false); return; }

        const hoje = getBrasiliaDate();
        const hojeStr = getBrasiliaDateString();
        const inicioSemana = startOfWeek(hoje, { locale: ptBR });
        const inicioMes = startOfMonth(hoje);

        // Buscar itens de pedidos do entregador do mês
        const { data: itens } = await supabase
          .from("pedido_itens")
          .select(`
            quantidade,
            preco_unitario,
            produtos:produto_id(nome),
            pedidos!inner(entregador_id, created_at, status)
          `)
          .eq("pedidos.entregador_id", ent.id)
          .eq("pedidos.status", "entregue")
          .gte("pedidos.created_at", inicioMes.toISOString());

        const todos = itens || [];

        const agrupar = (lista: typeof todos): ProdutoQtd[] => {
          const map: Record<string, ProdutoQtd> = {};
          lista.forEach((item: any) => {
            const nome = item.produtos?.nome || "Produto";
            if (!map[nome]) map[nome] = { nome, quantidade: 0, valor: 0 };
            map[nome].quantidade += item.quantidade;
            map[nome].valor += item.quantidade * (item.preco_unitario || 0);
          });
          return Object.values(map).sort((a, b) => b.quantidade - a.quantidade);
        };

        const filtrarPor = (lista: typeof todos, desde: Date) =>
          lista.filter((item: any) => new Date(item.pedidos?.created_at) >= desde);

        const itensHoje = todos.filter((item: any) =>
          item.pedidos?.created_at?.startsWith(hojeStr));
        const itensSemana = filtrarPor(todos, inicioSemana);

        setProdutosHoje(agrupar(itensHoje));
        setProdutosSemana(agrupar(itensSemana));
        setProdutosMes(agrupar(todos));

        setTotais({
          hoje: itensHoje.reduce((s: number, i: any) => s + i.quantidade, 0),
          semana: itensSemana.reduce((s: number, i: any) => s + i.quantidade, 0),
          mes: todos.reduce((s: number, i: any) => s + i.quantidade, 0),
        });

        // Gráfico dos últimos 7 dias
        const diasNomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const grafico: DiaQtd[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = subDays(hoje, i);
          const dStr = format(d, "yyyy-MM-dd");
          const qtd = todos
            .filter((item: any) => item.pedidos?.created_at?.startsWith(dStr))
            .reduce((s: number, item: any) => s + item.quantidade, 0);
          grafico.push({ dia: diasNomes[d.getDay()], quantidade: qtd });
        }
        setGraficoDias(grafico);

      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    load();
  }, [user]);

  const ListaProdutos = ({ produtos }: { produtos: ProdutoQtd[] }) => {
    if (!produtos.length) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma venda no período</p>
        </div>
      );
    }
    const max = produtos[0].quantidade;
    return (
      <div className="space-y-3">
        {produtos.map((p, i) => (
          <div key={p.nome} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {i === 0 && <Award className="h-3.5 w-3.5 text-warning" />}
                {i === 1 && <Award className="h-3.5 w-3.5 text-slate-400" />}
                {i === 2 && <Award className="h-3.5 w-3.5 text-warning" />}
                <span className="font-medium truncate max-w-[160px]">{p.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs font-bold">
                  {p.quantidade} un
                </Badge>
              </div>
            </div>
            <Progress value={(p.quantidade / max) * 100} className="h-1.5" />
            <p className="text-xs text-muted-foreground text-right">
              R$ {p.valor.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <EntregadorLayout title="Vendas por Produto">
        <div className="p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      </EntregadorLayout>
    );
  }

  return (
    <EntregadorLayout title="Vendas por Produto">
      <div className="p-4 space-y-4">

        {/* Header */}
        <div className="gradient-primary rounded-2xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/80 text-sm">Qtd vendida hoje</p>
              <h1 className="text-3xl font-bold">{totais.hoje}</h1>
              <p className="text-white/70 text-sm">unidades</p>
            </div>
            <div className="text-right">
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                <ShoppingBag className="h-8 w-8" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-white/70 text-xs">Esta semana</p>
              <p className="text-white font-bold text-xl">{totais.semana}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-white/70 text-xs">Este mês</p>
              <p className="text-white font-bold text-xl">{totais.mes}</p>
            </div>
          </div>
        </div>

        {/* Gráfico 7 dias */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Unidades Vendidas — Últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={graficoDias} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(val: number) => [val, "Unidades"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                  {graficoDias.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === graficoDias.length - 1
                        ? "hsl(var(--primary))"
                        : "hsl(var(--primary) / 0.4)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tabs por período */}
        <Tabs defaultValue="hoje">
          <TabsList className="w-full">
            <TabsTrigger value="hoje" className="flex-1">Hoje</TabsTrigger>
            <TabsTrigger value="semana" className="flex-1">Semana</TabsTrigger>
            <TabsTrigger value="mes" className="flex-1">Mês</TabsTrigger>
          </TabsList>
          <TabsContent value="hoje">
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Produtos Vendidos Hoje
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ListaProdutos produtos={produtosHoje} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="semana">
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Produtos Vendidos na Semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ListaProdutos produtos={produtosSemana} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="mes">
            <Card className="border-none shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Produtos Vendidos no Mês
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ListaProdutos produtos={produtosMes} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </EntregadorLayout>
  );
}
