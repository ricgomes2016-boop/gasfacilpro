import { useState, useRef, useMemo } from "react";
import { parseLocalDate } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Link2, Loader2, Zap, Search, Unlink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

// --- Parsers ---

function parseOFX(text: string): Array<{ data: string; descricao: string; valor: number; tipo: string }> {
  const transactions: Array<{ data: string; descricao: string; valor: number; tipo: string }> = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = stmtTrnRegex.exec(text)) !== null) {
    const block = match[1];
    const getValue = (tag: string) => {
      const r = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
      const m = block.match(r);
      return m ? m[1].trim() : "";
    };
    const rawDate = getValue("DTPOSTED");
    const year = rawDate.substring(0, 4);
    const month = rawDate.substring(4, 6);
    const day = rawDate.substring(6, 8);
    const data = `${year}-${month}-${day}`;
    const valor = parseFloat(getValue("TRNAMT").replace(",", "."));
    const descricao = getValue("MEMO") || getValue("NAME") || "Sem descrição";
    transactions.push({ data, descricao, valor, tipo: valor >= 0 ? "credito" : "debito" });
  }
  return transactions;
}

function parseCSV(text: string): Array<{ data: string; descricao: string; valor: number; tipo: string }> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  const sep = header.includes(";") ? ";" : ",";
  const cols = header.split(sep).map((c) => c.trim().replace(/"/g, ""));
  const dataIdx = cols.findIndex((c) => /data|date/.test(c));
  const descIdx = cols.findIndex((c) => /descri|memo|hist|name/.test(c));
  const valorIdx = cols.findIndex((c) => /valor|value|amount/.test(c));

  if (dataIdx === -1 || valorIdx === -1) {
    toast.error("CSV inválido: colunas 'data' e 'valor' são obrigatórias.");
    return [];
  }

  return lines.slice(1).map((line) => {
    const parts = line.split(sep).map((c) => c.trim().replace(/"/g, ""));
    const rawDate = parts[dataIdx] || "";
    let data = rawDate;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
      const [d, m, y] = rawDate.split("/");
      data = `${y}-${m}-${d}`;
    }
    const valor = parseFloat((parts[valorIdx] || "0").replace(/\./g, "").replace(",", "."));
    const descricao = (descIdx >= 0 ? parts[descIdx] : "") || "Sem descrição";
    return { data, descricao, valor, tipo: valor >= 0 ? "credito" : "debito" };
  }).filter((t) => !isNaN(t.valor));
}

// --- Component ---

interface ContaBancariaSimple {
  id: string;
  nome: string;
  banco: string;
  tipo: string;
  saldo_atual: number;
}

export default function Conciliacao({ embedded, contas = [] }: { embedded?: boolean; contas?: ContaBancariaSimple[] } = {}) {
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const ofxInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [autoReconciling, setAutoReconciling] = useState(false);
  const [vinculoDialogOpen, setVinculoDialogOpen] = useState(false);
  const [selectedLancamento, setSelectedLancamento] = useState<any>(null);
  const [pedidoSearch, setPedidoSearch] = useState("");
  const [contaImportId, setContaImportId] = useState<string>("");

  // Filter state for extrato by conta
  const [filtroContaId, setFiltroContaId] = useState<string>("todas");

  // Fetch extrato
  const { data: extrato = [], isLoading } = useQuery({
    queryKey: ["extrato_bancario", unidadeAtual?.id, filtroContaId],
    queryFn: async () => {
      let query = supabase
        .from("extrato_bancario")
        .select("*, pedidos(id, valor_total, cliente_id, created_at, clientes(nome)), contas_bancarias(id,nome,banco,tipo)")
        .order("data", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      if (filtroContaId && filtroContaId !== "todas") query = query.eq("conta_bancaria_id", filtroContaId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch pedidos for matching
  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos_conciliacao", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("pedidos")
        .select("id, valor_total, created_at, status, forma_pagamento, cliente_id, clientes(nome)")
        .order("created_at", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch movimentações bancárias reais para cruzamento OFX ↔ Extrato Real
  const { data: movimentacoesBancarias = [] } = useQuery({
    queryKey: ["movs_bancarias_conciliacao", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("movimentacoes_bancarias")
        .select("id, data, tipo, categoria, descricao, valor")
        .order("data", { ascending: false });
      if (unidadeAtual?.id) query = query.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Already linked pedido_ids
  const linkedPedidoIds = useMemo(() => {
    return new Set(extrato.filter((e: any) => e.pedido_id).map((e: any) => e.pedido_id));
  }, [extrato]);

  // Conciliar manual (mark as conciliado without pedido link)
  const conciliarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("extrato_bancario")
        .update({ conciliado: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extrato_bancario"] });
      toast.success("Lançamento conciliado com sucesso!");
    },
  });

  // Vincular lançamento a pedido
  const vincularMutation = useMutation({
    mutationFn: async ({ lancamentoId, pedidoId }: { lancamentoId: string; pedidoId: string }) => {
      const { error } = await supabase
        .from("extrato_bancario")
        .update({ pedido_id: pedidoId, conciliado: true })
        .eq("id", lancamentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extrato_bancario"] });
      setVinculoDialogOpen(false);
      setSelectedLancamento(null);
      toast.success("Lançamento vinculado ao pedido com sucesso!");
    },
  });

  // Desvincular
  const desvincularMutation = useMutation({
    mutationFn: async (lancamentoId: string) => {
      const { error } = await supabase
        .from("extrato_bancario")
        .update({ pedido_id: null, conciliado: false })
        .eq("id", lancamentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["extrato_bancario"] });
      toast.success("Vínculo removido.");
    },
  });

  // Auto-reconciliation logic — matches OFX entries against pedidos AND movimentações bancárias reais
  const handleAutoReconcile = async () => {
    const pendingLancamentos = extrato.filter((e: any) => !e.conciliado && !e.pedido_id);
    if (pendingLancamentos.length === 0) {
      toast.info("Nenhum lançamento pendente para reconciliar.");
      return;
    }

    setAutoReconciling(true);
    let matchedPedidos = 0;
    let matchedExtrato = 0;

    try {
      // 1. Match against pedidos
      const availablePedidos = pedidos.filter((p: any) => !linkedPedidoIds.has(p.id));
      const pedidoUpdates: Array<{ lancamentoId: string; pedidoId: string }> = [];
      const matchedLancIds = new Set<string>();

      for (const lancamento of pendingLancamentos) {
        const valor = Math.abs(Number(lancamento.valor));
        const lancDate = parseLocalDate(lancamento.data);

        const matchIdx = availablePedidos.findIndex((p: any) => {
          if (pedidoUpdates.some((u) => u.pedidoId === p.id)) return false;
          const pedidoValor = Math.abs(Number(p.valor_total));
          const pedidoDate = new Date(p.created_at);
          const valorDiff = Math.abs(valor - pedidoValor);
          const tolerance = pedidoValor * 0.01;
          const daysDiff = Math.abs((lancDate.getTime() - pedidoDate.getTime()) / (1000 * 60 * 60 * 24));
          return valorDiff <= tolerance && daysDiff <= 3;
        });

        if (matchIdx >= 0) {
          pedidoUpdates.push({ lancamentoId: lancamento.id, pedidoId: availablePedidos[matchIdx].id });
          matchedLancIds.add(lancamento.id);
          matchedPedidos++;
        }
      }

      // 2. Match remaining against movimentações bancárias reais (por valor e data)
      const remainingLancs = pendingLancamentos.filter((l: any) => !matchedLancIds.has(l.id));
      const usedMovIds = new Set<string>();

      for (const lancamento of remainingLancs) {
        const valor = Math.abs(Number(lancamento.valor));
        const lancDate = parseLocalDate(lancamento.data);

        const match = movimentacoesBancarias.find((m: any) => {
          if (usedMovIds.has(m.id)) return false;
          const movValor = Math.abs(Number(m.valor));
          const movDate = parseLocalDate(m.data);
          const valorDiff = Math.abs(valor - movValor);
          const tolerance = movValor * 0.02; // 2% tolerance
          const daysDiff = Math.abs((lancDate.getTime() - movDate.getTime()) / (1000 * 60 * 60 * 24));
          return valorDiff <= tolerance && daysDiff <= 2;
        });

        if (match) {
          usedMovIds.add(match.id);
          matchedLancIds.add(lancamento.id);
          matchedExtrato++;
          // Mark as conciliado (matched with extrato real)
          await supabase.from("extrato_bancario").update({ conciliado: true }).eq("id", lancamento.id);
        }
      }

      // Execute pedido updates
      for (const update of pedidoUpdates) {
        await supabase.from("extrato_bancario").update({ pedido_id: update.pedidoId, conciliado: true }).eq("id", update.lancamentoId);
      }

      queryClient.invalidateQueries({ queryKey: ["extrato_bancario"] });
      const total = matchedPedidos + matchedExtrato;

      if (total > 0) {
        const msgs = [];
        if (matchedPedidos > 0) msgs.push(`${matchedPedidos} com pedidos`);
        if (matchedExtrato > 0) msgs.push(`${matchedExtrato} com extrato real`);
        toast.success(`${total} lançamento(s) conciliado(s): ${msgs.join(", ")}!`);
      } else {
        toast.info("Nenhuma correspondência encontrada (valor ±1-2%, data ±2-3 dias).");
      }
    } catch (err: any) {
      toast.error("Erro na reconciliação: " + (err.message || "erro desconhecido"));
    } finally {
      setAutoReconciling(false);
    }
  };

  // File import handler
  const handleFileImport = async (file: File, type: "ofx" | "csv") => {
    if (contas.length > 0 && !contaImportId) {
      toast.error("Selecione a conta bancária para importar o extrato.");
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const transactions = type === "ofx" ? parseOFX(text) : parseCSV(text);
      if (transactions.length === 0) {
        toast.error("Nenhum lançamento encontrado no arquivo.");
        return;
      }
      const rows = transactions.map((t) => ({
        data: t.data,
        descricao: t.descricao,
        valor: t.valor,
        tipo: t.tipo,
        conciliado: false,
        ...(unidadeAtual?.id ? { unidade_id: unidadeAtual.id } : {}),
        ...(contaImportId ? { conta_bancaria_id: contaImportId } : {}),
      }));
      const { error } = await supabase.from("extrato_bancario").insert(rows);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["extrato_bancario"] });
      const contaNome = contas.find(c => c.id === contaImportId)?.nome || "";
      toast.success(`${transactions.length} lançamentos importados${contaNome ? ` para ${contaNome}` : ""}!`);
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err.message || "erro desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  // Stats
  const conciliados = extrato.filter((e: any) => e.conciliado).length;
  const pendentes = extrato.filter((e: any) => !e.conciliado).length;
  const saldoExtrato = extrato.reduce((acc: number, e: any) => acc + Number(e.valor), 0);

  // Filtered pedidos for manual linking dialog
  const filteredPedidos = useMemo(() => {
    return pedidos
      .filter((p: any) => !linkedPedidoIds.has(p.id))
      .filter((p: any) => {
        if (!pedidoSearch) return true;
        const search = pedidoSearch.toLowerCase();
        const nome = (p.clientes as any)?.nome?.toLowerCase() || "";
        const id = p.id.toLowerCase();
        const valor = String(p.valor_total);
        return nome.includes(search) || id.includes(search) || valor.includes(search);
      });
  }, [pedidos, linkedPedidoIds, pedidoSearch]);

  const content = (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <input type="file" ref={ofxInputRef} accept=".ofx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileImport(f, "ofx"); e.target.value = ""; }}
        />
        <input type="file" ref={csvInputRef} accept=".csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileImport(f, "csv"); e.target.value = ""; }}
        />

        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-3 flex-wrap">
            {contas.length > 0 && (
              <div className="min-w-[220px]">
                <Label className="text-xs font-medium">Conta para Importação *</Label>
                <Select value={contaImportId} onValueChange={setContaImportId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {contas.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} ({c.banco}) — {c.tipo === "corrente" ? "CC" : c.tipo === "poupanca" ? "Poup." : c.tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="outline" className="gap-2" onClick={() => ofxInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar OFX
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => csvInputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Importar CSV
            </Button>
            <Button className="gap-2" onClick={handleAutoReconcile} disabled={autoReconciling || pendentes === 0}>
              {autoReconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Reconciliar Automaticamente
            </Button>
          </div>
          {contas.length > 0 && (
            <div className="min-w-[220px] max-w-xs">
              <Label className="text-xs font-medium">Filtrar Extrato por Conta</Label>
              <Select value={filtroContaId} onValueChange={setFiltroContaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as contas</SelectItem>
                  {contas.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} ({c.banco})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Lançamentos</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{extrato.length}</div>
              <p className="text-xs text-muted-foreground">Total importados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Conciliados</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{conciliados}</div>
              <p className="text-xs text-muted-foreground">
                {extrato.length > 0 ? `${Math.round(conciliados / extrato.length * 100)}%` : "0%"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendentes}</div>
              <p className="text-xs text-muted-foreground">Aguardando vínculo</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saldo Extrato</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                R$ {saldoExtrato.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Saldo calculado</p>
            </CardContent>
          </Card>
        </div>

        {/* Extrato table */}
        <Card>
          <CardHeader>
            <CardTitle>Extrato Importado</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : extrato.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum lançamento importado ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Pedido Vinculado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extrato.map((lancamento: any) => (
                    <TableRow key={lancamento.id}>
                      <TableCell>{parseLocalDate(lancamento.data).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="font-medium">{lancamento.descricao}</TableCell>
                      <TableCell>
                        <Badge variant={lancamento.tipo === "credito" ? "default" : "secondary"}>
                          {lancamento.tipo === "credito" ? "Crédito" : "Débito"}
                        </Badge>
                      </TableCell>
                      <TableCell className={`font-medium ${Number(lancamento.valor) > 0 ? "text-green-600" : "text-red-600"}`}>
                        R$ {Math.abs(Number(lancamento.valor)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {lancamento.pedido_id ? (
                          <div className="flex items-center gap-1">
                            <Link2 className="h-3 w-3 text-green-600" />
                            <span className="text-xs text-muted-foreground">
                              {(lancamento.pedidos as any)?.clientes?.nome || lancamento.pedido_id.slice(0, 8)}
                            </span>
                            <span className="text-xs font-medium">
                              R$ {Number((lancamento.pedidos as any)?.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={lancamento.conciliado ? "default" : "secondary"}>
                          {lancamento.conciliado ? "Conciliado" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {!lancamento.conciliado && (
                            <>
                              <Button size="sm" variant="outline" className="gap-1"
                                onClick={() => { setSelectedLancamento(lancamento); setPedidoSearch(""); setVinculoDialogOpen(true); }}>
                                <Search className="h-3 w-3" />
                                Vincular
                              </Button>
                              <Button size="sm" className="gap-1"
                                onClick={() => conciliarMutation.mutate(lancamento.id)}
                                disabled={conciliarMutation.isPending}>
                                <CheckCircle2 className="h-3 w-3" />
                                OK
                              </Button>
                            </>
                          )}
                          {lancamento.conciliado && lancamento.pedido_id && (
                            <Button size="sm" variant="ghost" className="gap-1 text-destructive"
                              onClick={() => desvincularMutation.mutate(lancamento.id)}>
                              <Unlink className="h-3 w-3" />
                              Desfazer
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Manual linking dialog */}
        <Dialog open={vinculoDialogOpen} onOpenChange={setVinculoDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Vincular a Pedido</DialogTitle>
              <DialogDescription>
                {selectedLancamento && (
                  <span>
                    Lançamento: <strong>{selectedLancamento.descricao}</strong> — R${" "}
                    {Math.abs(Number(selectedLancamento.valor)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em{" "}
                    {parseLocalDate(selectedLancamento.data).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, ID ou valor..."
                value={pedidoSearch}
                onChange={(e) => setPedidoSearch(e.target.value)}
              />
            </div>
            <div className="overflow-auto flex-1 -mx-6 px-6">
              {filteredPedidos.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum pedido disponível para vincular.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPedidos.slice(0, 50).map((pedido: any) => {
                      const valorMatch = selectedLancamento
                        ? Math.abs(Math.abs(Number(selectedLancamento.valor)) - Number(pedido.valor_total)) < Number(pedido.valor_total) * 0.01
                        : false;
                      return (
                        <TableRow key={pedido.id} className={valorMatch ? "bg-green-50 dark:bg-green-950/20" : ""}>
                          <TableCell>{new Date(pedido.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="font-medium">{(pedido.clientes as any)?.nome || "—"}</TableCell>
                          <TableCell className="font-medium">
                            R$ {Number(pedido.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            {valorMatch && <Badge variant="default" className="ml-2 text-[10px]">Match</Badge>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{pedido.status}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{pedido.forma_pagamento || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" className="gap-1"
                              onClick={() => vincularMutation.mutate({ lancamentoId: selectedLancamento.id, pedidoId: pedido.id })}
                              disabled={vincularMutation.isPending}>
                              <Link2 className="h-3 w-3" />
                              Vincular
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
    </div>
  );

  if (embedded) return content;
  return (
    <MainLayout>
      <Header title="Conciliação Bancária" subtitle="Importe e concilie extratos" />
      {content}
    </MainLayout>
  );
}
