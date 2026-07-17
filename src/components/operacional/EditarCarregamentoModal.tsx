import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, ShoppingCart, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Rota {
  id: string;
  nome: string;
}

interface Produto {
  id: string;
  nome: string;
  categoria: string;
}

interface ItemCarregamento {
  id?: string; // existing DB id, undefined for new items
  produto_id: string;
  produto_nome: string;
  categoria: string;
  quantidade: number;
  isNew?: boolean;
}

interface CarregamentoData {
  id: string;
  entregador_id: string;
  entregador_nome: string;
  rota_nome: string | null;
  rota_definida_id?: string | null;
  unidade_id?: string | null;
  data_saida: string;
  status: string;
  itens: {
    id: string;
    produto_id?: string;
    produto_nome: string;
    quantidade_saida: number;
    quantidade_vendida: number | null;
    quantidade_retorno: number | null;
    quantidade_transferida: number | null;
  }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carregamento: CarregamentoData | null;
  onSaved: () => void;
}

export function EditarCarregamentoModal({ open, onOpenChange, carregamento, onSaved }: Props) {
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [allProdutos, setAllProdutos] = useState<Produto[]>([]);
  const [rotaId, setRotaId] = useState("");
  const [dataSaida, setDataSaida] = useState("");
  const [itens, setItens] = useState<ItemCarregamento[]>([]);
  const [searchProduto, setSearchProduto] = useState("");
  const [filteredProdutos, setFilteredProdutos] = useState<Produto[]>([]);
  const [saving, setSaving] = useState(false);
  const [removedItemIds, setRemovedItemIds] = useState<string[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    if (open && carregamento) {
      fetchOptions();
      loadCarregamento();
      setRemovedItemIds([]);
    }
  }, [open, carregamento]);

  const fetchOptions = async () => {
    const [rotaRes, prodRes] = await Promise.all([
      supabase.from("rotas_definidas").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("produtos").select("id, nome, categoria").eq("ativo", true).order("nome"),
    ]);
    if (rotaRes.data) setRotas(rotaRes.data);
    if (prodRes.data) setAllProdutos(prodRes.data);
  };

  const loadCarregamento = async () => {
    if (!carregamento) return;

    // Fetch the full record to get rota_definida_id
    const { data: fullCarreg } = await supabase
      .from("carregamentos_rota")
      .select("rota_definida_id, data_saida")
      .eq("id", carregamento.id)
      .single();

    setRotaId(fullCarreg?.rota_definida_id || "none");
    setDataSaida(fullCarreg?.data_saida ? new Date(fullCarreg.data_saida).toISOString().slice(0, 16) : "");

    // Fetch items with produto_id
    const { data: itensData } = await supabase
      .from("carregamento_rota_itens")
      .select("id, produto_id, quantidade_saida, produtos(nome, categoria)")
      .eq("carregamento_id", carregamento.id) as any;

    if (itensData) {
      setItens(
        itensData.map((i: any) => ({
          id: i.id,
          produto_id: i.produto_id,
          produto_nome: i.produtos?.nome || "—",
          categoria: i.produtos?.categoria || "",
          quantidade: i.quantidade_saida,
        }))
      );
    }
  };

  useEffect(() => {
    if (searchProduto.trim()) {
      const q = searchProduto.toLowerCase();
      setFilteredProdutos(
        allProdutos
          .filter(
            (p) =>
              p.nome.toLowerCase().includes(q) &&
              !itens.find((i) => i.produto_id === p.id)
          )
          .slice(0, 8)
      );
    } else {
      setFilteredProdutos([]);
    }
  }, [searchProduto, allProdutos, itens]);

  const addItem = (produto: Produto) => {
    setItens((prev) => [
      ...prev,
      {
        produto_id: produto.id,
        produto_nome: produto.nome,
        categoria: produto.categoria,
        quantidade: 1,
        isNew: true,
      },
    ]);
    setSearchProduto("");
  };

  const updateQtd = (produtoId: string, qtd: number) => {
    setItens((prev) =>
      prev.map((i) => (i.produto_id === produtoId ? { ...i, quantidade: Math.max(1, qtd) } : i))
    );
  };

  const removeItem = (produtoId: string) => {
    const item = itens.find((i) => i.produto_id === produtoId);
    if (item?.id && !item.isNew) {
      setRemovedItemIds((prev) => [...prev, item.id!]);
    }
    setItens((prev) => prev.filter((i) => i.produto_id !== produtoId));
  };

  const handleSave = async () => {
    if (!carregamento) return;
    if (itens.length === 0) {
      toast({ title: "Adicione pelo menos um produto", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Update carregamento header
      const { error: errCarreg } = await supabase
        .from("carregamentos_rota")
        .update({
          rota_definida_id: rotaId === "none" ? null : rotaId,
          data_saida: new Date(dataSaida).toISOString(),
        } as any)
        .eq("id", carregamento.id);

      if (errCarreg) throw errCarreg;

      // Delete removed items
      if (removedItemIds.length > 0) {
        const { error: errDel } = await supabase
          .from("carregamento_rota_itens")
          .delete()
          .in("id", removedItemIds);
        if (errDel) throw errDel;
      }

      // Update existing items
      for (const item of itens.filter((i) => i.id && !i.isNew)) {
        await supabase
          .from("carregamento_rota_itens")
          .update({ quantidade_saida: item.quantidade } as any)
          .eq("id", item.id!);
      }

      // Insert new items
      const newItems = itens.filter((i) => i.isNew);
      if (newItems.length > 0) {
        const { error: errIns } = await supabase
          .from("carregamento_rota_itens")
          .insert(
            newItems.map((i) => ({
              carregamento_id: carregamento.id,
              produto_id: i.produto_id,
              quantidade_saida: i.quantidade,
            })) as any
          );
        if (errIns) throw errIns;
      }

      toast({ title: "Carregamento atualizado com sucesso!" });
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Pencil className="h-5 w-5" />
            Editar Carregamento
          </DialogTitle>
          <DialogDescription>
            {carregamento?.entregador_nome && (
              <>Entregador: <strong>{carregamento.entregador_nome}</strong></>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Rota */}
          <div className="space-y-2">
            <Label>Rota</Label>
            <Select value={rotaId} onValueChange={setRotaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a rota" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem rota</SelectItem>
                {rotas.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data Saída */}
          <div className="space-y-2">
            <Label>Data de Saída</Label>
            <Input
              type="datetime-local"
              value={dataSaida}
              onChange={(e) => setDataSaida(e.target.value)}
            />
          </div>

          {/* Buscar produto */}
          <div className="space-y-2 relative">
            <Label>Adicionar Produto</Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar produto..."
                value={searchProduto}
                onChange={(e) => setSearchProduto(e.target.value)}
              />
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            </div>
            {filteredProdutos.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 bg-background border rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                {filteredProdutos.map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between items-center"
                    onClick={() => addItem(p)}
                  >
                    <span>{p.nome}</span>
                    <Plus className="h-4 w-4 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items table */}
          {itens.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Qntd.</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item, idx) => (
                  <TableRow key={item.produto_id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-medium">
                      {item.produto_nome}
                      {item.isNew && <Badge className="ml-1 text-[10px] bg-success">Novo</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{item.categoria}</Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) => updateQtd(item.produto_id, parseInt(e.target.value) || 1)}
                        className="w-16 h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.produto_id)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="flex-1" disabled={saving}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
