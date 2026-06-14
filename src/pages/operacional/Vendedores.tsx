import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriodo, PeriodoProvider } from "@/contexts/PeriodoContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  TrendingUp,
  DollarSign,
  Award,
  Trophy,
  Medal,
  Download,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Header } from "@/components/layout/Header";

interface VendedorMeta {
  funcionario_id: string;
  user_id: string | null;
  meta_mensal: number;
  percentual: number;
  valor_fixo_comissao: number;
  tipo_comissao: "percentual" | "valor_fixo";
  nome: string;
}

interface Pedido {
  id: string;
  created_at: string;
  vendedor_id: string | null;
  valor_total: number;
  status: string;
  tipo_venda: string | null;
  forma_pagamento: string | null;
  cliente_nome?: string | null;
}

interface ResumoVendedor {
  user_id: string;
  nome: string;
  qtd: number;
  total: number;
  ticket: number;
  meta: number;
  metaPct: number;
  comissao: number;
  tipoComissao: "percentual" | "valor_fixo";
}

const STATUS_VALIDOS = ["entregue", "pago", "concluido", "finalizado"];

function statusMeta(pct: number): { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string } {
  if (pct >= 100) return { label: "Bateu meta", variant: "default", className: "bg-emerald-600 hover:bg-emerald-700" };
  if (pct >= 50) return { label: "No caminho", variant: "secondary", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300" };
  return { label: "Abaixo", variant: "destructive" };
}

function VendedoresInner() {
  const { range } = usePeriodo();
  const { unidadeAtual } = useUnidade();
  const [vendedores, setVendedores] = useState<VendedorMeta[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendedorFiltro, setVendedorFiltro] = useState<string>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");

  useEffect(() => {
    if (!unidadeAtual?.id) return;
    (async () => {
      setLoading(true);
      try {
        const { data: funcs } = await (supabase as any)
          .from("funcionarios")
          .select("id, nome, user_id")
          .eq("is_vendedor", true)
          .eq("unidade_id", unidadeAtual.id);

        const funcIds = (funcs || []).map((f: any) => f.id);
        if (funcIds.length === 0) {
          setVendedores([]);
          setPedidos([]);
          return;
        }

        const { data: metas } = await (supabase as any)
          .from("vendedor_metas")
          .select("funcionario_id, user_id, meta_mensal, percentual, valor_fixo_comissao, tipo_comissao")
          .in("funcionario_id", funcIds);

        const lista: VendedorMeta[] = (funcs || []).map((f: any) => {
          const m = (metas || []).find((x: any) => x.funcionario_id === f.id) || {};
          return {
            funcionario_id: f.id,
            user_id: m.user_id || f.user_id || null,
            nome: f.nome,
            meta_mensal: Number(m.meta_mensal || 0),
            percentual: Number(m.percentual || 0),
            valor_fixo_comissao: Number(m.valor_fixo_comissao || 0),
            tipo_comissao: (m.tipo_comissao || "percentual") as any,
          };
        });
        setVendedores(lista);

        const userIds = lista.map((v) => v.user_id).filter(Boolean) as string[];
        if (userIds.length === 0) {
          setPedidos([]);
          return;
        }

        const { data: peds } = await (supabase as any)
          .from("pedidos")
          .select("id, created_at, vendedor_id, valor_total, status, tipo_venda, forma_pagamento, clientes(nome)")
          .in("vendedor_id", userIds)
          .gte("created_at", range.inicioISOFull)
          .lte("created_at", range.fimISOFull)
          .order("created_at", { ascending: false })
          .limit(1000);

        setPedidos(
          ((peds || []) as any[]).map((p) => ({
            id: p.id,
            created_at: p.created_at,
            vendedor_id: p.vendedor_id,
            valor_total: Number(p.valor_total || 0),
            status: p.status,
            tipo_venda: p.tipo_venda,
            forma_pagamento: p.forma_pagamento,
            cliente_nome: p.clientes?.nome || null,
          })),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [unidadeAtual?.id, range.inicioISOFull, range.fimISOFull]);

  const resumo: ResumoVendedor[] = useMemo(() => {
    return vendedores
      .filter((v) => v.user_id)
      .map((v) => {
        const peds = pedidos.filter(
          (p) => p.vendedor_id === v.user_id && STATUS_VALIDOS.includes((p.status || "").toLowerCase()),
        );
        const qtd = peds.length;
        const total = peds.reduce((s, p) => s + p.valor_total, 0);
        const ticket = qtd > 0 ? total / qtd : 0;
        const metaPct = v.meta_mensal > 0 ? (total / v.meta_mensal) * 100 : 0;
        const comissao =
          v.tipo_comissao === "valor_fixo"
            ? qtd * v.valor_fixo_comissao
            : total * (v.percentual / 100);
        return {
          user_id: v.user_id!,
          nome: v.nome,
          qtd,
          total,
          ticket,
          meta: v.meta_mensal,
          metaPct,
          comissao,
          tipoComissao: v.tipo_comissao,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [vendedores, pedidos]);

  const kpis = useMemo(() => {
    const ativos = resumo.filter((r) => r.qtd > 0).length;
    const totalVendas = resumo.reduce((s, r) => s + r.total, 0);
    const qtdTotal = resumo.reduce((s, r) => s + r.qtd, 0);
    const ticket = qtdTotal > 0 ? totalVendas / qtdTotal : 0;
    const comissao = resumo.reduce((s, r) => s + r.comissao, 0);
    return { ativos, totalVendas, ticket, comissao, qtdTotal };
  }, [resumo]);

  const top5 = resumo.slice(0, 5);
  const maxTop = top5[0]?.total || 1;

  const nomePorUserId = useMemo(() => {
    const m = new Map<string, string>();
    vendedores.forEach((v) => v.user_id && m.set(v.user_id, v.nome));
    return m;
  }, [vendedores]);

  const historicoFiltrado = useMemo(() => {
    return pedidos.filter((p) => {
      if (vendedorFiltro !== "todos" && p.vendedor_id !== vendedorFiltro) return false;
      if (tipoFiltro !== "todos" && (p.tipo_venda || "").toLowerCase() !== tipoFiltro) return false;
      if (statusFiltro !== "todos" && (p.status || "").toLowerCase() !== statusFiltro) return false;
      return true;
    });
  }, [pedidos, vendedorFiltro, tipoFiltro, statusFiltro]);

  const exportCSV = () => {
    const headers = ["Data", "Vendedor", "Cliente", "Tipo", "Pagamento", "Status", "Valor"];
    const linhas = historicoFiltrado.map((p) => [
      format(new Date(p.created_at), "dd/MM/yyyy HH:mm"),
      nomePorUserId.get(p.vendedor_id || "") || "—",
      p.cliente_nome || "Balcão",
      p.tipo_venda || "",
      p.forma_pagamento || "",
      p.status,
      p.valor_total.toFixed(2).replace(".", ","),
    ]);
    const csv = [headers, ...linhas].map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendedores_${range.inicioISO}_${range.fimISO}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatBRL = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <Header title="Vendedores" subtitle="Desempenho, metas e comissão por vendedor" />
      <div className="p-4 md:p-6 space-y-6">
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" /> Período: {range.label}
        </p>


      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Vendedores ativos
            </p>
            <p className="text-2xl font-bold">{kpis.ativos}<span className="text-sm text-muted-foreground"> / {vendedores.length}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Vendas no período
            </p>
            <p className="text-2xl font-bold">{formatBRL(kpis.totalVendas)}</p>
            <p className="text-[10px] text-muted-foreground">{kpis.qtdTotal} pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Ticket médio
            </p>
            <p className="text-2xl font-bold">{formatBRL(kpis.ticket)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Award className="h-3 w-3" /> Comissão estimada
            </p>
            <p className="text-2xl font-bold text-emerald-600">{formatBRL(kpis.comissao)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ranking / pódio */}
      {top5.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-yellow-500" /> Ranking do período
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {top5.map((r, i) => {
              const pctBar = (r.total / maxTop) * 100;
              const podio = i < 3;
              const cores = ["text-yellow-500", "text-gray-400", "text-amber-700"];
              return (
                <div key={r.user_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      {podio ? (
                        <Medal className={`h-4 w-4 ${cores[i]}`} />
                      ) : (
                        <span className="w-4 text-center text-xs text-muted-foreground">{i + 1}º</span>
                      )}
                      {r.nome}
                      {i === 0 && (
                        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-xs ml-1">
                          Vendedor do mês
                        </Badge>
                      )}
                    </span>
                    <span className="font-bold">{formatBRL(r.total)}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pctBar}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Resumo por vendedor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo por vendedor</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando…</p>
          ) : resumo.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum vendedor cadastrado. Habilite em Cadastros &gt; Funcionários.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ticket méd.</TableHead>
                  <TableHead className="w-[180px]">Meta</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumo.map((r) => {
                  const st = statusMeta(r.metaPct);
                  return (
                    <TableRow
                      key={r.user_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setVendedorFiltro(r.user_id)}
                    >
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="text-right">{r.qtd}</TableCell>
                      <TableCell className="text-right">{formatBRL(r.total)}</TableCell>
                      <TableCell className="text-right">{formatBRL(r.ticket)}</TableCell>
                      <TableCell>
                        {r.meta > 0 ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{formatBRL(r.meta)}</span>
                              <span>{r.metaPct.toFixed(0)}%</span>
                            </div>
                            <Progress value={Math.min(100, r.metaPct)} className="h-1.5" />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatBRL(r.comissao)}
                      </TableCell>
                      <TableCell>
                        {r.meta > 0 ? (
                          <Badge variant={st.variant} className={st.className}>
                            {st.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Sem meta</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Histórico de vendas</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Select value={vendedorFiltro} onValueChange={setVendedorFiltro}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos vendedores</SelectItem>
                {resumo.map((r) => (
                  <SelectItem key={r.user_id} value={r.user_id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos tipos</SelectItem>
                <SelectItem value="balcao">Balcão</SelectItem>
                <SelectItem value="entrega">Entrega</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={historicoFiltrado.length === 0}>
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {historicoFiltrado.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma venda no período com os filtros atuais.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicoFiltrado.slice(0, 200).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(p.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {nomePorUserId.get(p.vendedor_id || "") || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{p.cliente_nome || "Balcão"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {p.tipo_venda || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{p.forma_pagamento || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatBRL(p.valor_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {historicoFiltrado.length > 200 && (
            <p className="text-xs text-center text-muted-foreground py-2">
              Mostrando 200 de {historicoFiltrado.length} — refine os filtros ou exporte CSV.
            </p>
          )}
        </CardContent>
      </Card>
      </div>
    </>

  );
}

import { MainLayout } from "@/components/layout/MainLayout";

export default function Vendedores() {
  return (
    <MainLayout>
      <PeriodoProvider>
        <VendedoresInner />
      </PeriodoProvider>
    </MainLayout>
  );
}
