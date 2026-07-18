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
}

interface LinhaEstoque {
  produtoId: string;
  nome: string;
  tipoEstoque: string;
  estoqueAtual: number;
  vendas: number;
  compras: number;
  entradas: number; // compras + entradas manuais (para exibição)
  saidas: number;   // saídas manuais (para exibição)
  entradasManuais: number;
  saidasManuais: number;
  avarias: number;
  inicial: number;
  total: number;
}

function calcularLinha(
  produto: Produto,
  mov: MovimentacaoPorProduto,
  tipoBotijao: string | null
): LinhaEstoque {
  const nomeBase = produto.nome
    .replace(/\s*\(Vazio\)\s*/i, "")
    .replace(/\s*\(Cheio\)\s*/i, "")
    .replace(/^Gás\s+/i, "")
    .trim();

  const estoqueAtual = produto.estoque || 0;
  const { vendas, compras, entradas_manuais, saidas_manuais, avarias } = mov;

  if (tipoBotijao === "vazio") {
    const entradas = saidas_manuais + vendas;
    const saidas = compras + entradas_manuais;
    const inicial = estoqueAtual - entradas + saidas;
    const total = inicial + entradas - saidas;
    return {
      produtoId: produto.id, nome: nomeBase, tipoEstoque: "Vazio", estoqueAtual,
      vendas: 0, compras, entradas, saidas,
      entradasManuais: entradas_manuais, saidasManuais: saidas_manuais,
      avarias, inicial, total,
    };
  }

  // Cheio ou Único: inicial + (compras + manuais) - saídas manuais - vendas - avarias = atual
  const entradas = compras + entradas_manuais;
  const saidas = saidas_manuais;
  const inicial = estoqueAtual - entradas + saidas + vendas + avarias;
  const total = inicial + entradas - saidas - vendas - avarias;
  return {
    produtoId: produto.id,
    nome: nomeBase,
    tipoEstoque: tipoBotijao === "cheio" ? "Cheio" : "Único",
    estoqueAtual,
    vendas, compras, entradas, saidas,
    entradasManuais: entradas_manuais, saidasManuais: saidas_manuais,
    avarias, inicial, total,
  };
}

export function EstoqueDiaTable({ produtos, movimentacoes, dataDia, isLoading, onRefresh }: EstoqueDiaTableProps) {
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const [editDialog, setEditDialog] = useState<{ open: boolean; produtoId: string; nome: string } | null>(null);
  const [editForm, setEditForm] = useState({
    tipo: "entrada" as "entrada" | "saida" | "avaria",
    quantidade: "",
    observacoes: "",
  });

  const linhas = useMemo(() => {
    const resultado: LinhaEstoque[] = [];
    const grupoMap: Record<string, { cheio?: Produto; vazio?: Produto; unico?: Produto }> = {};

    produtos.forEach((p) => {
      const nomeBase = p.nome.replace(/\s*\(Vazio\)\s*/i, "").replace(/\s*\(Cheio\)\s*/i, "").replace(/^Gás\s+/i, "").trim();
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
          resultado.push(calcularLinha(grupo.cheio, mov, "cheio"));
        }
        if (grupo.vazio) {
          const parCheioId = grupo.cheio?.id;
          const movCheio = parCheioId ? (movimentacoes[parCheioId] || emptyMov) : emptyMov;
          const movVazio = movimentacoes[grupo.vazio.id] || emptyMov;
          const movCombinado: MovimentacaoPorProduto = {
            vendas: movCheio.vendas, compras: movCheio.compras,
            entradas_manuais: movCheio.entradas_manuais, saidas_manuais: movCheio.saidas_manuais,
            avarias: movVazio.avarias,
          };
          resultado.push(calcularLinha(grupo.vazio, movCombinado, "vazio"));
        }
        if (grupo.unico && !grupo.cheio && !grupo.vazio) {
          const mov = movimentacoes[grupo.unico.id] || emptyMov;
          resultado.push(calcularLinha(grupo.unico, mov, null));
        }
      });

    return resultado;
  }, [produtos, movimentacoes]);

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
      const { error: movError } = await supabase
        .from("movimentacoes_estoque")
        .insert({
          produto_id: editDialog.produtoId,
          tipo: editForm.tipo,
          quantidade,
          observacoes: editForm.observacoes || null,
          unidade_id: unidadeAtual?.id || null,
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
                  className="rounded-[18px] border border-border bg-card p-4 shadow-[0_4px_16px_rgba(15,23,42,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {renderIcon(linha)}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                        <div className="mt-1">{renderBadge(linha.tipoEstoque)}</div>
                      </div>
                    </div>
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
                      <p className="text-sm font-semibold text-foreground">{linha.inicial}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Entradas</p>
                      <p className="text-sm font-semibold text-success">
                        {linha.entradasManuais > 0 ? `+${linha.entradasManuais}` : "0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saídas</p>
                      <p className="text-sm font-semibold text-warning">
                        {linha.saidasManuais > 0 ? `-${linha.saidasManuais}` : "0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Vendas</p>
                      <p className="text-sm font-semibold text-info">
                        {isVazio ? "—" : linha.vendas > 0 ? `-${linha.vendas}` : "0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Avarias</p>
                      <p className="text-sm font-semibold text-destructive">
                        {linha.avarias > 0 ? `-${linha.avarias}` : "0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Vasilhame</p>
                      <p className="text-sm font-semibold text-foreground">{linha.estoqueAtual}</p>
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
                  <TableHead className="font-semibold text-foreground text-center">Vasilhame</TableHead>
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
                          <span className="flex items-center gap-2">
                            {renderIcon(linha)}
                            <span className={`text-sm text-foreground ${isCheio ? "font-semibold" : "font-medium"}`}>
                              {displayName}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{renderBadge(linha.tipoEstoque)}</TableCell>
                        <TableCell className="text-center font-semibold tabular-nums">{linha.inicial}</TableCell>
                        <TableCell className="text-center font-semibold text-success tabular-nums">
                          {linha.entradasManuais > 0 ? `+${linha.entradasManuais}` : "0"}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-warning tabular-nums">
                          {linha.saidasManuais > 0 ? `-${linha.saidasManuais}` : "0"}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-info tabular-nums">
                          {isVazio ? "—" : (linha.vendas > 0 ? `-${linha.vendas}` : "0")}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-destructive tabular-nums">
                          {linha.avarias > 0 ? `-${linha.avarias}` : "0"}
                        </TableCell>
                        <TableCell className={`text-center font-bold text-base tabular-nums ${totalTone}`}>
                          {linha.total}
                        </TableCell>
                        {!isPairedVazio && (
                          <TableCell
                            className="text-center font-bold text-base border-l tabular-nums"
                            rowSpan={hasPairBelow ? 2 : 1}
                          >
                            {linha.estoqueAtual}
                          </TableCell>
                        )}
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
    </>
  );
}
