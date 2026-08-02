import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Flame, Cylinder, Package, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUnidade } from "@/contexts/UnidadeContext";
import { FluxoProdutoDialog } from "@/components/estoque/FluxoProdutoDialog";

interface Produto {
  id: string;
  nome: string;
  tipo_botijao: string | null;
  estoque: number;
  preco: number;
  categoria: string | null;
  botijao_par_id: string | null;
}

interface MovimentacaoPorProduto {
  vendas: number;
  compras: number;
  entradas_manuais: number;
  saidas_manuais: number;
  avarias: number;
}

interface EstoqueDiaTableProps {
  produtos: Produto[];
  movimentacoes: Record<string, MovimentacaoPorProduto>;
  dataDia: Date;
  isLoading: boolean;
  onRefresh?: () => void;
  saldosIniciais?: Record<string, number>;
  periodo?: { inicio: Date; fim: Date };
}

interface LinhaEstoque {
  produtoId: string;
  nome: string;
  tipoEstoque: string;
  estoqueAtual: number;
  vendas: number;
  compras: number;
  entradas: number;
  saidas: number;
  entradasManuais: number;
  saidasManuais: number;
  avarias: number;
  inicial: number;
  inicialManual: boolean;
  total: number;
}

function calcularLinha(
  produto: Produto,
  mov: MovimentacaoPorProduto,
  tipoBotijao: string | null,
  saldoSalvo?: number
): LinhaEstoque {
  const nomeBase = produto.nome
    .replace(/\s*\(Vazio\)\s*/i, "")
    .replace(/\s*\(Cheio\)\s*/i, "")
    .replace(/^Gás\s+/i, "")
    .replace(/^Vasilhame\s+/i, "")
    .replace(/\s+Vazio$/i, "")
    .replace(/\s+Cheio$/i, "")
    .trim();

  const estoqueAtual = produto.estoque || 0;
  const { vendas, compras, entradas_manuais, saidas_manuais, avarias } = mov;

  // Fórmula única: Inicial + Entradas − Saídas − Vendas − Avarias = Atual
  // Para vazio, entradas_manuais já vem somado com vendas do cheio
  // e saidas_manuais já vem somado com compras do cheio (via movCombinado).
  const entradas = compras + entradas_manuais;
  const saidas = saidas_manuais;
  const inicialManual = typeof saldoSalvo === "number";
  const inicial = inicialManual ? (saldoSalvo as number) : estoqueAtual - entradas + saidas + vendas + avarias;
  const total = inicial + entradas - saidas - vendas - avarias;

  const tipoLabel =
    tipoBotijao === "cheio" ? "Cheio" : tipoBotijao === "vazio" ? "Vazio" : "Único";

  return {
    produtoId: produto.id,
    nome: nomeBase,
    tipoEstoque: tipoLabel,
    estoqueAtual,
    vendas, compras, entradas, saidas,
    entradasManuais: entradas_manuais, saidasManuais: saidas_manuais,
    avarias, inicial, inicialManual, total,
  };
}

