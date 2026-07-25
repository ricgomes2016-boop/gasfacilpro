import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Search, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onClose: () => void;
  unidadeId?: string;
  mes: number;
  ano: number;
  mesLabel: string;
}

interface Linha {
  id: string;
  origem: "contas_pagar" | "movimentacoes_caixa";
  data: string;
  categoria: string;
  descricao: string;
  valor: number;
}

const isTransferenciaInterna = (categoria?: string | null, descricao?: string | null) => {
  const text = `${categoria || ""} ${descricao || ""}`.toLowerCase();
  return text.includes("depósito banc") || text.includes("deposito banc") || text.includes("transferência caixa") || text.includes("transferencia caixa");
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CustosDetalhamentoDialog({ open, onClose, unidadeId, mes, ano, mesLabel }: Props) {
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<"data_desc" | "data_asc" | "valor_desc">("data_desc");

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const inicio = startOfMonth(new Date(ano, mes, 1)).toISOString();
      const fim = endOfMonth(new Date(ano, mes, 1)).toISOString();
      const inicioDate = format(new Date(ano, mes, 1), "yyyy-MM-dd");
      const fimDate = format(endOfMonth(new Date(ano, mes, 1)), "yyyy-MM-dd");

      let cpQ = supabase.from("contas_pagar")
        .select("id, valor, categoria, descricao, vencimento, data_pagamento, status")
        .eq("status", "pago")
        .gte("vencimento", inicioDate).lte("vencimento", fimDate);
      if (unidadeId) cpQ = cpQ.eq("unidade_id", unidadeId);

      let mcQ = supabase.from("movimentacoes_caixa")
        .select("id, valor, categoria, descricao, created_at, status, compra_id, pedido_id, tipo")
        .eq("tipo", "saida")
        .neq("status", "rejeitada")
        .is("compra_id", null)
        .is("pedido_id", null)
        .gte("created_at", inicio).lte("created_at", fim);
      if (unidadeId) mcQ = mcQ.or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);

      const [cpRes, mcRes] = await Promise.all([cpQ, mcQ]);

      const cp: Linha[] = (cpRes.data || []).map((r: any) => ({
        id: `cp-${r.id}`,
        origem: "contas_pagar",
        data: r.data_pagamento || r.vencimento,
        categoria: r.categoria || "Sem categoria",
        descricao: r.descricao || "—",
        valor: Number(r.valor) || 0,
      }));
      const mc: Linha[] = (mcRes.data || [])
        .filter((r: any) => !isTransferenciaInterna(r.categoria, r.descricao))
        .map((r: any) => ({
          id: `mc-${r.id}`,
          origem: "movimentacoes_caixa",
          data: r.created_at,
          categoria: r.categoria || "Sem categoria",
          descricao: r.descricao || "—",
          valor: Number(r.valor) || 0,
        }));

      setLinhas([...cp, ...mc]);
      setLoading(false);
    })();
  }, [open, unidadeId, mes, ano]);

  const categorias = useMemo(() => {
    const s = new Set(linhas.map(l => l.categoria));
    return Array.from(s).sort();
  }, [linhas]);

  const filtradas = useMemo(() => {
    let arr = linhas;
    if (filtroCategoria !== "todas") arr = arr.filter(l => l.categoria === filtroCategoria);
    if (filtroOrigem !== "todas") arr = arr.filter(l => l.origem === filtroOrigem);
    if (busca.trim()) {
      const b = busca.toLowerCase();
      arr = arr.filter(l => l.descricao.toLowerCase().includes(b) || l.categoria.toLowerCase().includes(b));
    }
    const sorted = [...arr];
    if (ordem === "data_desc") sorted.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    if (ordem === "data_asc") sorted.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    if (ordem === "valor_desc") sorted.sort((a, b) => b.valor - a.valor);
    return sorted;
  }, [linhas, filtroCategoria, filtroOrigem, busca, ordem]);

  const total = filtradas.reduce((s, l) => s + l.valor, 0);

  const exportCsv = () => {
    const rows = [
      ["Data", "Origem", "Categoria", "Descrição", "Valor"],
      ...filtradas.map(l => [
        format(new Date(l.data), "dd/MM/yyyy"),
        l.origem === "contas_pagar" ? "Contas a Pagar" : "Caixa",
        l.categoria,
        l.descricao.replace(/[\r\n;]/g, " "),
        l.valor.toFixed(2).replace(".", ","),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `custos-despesas-${mesLabel}-${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalhamento de Custos e Despesas</DialogTitle>
          <DialogDescription>
            {mesLabel} / {ano} — {filtradas.length} lançamento(s) · Total <span className="font-semibold text-destructive">R$ {fmt(total)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar descrição ou categoria..." className="pl-8 h-9" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas origens</SelectItem>
              <SelectItem value="contas_pagar">Contas a Pagar</SelectItem>
              <SelectItem value="movimentacoes_caixa">Caixa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ordem} onValueChange={(v: any) => setOrdem(v)}>
            <SelectTrigger className="h-9 w-[160px]"><ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="data_desc">Data (recente)</SelectItem>
              <SelectItem value="data_asc">Data (antiga)</SelectItem>
              <SelectItem value="valor_desc">Maior valor</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={exportCsv}>
            <FileDown className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>

        <ScrollArea className="flex-1 border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead className="w-[130px]">Origem</TableHead>
                <TableHead className="w-[160px]">Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right w-[120px]">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtradas.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</TableCell></TableRow>
              ) : filtradas.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs tabular-nums">{l.data ? format(new Date(l.data), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={l.origem === "contas_pagar" ? "default" : "secondary"} className="text-[10px]">
                      {l.origem === "contas_pagar" ? "Contas a Pagar" : "Caixa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{l.categoria}</TableCell>
                  <TableCell className="text-xs">{l.descricao}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums font-semibold">R$ {fmt(l.valor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
