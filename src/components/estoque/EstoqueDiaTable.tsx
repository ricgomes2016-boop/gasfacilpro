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

  if (tipoBotijao === "cheio") {
    const entradas = compras + entradas_manuais;
    const saidas = saidas_manuais;
    const inicial = estoqueAtual - entradas + saidas + vendas + avarias;
    const total = inicial + entradas - saidas - vendas - avarias;
    return {
      produtoId: produto.id, nome: nomeBase, tipoEstoque: "Cheio", estoqueAtual,
      vendas, compras, entradasManuais: entradas_manuais, saidasManuais: saidas_manuais,
      avarias, inicial, total,
    };
  } else if (tipoBotijao === "vazio") {
    const entradas = saidas_manuais + vendas;
    const saidas = compras + entradas_manuais;
    const inicial = estoqueAtual - entradas + saidas;
    const total = inicial + entradas - saidas;
    return {
      produtoId: produto.id, nome: nomeBase, tipoEstoque: "Vazio", estoqueAtual,
      vendas: 0, compras: 0, entradasManuais: entradas, saidasManuais: saidas,
      avarias, inicial, total,
    };
  } else {
    const entradas = compras + entradas_manuais;
    const saidas = saidas_manuais;
    const inicial = estoqueAtual - entradas + saidas + vendas + avarias;
    const total = inicial + entradas - saidas - vendas - avarias;
    return {
      produtoId: produto.id, nome: nomeBase, tipoEstoque: "Único", estoqueAtual,
      vendas, compras, entradasManuais: entradas_manuais, saidasManuais: saidas_manuais,
      avarias, inicial, total,
    };
  }
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
        const estoqueCombinado = (grupo.cheio?.estoque || 0) + (grupo.vazio?.estoque || 0);

        if (grupo.cheio) {
          const mov = movimentacoes[grupo.cheio.id] || emptyMov;
          const linha = calcularLinha(grupo.cheio, mov, "cheio");
          linha.estoqueAtual = estoqueCombinado;
          resultado.push(linha);
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
          const linha = calcularLinha(grupo.vazio, movCombinado, "vazio");
          linha.estoqueAtual = estoqueCombinado;
          resultado.push(linha);
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

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">📦 {dataFmtCapitalized}</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Total = Inicial + Entradas − Saídas − Vendas − Avarias
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold min-w-[160px]">Produto</TableHead>
                  <TableHead className="font-semibold min-w-[80px]">Tipo</TableHead>
                  <TableHead className="font-semibold text-center">Inicial</TableHead>
                  <TableHead className="font-semibold text-center">Entradas</TableHead>
                  <TableHead className="font-semibold text-center">Saídas</TableHead>
                  <TableHead className="font-semibold text-center">Vendas</TableHead>
                  <TableHead className="font-semibold text-center">Avarias</TableHead>
                  <TableHead className="font-semibold text-center">Total</TableHead>
                  <TableHead className="font-semibold text-center">Est. Atual</TableHead>
                  <TableHead className="font-semibold text-center w-[60px]">Ação</TableHead>
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

                    const groupBg = isCheio
                      ? "bg-orange-50/60 dark:bg-orange-950/10"
                      : isVazio
                      ? "bg-slate-50/80 dark:bg-slate-900/20"
                      : idx % 2 === 0
                      ? "bg-background"
                      : "bg-muted/30";

                    const isAgua = /[áa]gua/i.test(linha.nome);
                    const displayName = isCheio
                      ? (isAgua ? `Água Mineral ${linha.nome.replace(/[áa]gua\s*mineral\s*/i, "").trim()}` : `Gás ${linha.nome}`)
                      : isVazio
                      ? (isAgua ? `Galão Água ${linha.nome.replace(/[áa]gua\s*mineral\s*/i, "").trim()}` : `Vasilhame ${linha.nome}`)
                      : linha.nome;

                    return (
                      <TableRow
                        key={`${linha.produtoId}-${idx}`}
                        className={`${groupBg} border-b border-border/50 hover:bg-accent/40 transition-colors`}
                      >
                        <TableCell className="font-medium py-3">
                          <span className="flex items-center gap-2">
                            <span className={`flex items-center justify-center w-7 h-7 rounded-full ${
                              isCheio
                                ? (isAgua ? "bg-blue-100 dark:bg-blue-900/30" : "bg-orange-100 dark:bg-orange-900/30")
                                : isVazio
                                ? "bg-slate-100 dark:bg-slate-800/50"
                                : "bg-muted"
                            }`}>
                              {isCheio ? (
                                isAgua ? <Package className="h-3.5 w-3.5 text-blue-600" /> : <Flame className="h-3.5 w-3.5 text-orange-500" />
                              ) : isVazio ? (
                                <Cylinder className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </span>
                            <span className={isCheio ? "font-semibold" : ""}>{displayName}</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={isCheio ? "default" : isVazio ? "secondary" : "outline"}
                            className={`text-xs ${isCheio ? "bg-primary" : ""}`}
                          >
                            {linha.tipoEstoque}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold">{linha.inicial}</TableCell>
                        <TableCell className="text-center font-bold text-green-600">
                          {linha.entradasManuais > 0 ? `+${linha.entradasManuais}` : "0"}
                        </TableCell>
                        <TableCell className="text-center font-bold text-orange-600">
                          {linha.saidasManuais > 0 ? `-${linha.saidasManuais}` : "0"}
                        </TableCell>
                        <TableCell className="text-center font-bold text-blue-600">
                          {isVazio ? "—" : (linha.vendas > 0 ? `-${linha.vendas}` : "0")}
                        </TableCell>
                        <TableCell className="text-center font-bold text-destructive">
                          {linha.avarias > 0 ? `-${linha.avarias}` : "0"}
                        </TableCell>
                        <TableCell className="text-center font-bold text-lg">{linha.total}</TableCell>
                        <TableCell className="text-center font-bold text-lg border-l">{linha.estoqueAtual}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditDialog({ open: true, produtoId: linha.produtoId, nome: displayName });
                              setEditForm({ tipo: "entrada", quantidade: "", observacoes: "" });
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
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
