import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, isSameDay, parseISO, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContaEvento {
  id: string;
  tipo: "pagar" | "receber";
  descricao: string;
  valor: number;
  vencimento: Date;
  status: string;
  entidade: string;
}

export default function CalendarioFinanceiro() {
  const { unidadeAtual } = useUnidade();
  const [mesAtual, setMesAtual] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState<Date | undefined>(new Date());

  const inicio = format(startOfMonth(mesAtual), "yyyy-MM-dd");
  const fim = format(endOfMonth(mesAtual), "yyyy-MM-dd");

  const { data: contasPagar = [] } = useQuery({
    queryKey: ["cal-pagar", unidadeAtual?.id, inicio, fim],
    queryFn: async () => {
      let q = supabase.from("contas_pagar").select("id, descricao, valor, vencimento, status, fornecedor")
        .gte("vencimento", inicio).lte("vencimento", fim);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return (data || []).map(c => ({
        id: c.id, tipo: "pagar" as const, descricao: c.descricao, valor: Number(c.valor),
        vencimento: parseISO(c.vencimento), status: c.status, entidade: c.fornecedor,
      }));
    },
  });

  const { data: contasReceber = [] } = useQuery({
    queryKey: ["cal-receber", unidadeAtual?.id, inicio, fim],
    queryFn: async () => {
      let q = supabase.from("contas_receber").select("id, descricao, valor, vencimento, status, cliente")
        .gte("vencimento", inicio).lte("vencimento", fim);
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data } = await q;
      return (data || []).map(c => ({
        id: c.id, tipo: "receber" as const, descricao: c.descricao, valor: Number(c.valor),
        vencimento: parseISO(c.vencimento), status: c.status, entidade: c.cliente,
      }));
    },
  });

  const eventos: ContaEvento[] = useMemo(() => [...contasPagar, ...contasReceber], [contasPagar, contasReceber]);

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, ContaEvento[]>();
    eventos.forEach(e => {
      const key = format(e.vencimento, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [eventos]);

  const eventosDoDia = useMemo(() => {
    if (!diaSelecionado) return [];
    return eventos.filter(e => isSameDay(e.vencimento, diaSelecionado));
  }, [diaSelecionado, eventos]);

  const totalPagarMes = contasPagar.filter(c => c.status === "pendente").reduce((s, c) => s + c.valor, 0);
  const totalReceberMes = contasReceber.filter(c => c.status === "pendente").reduce((s, c) => s + c.valor, 0);

  return (
    <MainLayout>
      <Header title="Calendário Financeiro" subtitle="Visão mensal de contas a pagar e receber" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">A Pagar (pendente)</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">R$ {totalPagarMes.toLocaleString("pt-BR")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">A Receber (pendente)</CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">R$ {totalReceberMes.toLocaleString("pt-BR")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saldo Projetado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", totalReceberMes - totalPagarMes >= 0 ? "text-success" : "text-destructive")}>
                R$ {(totalReceberMes - totalPagarMes).toLocaleString("pt-BR")}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendário */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setMesAtual(subMonths(mesAtual, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <CardTitle className="capitalize">{format(mesAtual, "MMMM yyyy", { locale: ptBR })}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setMesAtual(addMonths(mesAtual, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={diaSelecionado}
                onSelect={setDiaSelecionado}
                month={mesAtual}
                onMonthChange={setMesAtual}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto w-full")}
                modifiers={{
                  temPagar: contasPagar.map(c => c.vencimento),
                  temReceber: contasReceber.map(c => c.vencimento),
                }}
                modifiersClassNames={{
                  temPagar: "border-2 border-destructive rounded-md",
                  temReceber: "border-2 border-green-500 rounded-md",
                }}
              />
              <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 border-2 border-destructive rounded-sm" /> A pagar</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 border-2 border-green-500 rounded-sm" /> A receber</span>
              </div>
            </CardContent>
          </Card>

          {/* Detalhe do dia */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {diaSelecionado ? format(diaSelecionado, "dd 'de' MMMM", { locale: ptBR }) : "Selecione um dia"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eventosDoDia.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conta neste dia</p>
              ) : (
                <div className="space-y-3">
                  {eventosDoDia.map(e => (
                    <div key={e.id} className="flex items-start justify-between border-b pb-2 last:border-0">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          {e.tipo === "pagar"
                            ? <ArrowUpCircle className="h-3 w-3 text-destructive" />
                            : <ArrowDownCircle className="h-3 w-3 text-success" />}
                          <span className="text-sm font-medium">{e.descricao}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{e.entidade}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-bold", e.tipo === "pagar" ? "text-destructive" : "text-success")}>
                          R$ {e.valor.toLocaleString("pt-BR")}
                        </p>
                        <Badge variant={e.status === "pendente" ? "secondary" : "default"} className="text-[10px]">
                          {e.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
