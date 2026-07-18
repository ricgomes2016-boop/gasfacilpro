import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle, Download, Clock, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { differenceInDays, format } from "date-fns";
import * as XLSX from "xlsx";

interface AgingItem {
  id: string;
  cliente: string;
  descricao: string;
  valor: number;
  vencimento: string;
  diasAtraso: number;
  faixa: string;
}

const FAIXAS = [
  { label: "1-30 dias", min: 1, max: 30, color: "hsl(var(--warning))" },
  { label: "31-60 dias", min: 31, max: 60, color: "hsl(var(--accent-foreground))" },
  { label: "61-90 dias", min: 61, max: 90, color: "hsl(var(--destructive))" },
  { label: "90+ dias", min: 91, max: 99999, color: "hsl(var(--destructive))" },
];

function getFaixa(dias: number) {
  return FAIXAS.find(f => dias >= f.min && dias <= f.max) || FAIXAS[3];
}

export default function AgingReport({ embedded }: { embedded?: boolean } = {}) {
  const { unidadeAtual } = useUnidade();
  const hoje = new Date();

  const { data: recebiveis = [], isLoading } = useQuery({
    queryKey: ["aging_recebiveis", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("contas_receber").select("id, cliente, descricao, valor, vencimento").eq("status", "pendente");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const items: AgingItem[] = recebiveis
    .map((r: any) => {
      const diasAtraso = differenceInDays(hoje, new Date(r.vencimento + "T12:00:00"));
      return {
        ...r,
        valor: Number(r.valor),
        diasAtraso,
        faixa: getFaixa(diasAtraso).label,
      };
    })
    .filter((r) => r.diasAtraso > 0)
    .sort((a, b) => b.diasAtraso - a.diasAtraso);

  // Totais por faixa
  const totaisFaixa = FAIXAS.map(f => {
    const faixaItems = items.filter(i => i.diasAtraso >= f.min && i.diasAtraso <= f.max);
    return {
      faixa: f.label,
      quantidade: faixaItems.length,
      valor: faixaItems.reduce((s, i) => s + i.valor, 0),
      color: f.color,
    };
  });

  const totalInadimplente = items.reduce((s, i) => s + i.valor, 0);
  const ticketMedio = items.length > 0 ? totalInadimplente / items.length : 0;
  const maiorAtraso = items.length > 0 ? items[0].diasAtraso : 0;

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const exportToExcel = () => {
    const data = items.map(i => ({
      Cliente: i.cliente,
      Descrição: i.descricao,
      Vencimento: format(new Date(i.vencimento + "T12:00:00"), "dd/MM/yyyy"),
      "Dias Atraso": i.diasAtraso,
      Faixa: i.faixa,
      Valor: `R$ ${i.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aging Report");
    XLSX.writeFile(wb, `aging_report_${format(new Date(), "ddMMyyyy")}.xlsx`);
  };

  const content = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Inadimplente</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-destructive">{fmt(totalInadimplente)}</div>
              <p className="text-xs text-muted-foreground">{items.length} título(s) vencido(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Ticket Médio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{fmt(ticketMedio)}</div>
              <p className="text-xs text-muted-foreground">Por título vencido</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Maior Atraso</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-warning">{maiorAtraso} dias</div>
              <p className="text-xs text-muted-foreground">{items.length > 0 ? items[0].cliente : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Faixa Crítica</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{totaisFaixa[3].quantidade}</div>
              <p className="text-xs text-muted-foreground">90+ dias — {fmt(totaisFaixa[3].valor)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Distribuição por Faixa de Atraso</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportToExcel}>
              <Download className="h-4 w-4" /> Exportar
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={totaisFaixa}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="faixa" />
                <YAxis />
                <Tooltip formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR")}`} />
                <Bar dataKey="valor" name="Valor" radius={[4, 4, 0, 0]}>
                  {totaisFaixa.map((f, i) => <Cell key={i} fill={f.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resumo por faixa */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {totaisFaixa.map((f, i) => (
            <Card key={i} className="text-center">
              <CardContent className="pt-4">
                <Badge variant="outline" className="mb-2">{f.faixa}</Badge>
                <p className="text-xl font-bold">{f.quantidade}</p>
                <p className="text-sm text-muted-foreground">{fmt(f.valor)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabela detalhada */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhamento de Títulos Vencidos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : items.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nenhum título vencido"
                description="A carteira está em dia. Novos títulos vencidos aparecerão automaticamente nesta visão."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-center">Dias Atraso</TableHead>
                      <TableHead>Faixa</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.slice(0, 50).map((item) => {
                      const faixa = getFaixa(item.diasAtraso);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.cliente}</TableCell>
                          <TableCell className="text-sm">{item.descricao}</TableCell>
                          <TableCell>{format(new Date(item.vencimento + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-center font-bold">{item.diasAtraso}</TableCell>
                          <TableCell>
                            <Badge variant={item.diasAtraso > 90 ? "destructive" : item.diasAtraso > 60 ? "destructive" : "secondary"}>
                              {faixa.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{fmt(item.valor)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Aging Report" subtitle="Análise de inadimplência por faixa de atraso" />
      {content}
    </MainLayout>
  );
}
