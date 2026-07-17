import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Upload, Loader2, Zap, Search, Link2, CheckCircle2, Unlink, X } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

function parseOFX(text: string) {
  const out: Array<{ data: string; descricao: string; valor: number; tipo: string }> = [];
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const block = m[1];
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
      const x = block.match(r);
      return x ? x[1].trim() : "";
    };
    const raw = get("DTPOSTED");
    const data = `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`;
    const valor = parseFloat(get("TRNAMT").replace(",", "."));
    const descricao = get("MEMO") || get("NAME") || "Sem descrição";
    out.push({ data, descricao, valor, tipo: valor >= 0 ? "credito" : "debito" });
  }
  return out;
}

interface Props {
  contaId: string;
  unidadeId: string | null;
  accentColor: string;
}

type StatusFilter = "todos" | "conciliados" | "pendentes";

export default function OfxPanel({ contaId, unidadeId, accentColor }: Props) {
  const qc = useQueryClient();
  const ofxRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [autoReconciling, setAutoReconciling] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [vinculoOpen, setVinculoOpen] = useState(false);
  const [selectedLanc, setSelectedLanc] = useState<any>(null);
  const [pedidoSearch, setPedidoSearch] = useState("");

  const { data: extrato = [], isLoading } = useQuery({
    queryKey: ["extrato_ofx_conta", contaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extrato_bancario")
        .select("*, pedidos(id, valor_total, cliente_id, created_at, clientes(nome))")
        .eq("conta_bancaria_id", contaId)
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos_ofx_conta", unidadeId],
    queryFn: async () => {
      let q = supabase
        .from("pedidos")
        .select("id, valor_total, created_at, status, forma_pagamento, cliente_id, clientes(nome)")
        .order("created_at", { ascending: false });
      if (unidadeId) q = q.eq("unidade_id", unidadeId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const linkedPedidoIds = useMemo(
    () => new Set(extrato.filter((e: any) => e.pedido_id).map((e: any) => e.pedido_id)),
    [extrato],
  );

  const filtered = useMemo(() => {
    if (statusFilter === "conciliados") return extrato.filter((e: any) => e.conciliado);
    if (statusFilter === "pendentes") return extrato.filter((e: any) => !e.conciliado);
    return extrato;
  }, [extrato, statusFilter]);

  // Compute running balance (asc by data)
  const rows = useMemo(() => {
    let saldo = 0;
    return filtered.map((e: any) => {
      const v = Number(e.valor) || 0;
      saldo += v;
      return { ...e, _saldo: saldo, _entrada: v > 0 ? v : 0, _saida: v < 0 ? Math.abs(v) : 0 };
    });
  }, [filtered]);

  const total = extrato.length;
  const conciliados = extrato.filter((e: any) => e.conciliado).length;
  const pendentes = total - conciliados;
  const saldoExtrato = extrato.reduce((acc: number, e: any) => acc + Number(e.valor), 0);

  const allSelected = rows.length > 0 && rows.every((r: any) => selected.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r: any) => r.id)));
  };
  const toggleOne = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const txs = parseOFX(text);
      if (txs.length === 0) { toast.error("Nenhum lançamento encontrado no arquivo."); return; }
      const rowsToInsert = txs.map((t) => ({
        data: t.data,
        descricao: t.descricao,
        valor: t.valor,
        tipo: t.tipo,
        conciliado: false,
        conta_bancaria_id: contaId,
        ...(unidadeId ? { unidade_id: unidadeId } : {}),
      }));
      const { error } = await supabase.from("extrato_bancario").insert(rowsToInsert);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["extrato_ofx_conta", contaId] });
      toast.success(`${txs.length} lançamentos importados!`);
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err.message || "erro desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  const conciliarLote = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("extrato_bancario").update({ conciliado: true }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extrato_ofx_conta", contaId] });
      toast.success("Lançamentos conciliados!");
      setSelected(new Set());
    },
  });

  const desvincularLote = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("extrato_bancario")
        .update({ conciliado: false, pedido_id: null })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extrato_ofx_conta", contaId] });
      toast.success("Vínculo removido.");
      setSelected(new Set());
    },
  });

  const vincularPedido = useMutation({
    mutationFn: async ({ lancamentoId, pedidoId }: { lancamentoId: string; pedidoId: string }) => {
      const { error } = await supabase
        .from("extrato_bancario")
        .update({ pedido_id: pedidoId, conciliado: true })
        .eq("id", lancamentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["extrato_ofx_conta", contaId] });
      setVinculoOpen(false);
      setSelectedLanc(null);
      toast.success("Vinculado ao pedido!");
    },
  });

  const handleAutoReconcile = async () => {
    const pending = extrato.filter((e: any) => !e.conciliado && !e.pedido_id);
    if (pending.length === 0) { toast.info("Nenhum lançamento pendente."); return; }
    setAutoReconciling(true);
    try {
      let matched = 0;
      const available = pedidos.filter((p: any) => !linkedPedidoIds.has(p.id));
      const used = new Set<string>();
      for (const l of pending) {
        const valor = Math.abs(Number(l.valor));
        const lDate = parseLocalDate(l.data);
        const idx = available.findIndex((p: any) => {
          if (used.has(p.id)) return false;
          const pv = Math.abs(Number(p.valor_total));
          const diff = Math.abs(valor - pv);
          const tol = pv * 0.01;
          const days = Math.abs((lDate.getTime() - new Date(p.created_at).getTime()) / 86400000);
          return diff <= tol && days <= 3;
        });
        if (idx >= 0) {
          await supabase.from("extrato_bancario")
            .update({ pedido_id: available[idx].id, conciliado: true }).eq("id", l.id);
          used.add(available[idx].id);
          matched++;
        }
      }
      qc.invalidateQueries({ queryKey: ["extrato_ofx_conta", contaId] });
      if (matched > 0) toast.success(`${matched} lançamento(s) conciliado(s).`);
      else toast.info("Nenhuma correspondência (±1% valor, ±3 dias).");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setAutoReconciling(false);
    }
  };

  const filteredPedidos = useMemo(() => {
    return pedidos
      .filter((p: any) => !linkedPedidoIds.has(p.id))
      .filter((p: any) => {
        if (!pedidoSearch) return true;
        const s = pedidoSearch.toLowerCase();
        return ((p.clientes as any)?.nome?.toLowerCase() || "").includes(s)
          || p.id.toLowerCase().includes(s)
          || String(p.valor_total).includes(s);
      });
  }, [pedidos, linkedPedidoIds, pedidoSearch]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  const chip = (key: StatusFilter, label: string, count: number) => (
    <button
      key={key}
      onClick={() => setStatusFilter(key)}
      className={cn(
        "px-3 py-1.5 text-xs rounded-full border transition-colors",
        statusFilter === key
          ? "text-white border-transparent"
          : "bg-muted/40 hover:bg-muted text-foreground border-border",
      )}
      style={statusFilter === key ? { background: accentColor } : undefined}
    >
      {label} <span className="opacity-80">({count})</span>
    </button>
  );

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <input
          type="file" ref={ofxRef} accept=".ofx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }}
        />

        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {chip("todos", "Todos", total)}
            {chip("conciliados", "Conciliados", conciliados)}
            {chip("pendentes", "Pendentes", pendentes)}
            <span className="text-xs text-muted-foreground ml-2">
              Saldo do extrato: <strong>R$ {fmt(saldoExtrato)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => ofxRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar OFX
            </Button>
            <Button size="sm" className="gap-2" onClick={handleAutoReconcile}
              disabled={autoReconciling || pendentes === 0}
              style={{ background: accentColor, color: "white" }}>
              {autoReconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Reconciliar Auto
            </Button>
          </div>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg border bg-muted/30">
            <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1"
                onClick={() => conciliarLote.mutate(Array.from(selected))}
                disabled={conciliarLote.isPending}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Conciliar selecionados
              </Button>
              <Button size="sm" variant="ghost" className="gap-1 text-destructive"
                onClick={() => desvincularLote.mutate(Array.from(selected))}
                disabled={desvincularLote.isPending}>
                <Unlink className="h-3.5 w-3.5" /> Desfazer
              </Button>
              <Button size="sm" variant="ghost" className="gap-1" onClick={() => setSelected(new Set())}>
                <X className="h-3.5 w-3.5" /> Limpar
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 text-sm">
            Nenhum lançamento. Importe um arquivo OFX para começar.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Saída</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.id} className={selected.has(r.id) ? "bg-muted/40" : ""}>
                    <TableCell>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {parseLocalDate(r.data).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.descricao}
                      {r.pedido_id && (
                        <span className="block text-[11px] text-muted-foreground">
                          <Link2 className="h-3 w-3 inline mr-1" />
                          {(r.pedidos as any)?.clientes?.nome || r.pedido_id.slice(0, 8)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-success font-medium">
                      {r._entrada > 0 ? `R$ ${fmt(r._entrada)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-destructive font-medium">
                      {r._saida > 0 ? `R$ ${fmt(r._saida)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      R$ {fmt(r._saldo)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.conciliado ? "default" : "secondary"} className="text-[10px]">
                        {r.conciliado ? "Conciliado" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!r.conciliado && (
                        <Button size="sm" variant="ghost" className="gap-1 h-7"
                          onClick={() => { setSelectedLanc(r); setPedidoSearch(""); setVinculoOpen(true); }}>
                          <Search className="h-3 w-3" /> Vincular
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Vincular dialog */}
        <Dialog open={vinculoOpen} onOpenChange={setVinculoOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Vincular a Pedido</DialogTitle>
              <DialogDescription>
                {selectedLanc && (
                  <span>
                    {selectedLanc.descricao} — R$ {fmt(Math.abs(Number(selectedLanc.valor)))} em{" "}
                    {parseLocalDate(selectedLanc.data).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente, ID ou valor..."
                value={pedidoSearch} onChange={(e) => setPedidoSearch(e.target.value)} />
            </div>
            <div className="overflow-auto flex-1 -mx-6 px-6">
              {filteredPedidos.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">Nenhum pedido disponível.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPedidos.slice(0, 50).map((p: any) => {
                      const match = selectedLanc
                        ? Math.abs(Math.abs(Number(selectedLanc.valor)) - Number(p.valor_total)) < Number(p.valor_total) * 0.01
                        : false;
                      return (
                        <TableRow key={p.id} className={match ? "bg-success dark:bg-success/20" : ""}>
                          <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-sm font-medium">{(p.clientes as any)?.nome || "—"}</TableCell>
                          <TableCell className="text-sm font-medium">
                            R$ {fmt(Number(p.valor_total))}
                            {match && <Badge variant="default" className="ml-2 text-[10px]">Match</Badge>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" className="gap-1"
                              onClick={() => vincularPedido.mutate({ lancamentoId: selectedLanc.id, pedidoId: p.id })}
                              disabled={vincularPedido.isPending}>
                              <Link2 className="h-3 w-3" /> Vincular
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
