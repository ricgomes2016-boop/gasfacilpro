import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Banknote, CheckCircle2, Clock, Loader2, RefreshCw, AlertCircle, Circle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getBrasiliaDateString } from "@/lib/utils";
import { criarMovimentacaoBancaria } from "@/services/paymentRoutingService";

interface RecebiveisRow {
  id: string;
  descricao: string;
  valor: number;
  valor_taxa: number;
  valor_liquido: number | null;
  taxa_percentual: number;
  vencimento: string;
  status: string; // pendente | recebida
  forma_pagamento: string | null;
  operadora_id: string | null;
  operadora_nome: string;
  pedido_id: string | null;
  parcela_atual: number;
  total_parcelas: number;
  // Conciliação match
  conciliacao_status: "nao_conciliado" | "confirmado" | "divergente";
  conciliacao_id: string | null;
  conciliacao_valor_recebido: number | null;
  conciliacao_data_deposito: string | null;
}

// Visual stage indicator
function PipelineStage({ 
  label, 
  done, 
  active,
  variant = "default",
}: { 
  label: string; 
  done: boolean; 
  active?: boolean;
  variant?: "default" | "warning" | "destructive";
}) {
  const icon = done 
    ? <CheckCircle2 className="h-3.5 w-3.5" /> 
    : active 
      ? <Clock className="h-3.5 w-3.5 animate-pulse" /> 
      : <Circle className="h-3.5 w-3.5" />;
  
  const colors = done 
    ? "text-emerald-600 dark:text-emerald-400" 
    : variant === "destructive"
      ? "text-destructive"
      : variant === "warning"
        ? "text-amber-500"
        : "text-muted-foreground/50";

  return (
    <div className={`flex items-center gap-1 text-[11px] font-medium ${colors}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function PipelineIndicator({ conciliado, liquidado, divergente }: { 
  conciliado: boolean; 
  liquidado: boolean;
  divergente: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <PipelineStage 
        label="Conciliado" 
        done={conciliado} 
        active={!conciliado && !divergente}
        variant={divergente ? "destructive" : "default"}
      />
      <div className={`w-4 h-px mx-0.5 ${conciliado ? "bg-emerald-400" : "bg-muted-foreground/20"}`} />
      <PipelineStage 
        label="Liquidado" 
        done={liquidado} 
        active={conciliado && !liquidado}
      />
    </div>
  );
}

export function RecebiveisPipeline({ operadoraId }: { operadoraId?: string } = {}) {
  const { unidadeAtual } = useUnidade();
  const [rows, setRows] = useState<RecebiveisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processando, setProcessando] = useState(false);
  const [filtroEtapa, setFiltroEtapa] = useState("todos");
  const hoje = getBrasiliaDateString();

  // Conciliar dialog
  const [conciliarItem, setConciliarItem] = useState<RecebiveisRow | null>(null);
  const [valorRecebido, setValorRecebido] = useState("");
  const [dataDeposito, setDataDeposito] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const formas = ["cartao_debito", "cartao_credito", "credito", "debito", "pix_maquininha"];
    
    // Fetch receivables
    let qRecebiveis = supabase
      .from("contas_receber")
      .select("*, operadoras_cartao(nome)")
      .in("forma_pagamento", formas)
      .order("vencimento", { ascending: true });
    if (unidadeAtual?.id) qRecebiveis = qRecebiveis.eq("unidade_id", unidadeAtual.id);

    // Fetch conciliação records
    let qConf = supabase
      .from("conferencia_cartao")
      .select("id, pedido_id, status, valor_liquido_recebido, data_deposito_real, valor_bruto")
      .order("data_venda", { ascending: false });
    if (unidadeAtual?.id) qConf = qConf.eq("unidade_id", unidadeAtual.id);

    const [resRec, resConf] = await Promise.all([qRecebiveis, qConf]);
    
    if (resRec.error) { toast.error("Erro ao carregar recebíveis"); console.error(resRec.error); }
    
    // Map conciliação by pedido_id for quick lookup
    const confByPedido: Record<string, any> = {};
    (resConf.data || []).forEach((c: any) => {
      if (c.pedido_id) confByPedido[c.pedido_id] = c;
    });

    const mapped: RecebiveisRow[] = (resRec.data || []).map((d: any) => {
      const conf = d.pedido_id ? confByPedido[d.pedido_id] : null;
      return {
        id: d.id,
        descricao: d.descricao,
        valor: d.valor,
        valor_taxa: d.valor_taxa || 0,
        valor_liquido: d.valor_liquido,
        taxa_percentual: d.taxa_percentual || 0,
        vencimento: d.vencimento,
        status: d.status,
        forma_pagamento: d.forma_pagamento,
        operadora_id: d.operadora_id,
        operadora_nome: d.operadoras_cartao?.nome || "—",
        pedido_id: d.pedido_id,
        parcela_atual: d.parcela_atual || 1,
        total_parcelas: d.total_parcelas || 1,
        conciliacao_status: conf 
          ? (conf.status === "confirmado" ? "confirmado" : conf.status === "divergente" ? "divergente" : "nao_conciliado")
          : "nao_conciliado",
        conciliacao_id: conf?.id || null,
        conciliacao_valor_recebido: conf?.valor_liquido_recebido || null,
        conciliacao_data_deposito: conf?.data_deposito_real || null,
      };
    });

    setRows(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [unidadeAtual]);

  // Derived
  const pendentes = rows.filter(r => r.status === "pendente");
  const vencidos = pendentes.filter(r => r.vencimento < hoje);
  const totalBruto = pendentes.reduce((s, r) => s + Number(r.valor), 0);
  const totalTaxas = pendentes.reduce((s, r) => s + Number(r.valor_taxa), 0);
  const totalLiquido = totalBruto - totalTaxas;

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (operadoraId && r.operadora_id !== operadoraId) return false;
      if (filtroEtapa === "nao_conciliado") return r.conciliacao_status === "nao_conciliado" && r.status === "pendente";
      if (filtroEtapa === "conciliado") return r.conciliacao_status === "confirmado" && r.status === "pendente";
      if (filtroEtapa === "liquidado") return r.status === "recebida";
      if (filtroEtapa === "divergente") return r.conciliacao_status === "divergente";
      if (filtroEtapa === "vencido") return r.status === "pendente" && r.vencimento < hoje;
      return true;
    });
  }, [rows, filtroEtapa, hoje, operadoraId]);

  const getFormaLabel = (f: string | null) => {
    if (!f) return "—";
    const map: Record<string, string> = {
      cartao_debito: "Débito", debito: "Débito",
      cartao_credito: "Crédito", credito: "Crédito",
      pix_maquininha: "PIX Maq.",
    };
    return map[f] || f;
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  // --- CONCILIAR ---
  const handleConciliar = async (row: RecebiveisRow) => {
    setConciliarItem(row);
    const liq = Number(row.valor) - Number(row.valor_taxa || 0);
    setValorRecebido(liq.toFixed(2));
    setDataDeposito(row.vencimento);
  };

  const confirmarConciliacao = async () => {
    if (!conciliarItem) return;
    const valor = parseFloat(valorRecebido);
    if (isNaN(valor) || valor <= 0) { toast.error("Informe o valor recebido"); return; }

    const liqEsperado = Number(conciliarItem.valor) - Number(conciliarItem.valor_taxa || 0);
    const diff = Math.abs(valor - liqEsperado);
    const status = diff < 0.02 ? "confirmado" : "divergente";

    if (conciliarItem.conciliacao_id) {
      // Update existing conferência record
      const { error } = await supabase.from("conferencia_cartao").update({
        valor_liquido_recebido: valor,
        data_deposito_real: dataDeposito || null,
        status,
      }).eq("id", conciliarItem.conciliacao_id);
      if (error) { toast.error("Erro ao conciliar"); return; }
    } else {
      // Create conferência record linked to this receivable
      const { error } = await supabase.from("conferencia_cartao").insert({
        tipo: conciliarItem.forma_pagamento?.includes("debito") ? "debito" 
          : conciliarItem.forma_pagamento?.includes("pix") ? "pix_maquininha" : "credito",
        valor_bruto: conciliarItem.valor,
        taxa_percentual: conciliarItem.taxa_percentual,
        valor_taxa: conciliarItem.valor_taxa,
        valor_liquido_esperado: liqEsperado,
        valor_liquido_recebido: valor,
        data_venda: conciliarItem.vencimento,
        data_deposito_real: dataDeposito || null,
        status,
        operadora_id: conciliarItem.operadora_id,
        pedido_id: conciliarItem.pedido_id,
        unidade_id: unidadeAtual?.id || null,
        parcelas: conciliarItem.total_parcelas,
      });
      if (error) { toast.error("Erro ao conciliar"); console.error(error); return; }
    }

    toast.success(status === "confirmado" ? "Conciliado com sucesso!" : "Divergência registrada!");
    setConciliarItem(null);
    setValorRecebido("");
    setDataDeposito("");
    fetchData();
  };

  // --- LIQUIDAR ---
  const handleLiquidar = async (row: RecebiveisRow) => {
    const valorLiq = Number(row.valor) - Number(row.valor_taxa || 0);
    const { error } = await supabase.from("contas_receber")
      .update({ status: "recebida", valor_liquido: valorLiq })
      .eq("id", row.id);
    if (error) { toast.error("Erro ao liquidar"); return; }

    try {
      const { data: conta } = await supabase.from("contas_bancarias")
        .select("id").eq("ativo", true)
        .eq("unidade_id", unidadeAtual?.id || "")
        .limit(1).maybeSingle();
      if (conta) {
        const { data: { user } } = await supabase.auth.getUser();
        await criarMovimentacaoBancaria({
          contaBancariaId: conta.id,
          valor: valorLiq > 0 ? valorLiq : Number(row.valor),
          descricao: `Liquidação Cartão: ${row.descricao}`,
          categoria: "liquidacao_cartao",
          unidadeId: unidadeAtual?.id,
          userId: user?.id,
          pedidoId: row.pedido_id || undefined,
        });
      }
    } catch (e) { console.error(e); }
    toast.success("Liquidado e creditado no banco!");
    fetchData();
  };

  // --- LOTE ---
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const visiblePendentes = filtered.filter(r => r.status === "pendente");

  const toggleSelectAll = () => {
    if (selectedIds.size === visiblePendentes.length && visiblePendentes.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visiblePendentes.map(r => r.id)));
    }
  };

  const handleLoteConciliar = async () => {
    if (selectedIds.size === 0) return;
    setProcessando(true);
    let ok = 0;
    for (const id of selectedIds) {
      const row = rows.find(r => r.id === id);
      if (!row || row.conciliacao_status === "confirmado") continue;
      const liq = Number(row.valor) - Number(row.valor_taxa || 0);
      try {
        if (row.conciliacao_id) {
          await supabase.from("conferencia_cartao").update({
            valor_liquido_recebido: liq,
            data_deposito_real: row.vencimento,
            status: "confirmado",
          }).eq("id", row.conciliacao_id);
        } else {
          await supabase.from("conferencia_cartao").insert({
            tipo: row.forma_pagamento?.includes("debito") ? "debito" 
              : row.forma_pagamento?.includes("pix") ? "pix_maquininha" : "credito",
            valor_bruto: row.valor,
            taxa_percentual: row.taxa_percentual,
            valor_taxa: row.valor_taxa,
            valor_liquido_esperado: liq,
            valor_liquido_recebido: liq,
            data_venda: row.vencimento,
            data_deposito_real: row.vencimento,
            status: "confirmado",
            operadora_id: row.operadora_id,
            pedido_id: row.pedido_id,
            unidade_id: unidadeAtual?.id || null,
            parcelas: row.total_parcelas,
          });
        }
        ok++;
      } catch {}
    }
    setSelectedIds(new Set());
    setProcessando(false);
    if (ok > 0) toast.success(`${ok} conciliado(s) em lote!`);
    fetchData();
  };

  const handleLoteLiquidar = async () => {
    if (selectedIds.size === 0) return;
    setProcessando(true);
    let ok = 0;
    for (const id of selectedIds) {
      const row = rows.find(r => r.id === id);
      if (!row || row.status !== "pendente") continue;
      try {
        await handleLiquidar(row);
        ok++;
      } catch {}
    }
    setSelectedIds(new Set());
    setProcessando(false);
  };

  // KPI counts
  const countNaoConciliado = rows.filter(r => r.conciliacao_status === "nao_conciliado" && r.status === "pendente").length;
  const countConciliado = rows.filter(r => r.conciliacao_status === "confirmado" && r.status === "pendente").length;
  const countLiquidado = rows.filter(r => r.status === "recebida").length;
  const countDivergente = rows.filter(r => r.conciliacao_status === "divergente").length;

  return (
    <div className="space-y-4">
      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">A Receber (Bruto)</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-primary">{fmt(totalBruto)}</p>
            <p className="text-xs text-muted-foreground">{pendentes.length} título(s)</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Taxas Previstas</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-destructive">{fmt(totalTaxas)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Líquido Previsto</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalLiquido)}</p></CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-1 hover:ring-primary/30" onClick={() => setFiltroEtapa(filtroEtapa === "conciliado" ? "todos" : "conciliado")}>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Conciliados</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{countConciliado}</p>
            <p className="text-xs text-muted-foreground">aguardando liquidação</p></CardContent>
        </Card>
        <Card className={`cursor-pointer hover:ring-1 hover:ring-primary/30 ${vencidos.length > 0 ? "border-destructive/50" : ""}`} onClick={() => setFiltroEtapa(filtroEtapa === "vencido" ? "todos" : "vencido")}>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Vencidos</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-destructive">{vencidos.length}</p>
            <p className="text-xs text-muted-foreground">{fmt(vencidos.reduce((s, r) => s + Number(r.valor), 0))}</p></CardContent>
        </Card>
      </div>

      {/* Filters & actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as Etapas</SelectItem>
              <SelectItem value="nao_conciliado">⏳ Não Conciliados ({countNaoConciliado})</SelectItem>
              <SelectItem value="conciliado">✅ Conciliados ({countConciliado})</SelectItem>
              <SelectItem value="liquidado">💰 Liquidados ({countLiquidado})</SelectItem>
              <SelectItem value="divergente">⚠️ Divergentes ({countDivergente})</SelectItem>
              <SelectItem value="vencido">🔴 Vencidos ({vencidos.length})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={handleLoteConciliar} disabled={processando} className="gap-1.5">
                {processando ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Conciliar {selectedIds.size}
              </Button>
              <Button size="sm" onClick={handleLoteLiquidar} disabled={processando} className="gap-1.5">
                {processando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Banknote className="h-3 w-3" />}
                Liquidar {selectedIds.size}
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 sm:p-4">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="Nenhum recebível encontrado"
              description="Ajuste o filtro de etapa ou aguarde novas vendas por cartão e PIX maquininha."
              action={{ label: "Atualizar", onClick: fetchData, icon: RefreshCw }}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === visiblePendentes.length && visiblePendentes.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Operadora</TableHead>
                    <TableHead className="hidden md:table-cell">Descrição</TableHead>
                    <TableHead>Bruto</TableHead>
                    <TableHead className="hidden sm:table-cell">Líquido</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Etapas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 100).map(r => {
                    const liq = Number(r.valor) - Number(r.valor_taxa || 0);
                    const vencido = r.status === "pendente" && r.vencimento < hoje;
                    const isConciliado = r.conciliacao_status === "confirmado";
                    const isLiquidado = r.status === "recebida";
                    const isDivergente = r.conciliacao_status === "divergente";

                    return (
                      <TableRow key={r.id} className={vencido ? "bg-destructive/5" : isLiquidado ? "bg-emerald-500/5" : ""}>
                        <TableCell>
                          {!isLiquidado ? (
                            <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} />
                          ) : <span className="w-4" />}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{getFormaLabel(r.forma_pagamento)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{r.operadora_nome}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">{r.descricao}</TableCell>
                        <TableCell className="font-medium">{fmt(Number(r.valor))}</TableCell>
                        <TableCell className="hidden sm:table-cell font-bold text-emerald-600 dark:text-emerald-400">{fmt(liq)}</TableCell>
                        <TableCell className={`text-sm whitespace-nowrap ${vencido ? "text-destructive font-medium" : ""}`}>
                          {format(new Date(r.vencimento + "T12:00:00"), "dd/MM/yy")}
                          {vencido && <AlertCircle className="h-3 w-3 inline ml-1 text-destructive" />}
                        </TableCell>
                        <TableCell>
                          <PipelineIndicator 
                            conciliado={isConciliado} 
                            liquidado={isLiquidado}
                            divergente={isDivergente}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isConciliado && !isLiquidado && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleConciliar(r)}>
                                <CheckCircle2 className="h-3 w-3" />
                                <span className="hidden lg:inline">Conciliar</span>
                              </Button>
                            )}
                            {isDivergente && !isLiquidado && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-destructive/50 text-destructive" onClick={() => handleConciliar(r)}>
                                <AlertCircle className="h-3 w-3" />
                                <span className="hidden lg:inline">Revisar</span>
                              </Button>
                            )}
                            {!isLiquidado && (
                              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleLiquidar(r)}>
                                <Banknote className="h-3 w-3" />
                                <span className="hidden lg:inline">Liquidar</span>
                              </Button>
                            )}
                            {isLiquidado && (
                              <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-600/30 text-[10px]">
                                Finalizado
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conciliar Dialog */}
      <Dialog open={!!conciliarItem} onOpenChange={(open) => !open && setConciliarItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conciliar Recebível</DialogTitle>
          </DialogHeader>
          {conciliarItem && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                <p><strong>Descrição:</strong> {conciliarItem.descricao}</p>
                <p><strong>Valor Bruto:</strong> {fmt(Number(conciliarItem.valor))}</p>
                <p><strong>Taxa:</strong> {Number(conciliarItem.taxa_percentual).toFixed(1)}% ({fmt(Number(conciliarItem.valor_taxa))})</p>
                <p><strong>Líquido Esperado:</strong> <span className="font-bold text-emerald-600">{fmt(Number(conciliarItem.valor) - Number(conciliarItem.valor_taxa))}</span></p>
              </div>
              <div className="space-y-2">
                <Label>Valor Recebido (líquido real)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={valorRecebido} 
                  onChange={e => setValorRecebido(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Data do Depósito Real</Label>
                <Input 
                  type="date" 
                  value={dataDeposito} 
                  onChange={e => setDataDeposito(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConciliarItem(null)}>Cancelar</Button>
            <Button onClick={confirmarConciliacao} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />Confirmar Conciliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
