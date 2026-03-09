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
import { Truck, ShoppingCart, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

interface Entregador {
  id: string;
  nome: string;
  unidade_id: string | null;
}

interface Rota {
  id: string;
  nome: string;
}

interface Produto {
  id: string;
  nome: string;
  categoria: string;
  unidade_id: string | null;
}

interface Unidade {
  id: string;
  nome: string;
}

interface ItemCarregamento {
  produto_id: string;
  produto_nome: string;
  categoria: string;
  quantidade: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function CadastrarCarregamentoModal({ open, onOpenChange, onSaved }: Props) {
  const [allEntregadores, setAllEntregadores] = useState<Entregador[]>([]);
  const [allProdutos, setAllProdutos] = useState<Produto[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [filteredProdutos, setFilteredProdutos] = useState<Produto[]>([]);
  const [searchProduto, setSearchProduto] = useState("");

  const [selectedUnidadeId, setSelectedUnidadeId] = useState("");
  const [entregadorId, setEntregadorId] = useState("");
  const [rotaId, setRotaId] = useState("");
  const [dataSaida, setDataSaida] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [itens, setItens] = useState<ItemCarregamento[]>([]);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();

  const entregadores = useMemo(() => 
    selectedUnidadeId
      ? allEntregadores.filter((e) => e.unidade_id === selectedUnidadeId)
      : allEntregadores,
    [selectedUnidadeId, allEntregadores]
  );

  const produtos = useMemo(() =>
    selectedUnidadeId
      ? allProdutos.filter((p) => p.unidade_id === selectedUnidadeId)
      : allProdutos,
    [selectedUnidadeId, allProdutos]
  );

  const fetchData = async () => {
    const [entRes, rotaRes, prodRes, uniRes] = await Promise.all([
      supabase.from("entregadores").select("id, nome, unidade_id").eq("ativo", true).order("nome"),
      supabase.from("rotas_definidas").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("produtos").select("id, nome, categoria, unidade_id").eq("ativo", true).order("nome"),
      supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    if (entRes.data) setAllEntregadores(entRes.data as Entregador[]);
    if (rotaRes.data) setRotas(rotaRes.data);
    if (prodRes.data) setAllProdutos(prodRes.data as Produto[]);
    if (uniRes.data) setUnidades(uniRes.data);
  };

  useEffect(() => {
    if (open) {
      fetchData();
      setSelectedUnidadeId(unidadeAtual?.id || "");
      setEntregadorId("");
      setRotaId("");
      setItens([]);
      setSearchProduto("");
      setDataSaida(new Date().toISOString().slice(0, 16));
    }
  }, [open]);

  useEffect(() => {
    if (searchProduto.trim()) {
      const q = searchProduto.toLowerCase();
      setFilteredProdutos(
        produtos.filter(
          (p) =>
            p.nome.toLowerCase().includes(q) &&
            !itens.find((i) => i.produto_id === p.id)
        ).slice(0, 8)
      );
    } else {
      setFilteredProdutos([]);
    }
  }, [searchProduto, produtos, itens]);

  // Reset entregador when loja changes
  useEffect(() => {
    setEntregadorId("");
    setItens([]);
  }, [selectedUnidadeId]);

  const addItem = (produto: Produto) => {
    setItens((prev) => [
      ...prev,
      { produto_id: produto.id, produto_nome: produto.nome, categoria: produto.categoria, quantidade: 1 },
    ]);
    setSearchProduto("");
  };

  const updateQtd = (produtoId: string, qtd: number) => {
    setItens((prev) =>
      prev.map((i) => (i.produto_id === produtoId ? { ...i, quantidade: Math.max(1, qtd) } : i))
    );
  };

  const removeItem = (produtoId: string) => {
    setItens((prev) => prev.filter((i) => i.produto_id !== produtoId));
  };

  const handleSave = async () => {
    if (!selectedUnidadeId) {
      toast({ title: "Selecione a loja", variant: "destructive" });
      return;
    }
    if (!entregadorId) {
      toast({ title: "Selecione o entregador", variant: "destructive" });
      return;
    }
    if (itens.length === 0) {
      toast({ title: "Adicione pelo menos um produto", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: carreg, error: errCarreg } = await supabase
        .from("carregamentos_rota")
        .insert({
          entregador_id: entregadorId,
          rota_definida_id: rotaId || null,
          data_saida: new Date(dataSaida).toISOString(),
          status: "em_rota",
          unidade_id: selectedUnidadeId,
        } as any)
        .select("id")
        .single();

      if (errCarreg) throw errCarreg;

      const itensPayload = itens.map((i) => ({
        carregamento_id: carreg.id,
        produto_id: i.produto_id,
        quantidade_saida: i.quantidade,
      }));

      const { error: errItens } = await supabase
        .from("carregamento_rota_itens")
        .insert(itensPayload as any);

      if (errItens) throw errItens;

      toast({ title: "Carregamento registrado com sucesso!" });
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
            <Truck className="h-5 w-5" />
            Cadastrar Rota de Entregador
          </DialogTitle>
          <DialogDescription>
            Selecione o entregador, rota e produtos para carregar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Loja */}
          <div className="space-y-2">
            <Label>Loja *</Label>
            <Select value={selectedUnidadeId} onValueChange={setSelectedUnidadeId}>
              <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
              <SelectContent>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entregador */}
          <div className="space-y-2">
            <Label>Entregador *</Label>
            <Select value={entregadorId} onValueChange={setEntregadorId}>
              <SelectTrigger><SelectValue placeholder="Entregador" /></SelectTrigger>
              <SelectContent>
                {entregadores.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rota + Data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rota</Label>
              <Select value={rotaId} onValueChange={setRotaId}>
                <SelectTrigger><SelectValue placeholder="Rota" /></SelectTrigger>
                <SelectContent>
                  {rotas.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de Saída</Label>
              <Input
                type="datetime-local"
                value={dataSaida}
                onChange={(e) => setDataSaida(e.target.value)}
              />
            </div>
          </div>

          {/* Buscar produto */}
          <div className="space-y-2 relative">
            <Label>Buscar Produto</Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Ex: PROD01, Gás 13 KG, etc..."
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

          {/* Tabela de itens */}
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
                    <TableCell className="font-medium">{item.produto_nome}</TableCell>
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

          {/* Ações */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="flex-1" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
