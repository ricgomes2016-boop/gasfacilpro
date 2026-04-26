import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { getBrasiliaDate } from "@/lib/utils";
import { Loader2, TrendingDown, TrendingUp, UserMinus, UserPlus, AlertTriangle } from "lucide-react";

interface ChurnData {
  inativados30d: number;
  novos30d: number;
  totalAtivos: number;
  totalInativos: number;
  clientesRisco: { id: string; nome: string; telefone: string | null; bairro: string | null; diasSemPedido: number }[];
}

export function ChurnAnalysis() {
  const { empresa } = useEmpresa();
  const [data, setData] = useState<ChurnData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (empresa?.id) fetchChurnData();
  }, [empresa?.id]);

  const fetchChurnData = async () => {
    setLoading(true);
    try {
      const now = getBrasiliaDate();
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all clients counts filtered by empresa
      const baseQ = () => {
        let q = supabase.from("clientes").select("id", { count: "exact", head: true });
        if (empresa?.id) q = q.eq("empresa_id", empresa.id);
        return q;
      };
      const [ativosRes, inativosRes, novosRes, inativadosRes] = await Promise.all([
        baseQ().eq("ativo", true),
        baseQ().eq("ativo", false),
        baseQ().eq("ativo", true).gte("created_at", d30),
        baseQ().eq("ativo", false).gte("updated_at", d30),
      ]);

      // Clientes em risco: ativos mas sem pedidos há mais de 45 dias
      let riskQ = supabase
        .from("clientes")
        .select("id, nome, telefone, bairro")
        .eq("ativo", true)
        .limit(500);
      if (empresa?.id) riskQ = riskQ.eq("empresa_id", empresa.id);
      const { data: clientesAtivos } = await riskQ;

      let clientesRisco: ChurnData["clientesRisco"] = [];

      if (clientesAtivos && clientesAtivos.length > 0) {
        const ids = clientesAtivos.map(c => c.id);
        const { data: pedidos } = await supabase
          .from("pedidos")
          .select("cliente_id, created_at")
          .in("cliente_id", ids)
          .order("created_at", { ascending: false });

        const ultimoPedidoMap = new Map<string, string>();
        pedidos?.forEach(p => {
          if (p.cliente_id && !ultimoPedidoMap.has(p.cliente_id)) {
            ultimoPedidoMap.set(p.cliente_id, p.created_at);
          }
        });

        clientesRisco = clientesAtivos
          .map(c => {
            const ultimo = ultimoPedidoMap.get(c.id);
            if (!ultimo) return { ...c, diasSemPedido: 999 };
            const dias = Math.floor((now.getTime() - new Date(ultimo).getTime()) / (1000 * 60 * 60 * 24));
            return { ...c, diasSemPedido: dias };
          })
          .filter(c => c.diasSemPedido >= 45)
          .sort((a, b) => b.diasSemPedido - a.diasSemPedido)
          .slice(0, 10);
      }

      setData({
        inativados30d: inativadosRes.count || 0,
        novos30d: novosRes.count || 0,
        totalAtivos: ativosRes.count || 0,
        totalInativos: inativosRes.count || 0,
        clientesRisco,
      });
    } catch (e) {
      console.error("Erro na análise de churn:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const saldoLiquido = data.novos30d - data.inativados30d;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-success/10">
                <UserPlus className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.novos30d}</p>
                <p className="text-sm text-muted-foreground">Novos (30 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-destructive/10">
                <UserMinus className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.inativados30d}</p>
                <p className="text-sm text-muted-foreground">Inativados (30 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${saldoLiquido >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                {saldoLiquido >= 0 ? (
                  <TrendingUp className="h-6 w-6 text-success" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-destructive" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {saldoLiquido >= 0 ? "+" : ""}{saldoLiquido}
                </p>
                <p className="text-sm text-muted-foreground">Saldo líquido</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-warning/10">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.clientesRisco.length}</p>
                <p className="text-sm text-muted-foreground">Em risco (+45 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clientes em risco */}
      {data.clientesRisco.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Clientes em risco de churn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Dias sem pedido</TableHead>
                  <TableHead>Risco</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.clientesRisco.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.telefone || "-"}</TableCell>
                    <TableCell>{c.bairro || "-"}</TableCell>
                    <TableCell>{c.diasSemPedido === 999 ? "Nunca comprou" : `${c.diasSemPedido} dias`}</TableCell>
                    <TableCell>
                      <Badge variant={c.diasSemPedido > 90 ? "destructive" : "outline"} className={c.diasSemPedido <= 90 ? "border-warning text-warning" : ""}>
                        {c.diasSemPedido > 90 ? "Crítico" : "Atenção"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
