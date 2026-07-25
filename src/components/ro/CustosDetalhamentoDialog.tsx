import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpDown, Search, FileDown, Info, CheckCircle2, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

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
  incluido: boolean;
  motivo: string;
}

const isTransferenciaInterna = (categoria?: string | null, descricao?: string | null) => {
  const text = `${categoria || ""} ${descricao || ""}`.toLowerCase();
  return text.includes("depósito banc") || text.includes("deposito banc") || text.includes("transferência caixa") || text.includes("transferencia caixa");
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CustosDetalhamentoDialog({ open, onClose, unidadeId, mes, ano, mesLabel }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<"data_desc" | "data_asc" | "valor_desc">("data_desc");
  const [mostrarExcluidos, setMostrarExcluidos] = useState(false);

  const abrirNaOrigem = (linha: Linha) => {
    const rawId = linha.id.replace(/^cp-|^mc-/, "");
    const path = linha.origem === "contas_pagar"
      ? `/financeiro/pagar?highlight=${rawId}`
      : `/caixa/despesas?highlight=${rawId}`;
    onClose();
    navigate(path);
  };


  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const inicio = startOfMonth(new Date(ano, mes, 1)).toISOString();
      const fim = endOfMonth(new Date(ano, mes, 1)).toISOString();
      const inicioDate = format(new Date(ano, mes, 1), "yyyy-MM-dd");
      const fimDate = format(endOfMonth(new Date(ano, mes, 1)), "yyyy-MM-dd");

      // Contas a pagar: busca TODAS do mês (por vencimento) para explicar exclusões
      let cpQ = supabase.from("contas_pagar")
        .select("id, valor, categoria, descricao, vencimento, data_pagamento, status")
        .gte("vencimento", inicioDate).lte("vencimento", fimDate);
      if (unidadeId) cpQ = cpQ.eq("unidade_id", unidadeId);

      // Movimentações de caixa: busca TODAS as saídas do mês para explicar exclusões
      let mcQ = supabase.from("movimentacoes_caixa")
        .select("id, valor, categoria, descricao, created_at, status, compra_id, pedido_id, tipo")
        .eq("tipo", "saida")
        .gte("created_at", inicio).lte("created_at", fim);
      if (unidadeId) mcQ = mcQ.or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);

      const [cpRes, mcRes] = await Promise.all([cpQ, mcQ]);

      const cp: Linha[] = (cpRes.data || []).map((r: any) => {
        const incluido = r.status === "pago";
        return {
          id: `cp-${r.id}`,
          origem: "contas_pagar",
          data: r.data_pagamento || r.vencimento,
          categoria: r.categoria || "Sem categoria",
          descricao: r.descricao || "—",
          valor: Number(r.valor) || 0,
          incluido,
          motivo: incluido
            ? "Contas a Pagar · status=pago · vencimento dentro do mês"
            : `Excluído: status="${r.status}" (não é 'pago')`,
        };
      });

      const mc: Linha[] = (mcRes.data || []).map((r: any) => {
        const motivos: string[] = [];
        let incluido = true;
        if (r.status === "rejeitada") { incluido = false; motivos.push("status=rejeitada"); }
        if (r.pedido_id) { incluido = false; motivos.push("vinculada a pedido (pedido_id ≠ null)"); }
        if (isTransferenciaInterna(r.categoria, r.descricao)) {
          incluido = false;
          motivos.push("transferência interna (depósito/transferência caixa)");
        }
        const isCompra = !!r.compra_id;
        return {
          id: `mc-${r.id}`,
          origem: "movimentacoes_caixa",
          data: r.created_at,
          categoria: isCompra
            ? "Custo das mercadorias (compra paga no caixa)"
            : (r.categoria || "Sem categoria"),
          descricao: r.descricao || (isCompra ? "Pagamento de compra pelo caixa" : "—"),
          valor: Number(r.valor) || 0,
          incluido,
          motivo: incluido
            ? (isCompra
              ? "Caixa · tipo=saida · pagamento de compra (custo de mercadoria)"
              : "Caixa · tipo=saida · sem vínculo compra/pedido · dentro do mês")
            : `Excluído: ${motivos.join(" · ")}`,
        };
      });


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
    if (!mostrarExcluidos) arr = arr.filter(l => l.incluido);
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
  }, [linhas, filtroCategoria, filtroOrigem, busca, ordem, mostrarExcluidos]);

  const totalIncluido = useMemo(
    () => linhas.filter(l => l.incluido).reduce((s, l) => s + l.valor, 0),
    [linhas],
  );
  const qtdIncluidos = linhas.filter(l => l.incluido).length;
  const qtdExcluidos = linhas.length - qtdIncluidos;

  const exportCsv = () => {
    const rows = [
      ["Data", "Origem", "Status", "Categoria", "Descrição", "Valor", "Motivo"],
      ...filtradas.map(l => [
        l.data ? format(new Date(l.data), "dd/MM/yyyy") : "",
        l.origem === "contas_pagar" ? "Contas a Pagar" : "Caixa",
        l.incluido ? "Incluído" : "Excluído",
        l.categoria,
        l.descricao.replace(/[\r\n;]/g, " "),
        l.valor.toFixed(2).replace(".", ","),
        l.motivo.replace(/[\r\n;]/g, " "),
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
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalhamento de Custos e Despesas</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{mesLabel} / {ano}</span>
            <span>·</span>
            <span className="text-success font-medium">{qtdIncluidos} incluído(s)</span>
            {qtdExcluidos > 0 && <><span>·</span><span className="text-muted-foreground">{qtdExcluidos} excluído(s)</span></>}
            <span>·</span>
            <span>Total incluído: <span className="font-semibold text-destructive">R$ {fmt(totalIncluido)}</span></span>
          </DialogDescription>
        </DialogHeader>

        {/* Regras de composição */}
        <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold text-xs mb-1.5">
            <Info className="h-3.5 w-3.5 text-primary" /> Regras de composição
          </div>
          <ul className="space-y-0.5 text-muted-foreground">
            <li><strong>Contas a Pagar:</strong> inclui apenas <code>status = "pago"</code> com <code>vencimento</code> dentro do mês selecionado.</li>
            <li><strong>Caixa:</strong> inclui <code>tipo = "saida"</code>, <code>status ≠ "rejeitada"</code>, sem vínculo com compra (<code>compra_id IS NULL</code>) nem pedido (<code>pedido_id IS NULL</code>), criada no mês.</li>
            <li><strong>Excluído sempre:</strong> transferências internas (descrição contendo "depósito bancário" ou "transferência caixa") para evitar duplicidade.</li>
          </ul>
        </div>

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
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={mostrarExcluidos} onCheckedChange={setMostrarExcluidos} />
            Mostrar excluídos
          </label>
          <Button variant="outline" size="sm" className="h-9" onClick={exportCsv}>
            <FileDown className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>

        <ScrollArea className="flex-1 border rounded-md">
          <TooltipProvider delayDuration={100}>
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[130px]">Origem</TableHead>
                  <TableHead className="w-[160px]">Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[220px]">Motivo</TableHead>
                  <TableHead className="text-right w-[120px]">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtradas.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</TableCell></TableRow>
                ) : filtradas.map(l => (
                  <TableRow
                    key={l.id}
                    onClick={() => abrirNaOrigem(l)}
                    className={`cursor-pointer transition hover:bg-[#064e3b]/8 focus-visible:bg-[#064e3b]/10 focus-visible:outline-none ${l.incluido ? "" : "bg-muted/30 opacity-70"}`}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirNaOrigem(l); } }}
                    aria-label={`Abrir ${l.descricao} na origem - R$ ${fmt(l.valor)}`}
                  >
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {l.incluido
                            ? <CheckCircle2 className="h-4 w-4 text-success" />
                            : <XCircle className="h-4 w-4 text-muted-foreground" />}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs text-xs">{l.motivo}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{l.data ? format(new Date(l.data), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={l.origem === "contas_pagar" ? "default" : "secondary"} className="text-[10px]">
                        {l.origem === "contas_pagar" ? "Contas a Pagar" : "Caixa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{l.categoria}</TableCell>
                    <TableCell className="text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        {l.descricao}
                        <ExternalLink className="h-3 w-3 text-muted-foreground/60" aria-hidden="true" />
                      </span>
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground leading-tight">{l.motivo}</TableCell>
                    <TableCell className={`text-right text-xs tabular-nums font-semibold ${l.incluido ? "" : "line-through text-muted-foreground"}`}>R$ {fmt(l.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

}
