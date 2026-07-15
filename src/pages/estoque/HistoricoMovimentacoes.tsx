import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, ArrowUpCircle, ArrowDownCircle, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { EstoqueKpiCard } from "@/components/estoque/EstoqueKpiCard";
import { EstoquePageHeader } from "@/components/estoque/EstoquePageHeader";

export default function HistoricoMovimentacoes() {
  const { unidadeAtual } = useUnidade();
  const [dataInicio, setDataInicio] = useState<Date>(subDays(new Date(), 7));
  const [dataFim, setDataFim] = useState<Date>(new Date());
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");

  const { data: movimentacoes = [], isLoading, refetch } = useQuery({
    queryKey: ["historico-movimentacoes", unidadeAtual?.id, dataInicio.toISOString(), dataFim.toISOString(), filtroTipo],
    queryFn: async () => {
      let q = supabase
        .from("movimentacoes_estoque")
        .select("id, produto_id, tipo, quantidade, observacoes, created_at, produtos:produto_id(nome, categoria)")
        .gte("created_at", startOfDay(dataInicio).toISOString())
        .lte("created_at", endOfDay(dataFim).toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      if (filtroTipo !== "todos") q = q.eq("tipo", filtroTipo);

      const { data } = await q;
      return (data || []) as any[];
    },
  });

  const filtradas = movimentacoes.filter((m: any) => {
    if (!filtroBusca) return true;
    const nome = m.produtos?.nome || "";
    const obs = m.observacoes || "";
    const termo = filtroBusca.toLowerCase();
    return nome.toLowerCase().includes(termo) || obs.toLowerCase().includes(termo);
  });

  const totais = filtradas.reduce(
    (acc: any, m: any) => {
      if (m.tipo === "entrada") acc.entradas += m.quantidade;
      else if (m.tipo === "saida") acc.saidas += m.quantidade;
      else if (m.tipo === "avaria") acc.avarias += m.quantidade;
      return acc;
    },
    { entradas: 0, saidas: 0, avarias: 0 }
  );

  const tipoIcon = (tipo: string) => {
    if (tipo === "entrada") return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
    if (tipo === "saida") return <ArrowDownCircle className="h-4 w-4 text-orange-600" />;
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  };

  const tipoBadge = (tipo: string) => {
    if (tipo === "entrada") return <Badge className="bg-green-600 text-white">Entrada</Badge>;
    if (tipo === "saida") return <Badge className="bg-orange-600 text-white">Saída</Badge>;
    return <Badge variant="destructive">Avaria</Badge>;
  };

  return (
    <MainLayout>
      <Header title="Histórico de Movimentações" subtitle="Auditoria completa de entradas, saídas e avarias" />
      <div className="p-3 sm:p-6 space-y-4">
        {/* Filtros */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">De</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal text-sm")}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {format(dataInicio, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataInicio} onSelect={(d) => d && setDataInicio(d)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Até</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal text-sm")}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {format(dataFim, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataFim} onSelect={(d) => d && setDataFim(d)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="avaria">Avaria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 flex-1 min-w-[180px]">
                <Label className="text-xs">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Produto ou observação..." value={filtroBusca} onChange={(e) => setFiltroBusca(e.target.value)} />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Totais */}
        <div className="grid gap-3 grid-cols-3">
          <Card><CardContent className="flex items-center gap-3 p-3">
            <ArrowUpCircle className="h-5 w-5 text-green-600" />
            <div><p className="text-xs text-muted-foreground">Entradas</p><p className="text-xl font-bold text-green-600">+{totais.entradas}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-3">
            <ArrowDownCircle className="h-5 w-5 text-orange-600" />
            <div><p className="text-xs text-muted-foreground">Saídas</p><p className="text-xl font-bold text-orange-600">-{totais.saidas}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div><p className="text-xs text-muted-foreground">Avarias</p><p className="text-xl font-bold text-destructive">-{totais.avarias}</p></div>
          </CardContent></Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{filtradas.length} movimentações encontradas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
           {/* Mobile cards */}
            <div className="space-y-3 md:hidden px-3 pb-3">
              {filtradas.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhuma movimentação encontrada</p>
              ) : filtradas.map((m: any) => (
                <div key={m.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {tipoIcon(m.tipo)}
                      <p className="text-sm font-medium truncate">{m.produtos?.nome || "—"}</p>
                    </div>
                    <span className={`font-bold text-sm ${m.tipo === "entrada" ? "text-green-600" : "text-destructive"}`}>
                      {m.tipo === "entrada" ? "+" : "-"}{m.quantidade}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    {tipoBadge(m.tipo)}
                    <span className="text-[10px] text-muted-foreground">{format(new Date(m.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                  </div>
                  {m.observacoes && <p className="text-xs text-muted-foreground mt-1 truncate">{m.observacoes}</p>}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="overflow-x-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Tipo</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma movimentação encontrada</TableCell></TableRow>
                  ) : filtradas.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(m.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{m.produtos?.nome || "—"}</TableCell>
                      <TableCell className="text-center">{tipoBadge(m.tipo)}</TableCell>
                      <TableCell className="text-center font-bold">
                        <span className={m.tipo === "entrada" ? "text-green-600" : "text-destructive"}>
                          {m.tipo === "entrada" ? "+" : "-"}{m.quantidade}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">{m.observacoes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
