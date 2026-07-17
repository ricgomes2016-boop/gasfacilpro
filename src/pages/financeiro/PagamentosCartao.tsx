import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CreditCard, DollarSign, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PagamentosCartaoRelatorio() {
  const { unidadeAtual } = useUnidade();
  const [filtroAba, setFiltroAba] = useState("geral");
  const [mesRef, setMesRef] = useState(format(new Date(), "yyyy-MM"));

  const inicioMes = startOfMonth(new Date(mesRef + "-01")).toISOString();
  const fimMes = endOfMonth(new Date(mesRef + "-01")).toISOString();

  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ["pagamentos-cartao-relatorio", unidadeAtual?.id, mesRef],
    queryFn: async () => {
      let query = supabase
        .from("pagamentos_cartao")
        .select("*, entregadores(nome), unidades:loja_id(nome)")
        .gte("created_at", inicioMes)
        .lte("created_at", fimMes)
        .eq("status", "aprovado")
        .order("created_at", { ascending: false });

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const totalBruto = pagamentos.reduce((s, p) => s + Number(p.valor_bruto || 0), 0);
  const totalTaxa = pagamentos.reduce((s, p) => s + Number(p.valor_taxa || 0), 0);
  const totalLiquido = pagamentos.reduce((s, p) => s + Number(p.valor_liquido || 0), 0);
  const totalAReceber = pagamentos.filter(p => !p.liquidado).reduce((s, p) => s + Number(p.valor_liquido || 0), 0);
  const totalLiquidado = pagamentos.filter(p => p.liquidado).reduce((s, p) => s + Number(p.valor_liquido || 0), 0);

  // Agrupamentos
  const porLoja = pagamentos.reduce((acc, p) => {
    const nome = (p.unidades as any)?.nome || "Sem loja";
    if (!acc[nome]) acc[nome] = { bruto: 0, taxa: 0, liquido: 0, count: 0 };
    acc[nome].bruto += Number(p.valor_bruto || 0);
    acc[nome].taxa += Number(p.valor_taxa || 0);
    acc[nome].liquido += Number(p.valor_liquido || 0);
    acc[nome].count += 1;
    return acc;
  }, {} as Record<string, { bruto: number; taxa: number; liquido: number; count: number }>);

  const porEntregador = pagamentos.reduce((acc, p) => {
    const nome = (p.entregadores as any)?.nome || "Sem entregador";
    if (!acc[nome]) acc[nome] = { bruto: 0, taxa: 0, liquido: 0, count: 0 };
    acc[nome].bruto += Number(p.valor_bruto || 0);
    acc[nome].taxa += Number(p.valor_taxa || 0);
    acc[nome].liquido += Number(p.valor_liquido || 0);
    acc[nome].count += 1;
    return acc;
  }, {} as Record<string, { bruto: number; taxa: number; liquido: number; count: number }>);

  const porMaquininha = pagamentos.reduce((acc, p) => {
    const serial = p.maquininha_serial || "Não identificada";
    if (!acc[serial]) acc[serial] = { bruto: 0, taxa: 0, liquido: 0, count: 0 };
    acc[serial].bruto += Number(p.valor_bruto || 0);
    acc[serial].taxa += Number(p.valor_taxa || 0);
    acc[serial].liquido += Number(p.valor_liquido || 0);
    acc[serial].count += 1;
    return acc;
  }, {} as Record<string, { bruto: number; taxa: number; liquido: number; count: number }>);

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const renderGroupTable = (data: Record<string, { bruto: number; taxa: number; liquido: number; count: number }>, label: string) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{label}</TableHead>
          <TableHead className="text-right">Qtd</TableHead>
          <TableHead className="text-right">Bruto</TableHead>
          <TableHead className="text-right">Taxa</TableHead>
          <TableHead className="text-right">Líquido</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(data).map(([nome, v]) => (
          <TableRow key={nome}>
            <TableCell className="font-medium">{nome}</TableCell>
            <TableCell className="text-right">{v.count}</TableCell>
            <TableCell className="text-right">{fmtBRL(v.bruto)}</TableCell>
            <TableCell className="text-right text-destructive">{fmtBRL(v.taxa)}</TableCell>
            <TableCell className="text-right font-semibold">{fmtBRL(v.liquido)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6" /> Pagamentos Maquininha
        </h2>
        <Input
          type="month"
          value={mesRef}
          onChange={(e) => setMesRef(e.target.value)}
          className="w-48"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Total Bruto</div>
            <div className="text-xl font-bold">{fmtBRL(totalBruto)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />Total Taxa</div>
            <div className="text-xl font-bold text-destructive">{fmtBRL(totalTaxa)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Líquido</div>
            <div className="text-xl font-bold">{fmtBRL(totalLiquido)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />A Receber</div>
            <div className="text-xl font-bold text-warning dark:text-warning">{fmtBRL(totalAReceber)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3" />Liquidado</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(totalLiquidado)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de agrupamento */}
      <Tabs value={filtroAba} onValueChange={setFiltroAba}>
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="loja">Por Loja</TabsTrigger>
          <TabsTrigger value="entregador">Por Entregador</TabsTrigger>
          <TabsTrigger value="maquininha">Por Maquininha</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Bandeira</TableHead>
                    <TableHead>NSU</TableHead>
                    <TableHead>Entregador</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Liquidação</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={10} className="text-center">Carregando...</TableCell></TableRow>
                  ) : pagamentos.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Nenhum pagamento no período</TableCell></TableRow>
                  ) : pagamentos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{format(new Date(p.created_at), "dd/MM HH:mm")}</TableCell>
                      <TableCell>
                        <Badge variant={p.tipo === "debito" ? "secondary" : "default"}>
                          {p.tipo === "debito" ? "Débito" : `Crédito ${p.parcelas}x`}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.bandeira || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{p.nsu || "-"}</TableCell>
                      <TableCell>{(p.entregadores as any)?.nome || "-"}</TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(p.valor_bruto))}</TableCell>
                      <TableCell className="text-right text-destructive">{fmtBRL(Number(p.valor_taxa || 0))}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtBRL(Number(p.valor_liquido || 0))}</TableCell>
                      <TableCell>{p.data_prevista_liquidacao ? format(new Date(p.data_prevista_liquidacao + "T12:00:00"), "dd/MM/yy") : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={p.liquidado ? "outline" : "secondary"}>
                          {p.liquidado ? "Liquidado" : "Pendente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loja">
          <Card><CardContent className="pt-4">{renderGroupTable(porLoja, "Loja")}</CardContent></Card>
        </TabsContent>

        <TabsContent value="entregador">
          <Card><CardContent className="pt-4">{renderGroupTable(porEntregador, "Entregador")}</CardContent></Card>
        </TabsContent>

        <TabsContent value="maquininha">
          <Card><CardContent className="pt-4">{renderGroupTable(porMaquininha, "Maquininha (Serial)")}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