export function EstoqueDiaTable({ produtos, movimentacoes, dataDia, isLoading, onRefresh, saldosIniciais = {}, periodo }: EstoqueDiaTableProps) {
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const [editDialog, setEditDialog] = useState<{ open: boolean; linha: LinhaEstoque; nome: string } | null>(null);
  const [editForm, setEditForm] = useState({
    tipo: "entrada" as "entrada" | "saida" | "avaria" | "saldo_inicial",
    quantidade: "",
    observacoes: "",
  });
  const [savingInicial, setSavingInicial] = useState(false);
  const [fluxo, setFluxo] = useState<LinhaEstoque | null>(null);

  const abrirEdicao = (linha: LinhaEstoque, nome: string) => {
    setEditDialog({ open: true, linha, nome });
    setEditForm({ tipo: "entrada", quantidade: "", observacoes: "" });
  };

  const dataDiaISO = format(dataDia, "yyyy-MM-dd");

  const linhas = useMemo(() => {
    const resultado: LinhaEstoque[] = [];
    const grupoMap: Record<string, { cheio?: Produto; vazio?: Produto; unico?: Produto }> = {};

    produtos.forEach((p) => {
      const nomeBase = p.nome
        .replace(/\s*\(Vazio\)\s*/i, "")
        .replace(/\s*\(Cheio\)\s*/i, "")
        .replace(/^Gás\s+/i, "")
        .replace(/^Vasilhame\s+/i, "")
        .replace(/\s+Vazio$/i, "")
        .replace(/\s+Cheio$/i, "")
        .trim();
      if (!grupoMap[nomeBase]) grupoMap[nomeBase] = {};
      if (p.tipo_botijao === "cheio") grupoMap[nomeBase].cheio = p;
      else if (p.tipo_botijao === "vazio") grupoMap[nomeBase].vazio = p;
      else grupoMap[nomeBase].unico = p;
    });

    const emptyMov: MovimentacaoPorProduto = { vendas: 0, compras: 0, entradas_manuais: 0, saidas_manuais: 0, avarias: 0 };

    Object.entries(grupoMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([, grupo]) => {
        if (grupo.cheio) {
          const mov = movimentacoes[grupo.cheio.id] || emptyMov;
          resultado.push(calcularLinha(grupo.cheio, mov, "cheio", saldosIniciais[grupo.cheio.id]));
        }
        if (grupo.vazio) {
          const parCheioId = grupo.cheio?.id;
          const movCheio = parCheioId ? (movimentacoes[parCheioId] || emptyMov) : emptyMov;
          const movVazio = movimentacoes[grupo.vazio.id] || emptyMov;
          // Vazio: vendas do cheio viram entradas (vasilhame devolvido);
          // compras do cheio viram saídas (vasilhame trocado).
          const movCombinado: MovimentacaoPorProduto = {
            vendas: movVazio.vendas,
            compras: movVazio.compras,
            entradas_manuais: movVazio.entradas_manuais + movCheio.vendas,
            saidas_manuais: movVazio.saidas_manuais + movCheio.compras,
            avarias: movVazio.avarias,
          };
          resultado.push(calcularLinha(grupo.vazio, movCombinado, "vazio", saldosIniciais[grupo.vazio.id]));
        }
        if (grupo.unico && !grupo.cheio && !grupo.vazio) {
          const mov = movimentacoes[grupo.unico.id] || emptyMov;
          resultado.push(calcularLinha(grupo.unico, mov, null, saldosIniciais[grupo.unico.id]));
        }
      });

    return resultado;
  }, [produtos, movimentacoes, saldosIniciais]);

  const salvarSaldoInicial = async (linha: LinhaEstoque, valor: string) => {
    const novo = parseInt(valor);
    if (isNaN(novo) || novo < 0) {
      toast({ title: "Erro", description: "Informe uma quantidade válida.", variant: "destructive" });
      return;
    }
    if (!unidadeAtual?.id) {
      toast({ title: "Selecione uma unidade", description: "É preciso ter uma unidade ativa.", variant: "destructive" });
      return;
    }
    if (novo === linha.inicial) {
      setEditDialog(null);
      return;
    }

    setSavingInicial(true);
    try {
      const sb = supabase as any;
      const { data: userData } = await supabase.auth.getUser();

      const { error: upsertError } = await sb
        .from("estoque_saldos_iniciais")
        .upsert(
          {
            unidade_id: unidadeAtual.id,
            produto_id: linha.produtoId,
            data_referencia: dataDiaISO,
            quantidade: novo,
            definido_por: userData?.user?.id || null,
          },
          { onConflict: "unidade_id,produto_id,data_referencia" }
        );
      if (upsertError) throw upsertError;

      const diferenca = novo - linha.inicial;
      const novoAtual = Math.max(0, linha.estoqueAtual + diferenca);

      await sb.from("produtos").update({ estoque: novoAtual }).eq("id", linha.produtoId);

      await sb.from("movimentacoes_estoque").insert({
        produto_id: linha.produtoId,
        tipo: diferenca >= 0 ? "entrada" : "saida",
        quantidade: Math.abs(diferenca),
        observacoes: `Ajuste de saldo inicial (${linha.inicial} → ${novo}) em ${format(dataDia, "dd/MM/yyyy")}`,
        unidade_id: unidadeAtual.id,
        data_movimento: dataDiaISO,
      });

      toast({ title: "Saldo inicial atualizado", description: `${linha.inicial} → ${novo} un.` });
      setEditDialog(null);
      onRefresh?.();
    } catch (error) {
      console.error("Erro ao salvar saldo inicial:", error);
      toast({ title: "Erro", description: "Não foi possível salvar o saldo inicial.", variant: "destructive" });
    } finally {
      setSavingInicial(false);
    }
  };

  const dataFmt = format(dataDia, "EEEE, dd/MM/yyyy", { locale: ptBR });
  const dataFmtCapitalized = dataFmt.charAt(0).toUpperCase() + dataFmt.slice(1);

  const handleEdit = async () => {
    if (!editDialog) return;
    const quantidade = parseInt(editForm.quantidade);
    if (isNaN(quantidade) || quantidade <= 0) {
      toast({ title: "Erro", description: "Informe uma quantidade válida.", variant: "destructive" });
      return;
    }

    try {
      const { error: movError } = await (supabase as any)
        .from("movimentacoes_estoque")
        .insert({
          produto_id: editDialog.produtoId,
          tipo: editForm.tipo,
          quantidade,
          observacoes: editForm.observacoes || null,
          unidade_id: unidadeAtual?.id || null,
          data_movimento: dataDiaISO,
        });
      if (movError) throw movError;

      const produto = produtos.find((p) => p.id === editDialog.produtoId);
      if (produto) {
        let novaQtd = produto.estoque;
        if (editForm.tipo === "entrada") novaQtd += quantidade;
        else novaQtd = Math.max(0, novaQtd - quantidade);

        await supabase.from("produtos").update({ estoque: novaQtd }).eq("id", editDialog.produtoId);

        if (produto.botijao_par_id && editForm.tipo !== "avaria") {
          const par = produtos.find((p) => p.id === produto.botijao_par_id);
          if (par) {
            let novaQtdPar = par.estoque;
            if (editForm.tipo === "entrada") novaQtdPar = Math.max(0, novaQtdPar - quantidade);
            else novaQtdPar += quantidade;
            await supabase.from("produtos").update({ estoque: novaQtdPar }).eq("id", par.id);
          }
        }
      }

      toast({ title: "Movimentação registrada!", description: `${editForm.tipo === "entrada" ? "Entrada" : editForm.tipo === "saida" ? "Saída" : "Avaria"} de ${quantidade} un.` });
      setEditDialog(null);
      setEditForm({ tipo: "entrada", quantidade: "", observacoes: "" });
      onRefresh?.();
    } catch (error) {
      console.error("Erro:", error);
      toast({ title: "Erro", description: "Não foi possível registrar.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando estoque do dia...
        </CardContent>
      </Card>
    );
  }

  const renderBadge = (tipoEstoque: string) => {
    const variant =
      tipoEstoque === "Cheio"
        ? "bg-success/12 text-success ring-1 ring-inset ring-success/25"
        : tipoEstoque === "Vazio"
        ? "bg-muted text-muted-foreground ring-1 ring-inset ring-border"
        : "bg-info/12 text-info ring-1 ring-inset ring-info/25";
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${variant}`}>
        {tipoEstoque}
      </span>
    );
  };

  const buildDisplayName = (linha: LinhaEstoque) => {
    const isCheio = linha.tipoEstoque === "Cheio";
    const isVazio = linha.tipoEstoque === "Vazio";
    const isAgua = /[áa]gua/i.test(linha.nome);
    return isCheio
      ? (isAgua ? `Água Mineral ${linha.nome.replace(/[áa]gua\s*mineral\s*/i, "").trim()}` : `Gás ${linha.nome}`)
      : isVazio
      ? (isAgua ? `Galão Água ${linha.nome.replace(/[áa]gua\s*mineral\s*/i, "").trim()}` : `Vasilhame ${linha.nome}`)
      : linha.nome;
  };

  const renderIcon = (linha: LinhaEstoque) => {
    const isCheio = linha.tipoEstoque === "Cheio";
    const isVazio = linha.tipoEstoque === "Vazio";
    const isAgua = /[áa]gua/i.test(linha.nome);
    const wrap = isCheio
      ? "bg-success/10 text-success"
      : isVazio
      ? "bg-muted text-muted-foreground"
      : "bg-info/10 text-info";
    const Ico = isCheio ? (isAgua ? Package : Flame) : isVazio ? Cylinder : Package;
    return (
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${wrap}`}>
        <Ico className="h-4 w-4" />
      </span>
    );
  };

  return (
    <>
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex min-w-0 items-center gap-2 text-base sm:text-lg text-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10 text-success">
                <Package className="h-4 w-4" />
              </span>
              <span className="truncate">{dataFmtCapitalized}</span>
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Total = Inicial + Entradas − Saídas − Vendas − Avarias
          </p>
        </CardHeader>

        {/* MOBILE — cards */}
        <CardContent className="md:hidden p-3 pt-0 space-y-3">
          {linhas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Nenhum produto cadastrado
            </div>
          ) : (
            linhas.map((linha, idx) => {
              const displayName = buildDisplayName(linha);
              const isVazio = linha.tipoEstoque === "Vazio";
              const totalTone = linha.total <= 0 ? "text-destructive" : linha.total <= 3 ? "text-warning" : "text-success";
              return (
                <div
                  key={`m-${linha.produtoId}-${idx}`}
                  className="mobile-record-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-3 text-left"
                      onClick={() => setFluxo(linha)}
                    >
                      {renderIcon(linha)}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground underline-offset-2 hover:underline">{displayName}</p>
                        <div className="mt-1">{renderBadge(linha.tipoEstoque)}</div>
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => {
                        setEditDialog({ open: true, produtoId: linha.produtoId, nome: displayName });
                        setEditForm({ tipo: "entrada", quantidade: "", observacoes: "" });
                      }}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center tabular-nums">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Inicial</p>
                      {inicialEdit?.produtoId === linha.produtoId ? (
                        <Input
                          autoFocus
                          type="number"
                          min="0"
                          inputMode="numeric"
                          disabled={savingInicial}
                          value={inicialEdit.valor}
                          onChange={(e) => setInicialEdit({ produtoId: linha.produtoId, valor: e.target.value })}
                          onBlur={() => salvarSaldoInicial(linha)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") salvarSaldoInicial(linha);
                            if (e.key === "Escape") setInicialEdit(null);
                          }}
                          className="mx-auto h-8 w-16 px-1 text-center text-sm"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setInicialEdit({ produtoId: linha.produtoId, valor: String(linha.inicial) })}
                          className={`mx-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold text-foreground hover:bg-background ${linha.inicialManual ? "ring-1 ring-inset ring-primary/40" : ""}`}
                          aria-label="Editar saldo inicial"
                        >
                          {linha.inicial}
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Entradas</p>
                      <p className="text-sm font-semibold text-success">
                        {linha.entradas > 0 ? `+${linha.entradas}` : "0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saídas</p>
                      <p className="text-sm font-semibold text-warning">
                        {linha.saidas > 0 ? `-${linha.saidas}` : "0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Vendas</p>
                      <p className="text-sm font-semibold text-info">
                        {linha.vendas > 0 ? `-${linha.vendas}` : "0"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Avarias</p>
                      <p className="text-sm font-semibold text-destructive">
                        {linha.avarias > 0 ? `-${linha.avarias}` : "0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Atual</p>
                      <p className={`text-sm font-semibold ${totalTone}`}>{linha.total}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">Estoque atual</span>
                    <span className={`text-lg font-bold tabular-nums ${totalTone}`}>{linha.total}</span>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>

        {/* DESKTOP — table */}
        <CardContent className="hidden md:block p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[hsl(220,14%,96%)] hover:bg-[hsl(220,14%,96%)]">
                  <TableHead className="font-semibold text-foreground min-w-[200px]">Produto</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Tipo</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Inicial</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Entradas</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Saídas</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Vendas</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Avarias</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Total</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Atual</TableHead>
                  <TableHead className="font-semibold text-foreground text-center w-[60px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nenhum produto cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  linhas.map((linha, idx) => {
                    const isCheio = linha.tipoEstoque === "Cheio";
                    const isVazio = linha.tipoEstoque === "Vazio";
                    const nextLinha = linhas[idx + 1];
                    const hasPairBelow = isCheio && nextLinha?.tipoEstoque === "Vazio" && nextLinha?.nome === linha.nome;
                    const isPairedVazio = isVazio && idx > 0 && linhas[idx - 1]?.tipoEstoque === "Cheio" && linhas[idx - 1]?.nome === linha.nome;
                    const displayName = buildDisplayName(linha);
                    const totalTone = linha.total <= 0 ? "text-destructive" : linha.total <= 3 ? "text-warning" : "text-success";

                    return (
                      <TableRow
                        key={`${linha.produtoId}-${idx}`}
                        className="border-b border-border/50 hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="py-3">
                          <button
                            type="button"
                            onClick={() => setFluxo(linha)}
                            className="flex items-center gap-2 text-left"
                          >
                            {renderIcon(linha)}
                            <span className={`text-sm text-foreground underline-offset-2 hover:underline ${isCheio ? "font-semibold" : "font-medium"}`}>
                              {displayName}
                            </span>
                          </button>
                        </TableCell>
                        <TableCell className="text-center">{renderBadge(linha.tipoEstoque)}</TableCell>
                        <TableCell className="text-center font-semibold tabular-nums">
                          {inicialEdit?.produtoId === linha.produtoId ? (
                            <Input
                              autoFocus
                              type="number"
                              min="0"
                              disabled={savingInicial}
                              value={inicialEdit.valor}
                              onChange={(e) => setInicialEdit({ produtoId: linha.produtoId, valor: e.target.value })}
                              onBlur={() => salvarSaldoInicial(linha)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") salvarSaldoInicial(linha);
                                if (e.key === "Escape") setInicialEdit(null);
                              }}
                              className="mx-auto h-8 w-20 px-1 text-center"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setInicialEdit({ produtoId: linha.produtoId, valor: String(linha.inicial) })}
                              className={`mx-auto inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted ${linha.inicialManual ? "ring-1 ring-inset ring-primary/40" : ""}`}
                              title="Clique para ajustar o saldo inicial"
                            >
                              {linha.inicial}
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-success tabular-nums">
                          {linha.entradas > 0 ? `+${linha.entradas}` : "0"}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-warning tabular-nums">
                          {linha.saidas > 0 ? `-${linha.saidas}` : "0"}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-info tabular-nums">
                          {linha.vendas > 0 ? `-${linha.vendas}` : "0"}
                        </TableCell>

                        <TableCell className="text-center font-semibold text-destructive tabular-nums">
                          {linha.avarias > 0 ? `-${linha.avarias}` : "0"}
                        </TableCell>
                        <TableCell className={`text-center font-bold text-base tabular-nums ${totalTone}`}>
                          {linha.total}
                        </TableCell>
                        <TableCell className="text-center font-bold text-base border-l tabular-nums">
                          {linha.estoqueAtual}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditDialog({ open: true, produtoId: linha.produtoId, nome: displayName });
                              setEditForm({ tipo: "entrada", quantidade: "", observacoes: "" });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>


      {/* Edit Dialog */}
      <Dialog open={!!editDialog?.open} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar: {editDialog?.nome}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={editForm.tipo} onValueChange={(v: "entrada" | "saida" | "avaria") => setEditForm({ ...editForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">➕ Entrada</SelectItem>
                  <SelectItem value="saida">➖ Saída</SelectItem>
                  <SelectItem value="avaria">⚠️ Avaria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantidade</Label>
              <Input type="number" min="1" value={editForm.quantidade} onChange={(e) => setEditForm({ ...editForm, quantidade: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea value={editForm.observacoes} onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })} placeholder="Motivo..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancelar</Button>
            <Button onClick={handleEdit}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FluxoProdutoDialog
        open={!!fluxo}
        onOpenChange={(o) => !o && setFluxo(null)}
        produtoId={fluxo?.produtoId || null}
        produtoNome={fluxo ? buildDisplayName(fluxo) : ""}
        estoqueAtual={fluxo?.estoqueAtual ?? 0}
        saldoInicial={fluxo?.inicial ?? 0}
        inicio={periodo?.inicio ?? dataDia}
        fim={periodo?.fim ?? dataDia}
        unidadeId={unidadeAtual?.id}
      />
    </>
  );
}
