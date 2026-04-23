import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Search } from "lucide-react";
import { formatCurrency } from "@/lib/transp-utils";

interface Compra {
  id: string;
  data: string;
  fornecedor: string;
  produto_descricao?: string | null;
  quantidade?: number | null;
  preco_unitario?: number | null;
  desconto?: number | null;
  custo_total?: number | null;
  numero_nf?: string | null;
  cfop?: string | null;
}

interface Props {
  compras: Compra[];
}

const PAGE_SIZE = 30;

export function ComprasSimplesTable({ compras }: Props) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState<Compra | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Compra>>({});

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return compras;
    return compras.filter((c) =>
      [c.fornecedor, c.produto_descricao, c.numero_nf]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(termo))
    );
  }, [compras, busca]);

  const visiveis = filtradas.slice(0, pagina * PAGE_SIZE);
  const temMais = visiveis.length < filtradas.length;

  const abrirEditar = (c: Compra) => {
    setEditando(c);
    setForm({ ...c });
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!editando) return;
      const patch: any = {
        fornecedor: form.fornecedor ?? null,
        produto_descricao: form.produto_descricao ?? null,
        quantidade: form.quantidade != null ? Number(form.quantidade) : null,
        preco_unitario: form.preco_unitario != null ? Number(form.preco_unitario) : null,
        desconto: form.desconto != null ? Number(form.desconto) : 0,
        custo_total: form.custo_total != null ? Number(form.custo_total) : null,
        data: form.data ?? editando.data,
        numero_nf: form.numero_nf ?? null,
        cfop: form.cfop ?? null,
      };
      const { error } = await (supabase as any)
        .from("transp_compras")
        .update(patch)
        .eq("id", editando.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compra atualizada");
      qc.invalidateQueries({ queryKey: ["transp-compras"] });
      setEditando(null);
    },
    onError: (e: any) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("transp_compras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compra excluída");
      qc.invalidateQueries({ queryKey: ["transp-compras"] });
      setExcluindoId(null);
    },
    onError: (e: any) => toast.error("Erro ao excluir", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar fornecedor, produto ou NF..."
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(1);
          }}
          className="pl-9"
        />
      </div>

      {visiveis.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhuma compra encontrada.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {visiveis.map((c) => (
          <Card key={c.id} className="border-border/40">
            <CardContent className="p-3 text-sm space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{c.fornecedor}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.data ? format(new Date(c.data + "T00:00:00"), "dd/MM/yyyy") : "—"}
                    {c.numero_nf ? ` · NF ${c.numero_nf}` : ""}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEditar(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setExcluindoId(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              {c.produto_descricao && (
                <p className="text-xs text-muted-foreground line-clamp-2">{c.produto_descricao}</p>
              )}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-muted-foreground">
                  Qtd: <span className="font-medium text-foreground">{c.quantidade ?? "—"}</span>
                </span>
                <span className="font-bold text-primary">
                  {formatCurrency(Number(c.custo_total) || 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {temMais && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setPagina((p) => p + 1)}>
            Ver mais ({filtradas.length - visiveis.length} restantes)
          </Button>
        </div>
      )}

      {/* Modal edição */}
      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar compra</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={form.data ?? ""}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Número NF</Label>
                <Input
                  value={form.numero_nf ?? ""}
                  onChange={(e) => setForm({ ...form, numero_nf: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Input
                value={form.fornecedor ?? ""}
                onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Produto / Descrição</Label>
              <Input
                value={form.produto_descricao ?? ""}
                onChange={(e) => setForm({ ...form, produto_descricao: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.quantidade ?? ""}
                  onChange={(e) => setForm({ ...form, quantidade: e.target.value === "" ? null : +e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Preço unitário</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.preco_unitario ?? ""}
                  onChange={(e) => setForm({ ...form, preco_unitario: e.target.value === "" ? null : +e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Desconto</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.desconto ?? 0}
                  onChange={(e) => setForm({ ...form, desconto: +e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Custo total (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.custo_total ?? ""}
                  onChange={(e) => setForm({ ...form, custo_total: e.target.value === "" ? null : +e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">CFOP</Label>
                <Input
                  value={form.cfop ?? ""}
                  onChange={(e) => setForm({ ...form, cfop: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação exclusão */}
      <AlertDialog open={!!excluindoId} onOpenChange={(o) => !o && setExcluindoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A compra será removida permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => excluindoId && excluir.mutate(excluindoId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
