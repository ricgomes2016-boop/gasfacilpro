import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Search, Trash2, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Produto {
  id: string;
  nome: string;
  preco: number;
  estoque: number | null;
}

export interface ItemVenda {
  id: string;
  produto_id: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  total: number;
}

interface ProductSearchProps {
  itens: ItemVenda[];
  onChange: (itens: ItemVenda[]) => void;
  unidadeId?: string | null;
  clienteId?: string | null;
}

export function ProductSearch({ itens, onChange, unidadeId, clienteId }: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Produto[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const searchProdutos = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    try {
      let query = supabase
        .from("produtos")
        .select("id, nome, preco, estoque")
        .eq("ativo", true)
        .or("tipo_botijao.is.null,tipo_botijao.neq.vazio")
        .limit(50);

      if (unidadeId) {
        query = query.eq("unidade_id", unidadeId);
      }

      const { data, error } = await query;

      if (!error && data) {
        const normalizedTerm = normalize(term);
        const filtered = data
          .filter((p) => normalize(p.nome).includes(normalizedTerm))
          .slice(0, 8);
        setSearchResults(filtered);
        setShowResults(filtered.length > 0);
      }
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    }
  };

  const addItem = async (produto: Produto) => {
    const existingIndex = itens.findIndex((i) => i.produto_id === produto.id);

    if (existingIndex >= 0) {
      // Increase quantity
      const newItens = [...itens];
      newItens[existingIndex].quantidade += 1;
      newItens[existingIndex].total =
        newItens[existingIndex].quantidade * newItens[existingIndex].preco_unitario;
      onChange(newItens);
    } else {
      // Try to get last price paid by this customer for this product
      let precoUnitario = produto.preco;
      if (clienteId) {
        try {
          const { data: lastItem } = await supabase
            .from("pedido_itens")
            .select("preco_unitario, pedidos!inner(cliente_id)")
            .eq("produto_id", produto.id)
            .eq("pedidos.cliente_id", clienteId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastItem) {
            precoUnitario = Number(lastItem.preco_unitario);
          }
        } catch (err) {
          console.error("Erro ao buscar último preço:", err);
        }
      }

      const newItem: ItemVenda = {
        id: crypto.randomUUID(),
        produto_id: produto.id,
        nome: produto.nome,
        quantidade: 1,
        preco_unitario: precoUnitario,
        total: precoUnitario,
      };
      onChange([...itens, newItem]);
    }

    setSearchTerm("");
    setShowResults(false);
    setSearchResults([]);
  };

  const updateQuantity = (index: number, delta: number) => {
    const newItens = [...itens];
    const newQtd = newItens[index].quantidade + delta;
    if (newQtd < 1) return;
    newItens[index].quantidade = newQtd;
    newItens[index].total = newQtd * newItens[index].preco_unitario;
    onChange(newItens);
  };

  const updatePrecoUnitario = (index: number, valor: number) => {
    const newItens = [...itens];
    newItens[index].preco_unitario = valor;
    newItens[index].total = newItens[index].quantidade * valor;
    onChange(newItens);
  };

  const removeItem = (index: number) => {
    const newItens = itens.filter((_, i) => i !== index);
    onChange(newItens);
  };

  const total = itens.reduce((acc, item) => acc + item.total, 0);

  return (
    <Card ref={searchRef}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-5 w-5" />
          Produtos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto por nome..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              searchProdutos(e.target.value);
            }}
            className="pl-10"
          />

          {/* Autocomplete Results */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 w-full min-w-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
              {searchResults.map((produto) => (
                <button
                  key={produto.id}
                  className="w-full min-w-0 px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-0 flex justify-between items-center gap-2"
                  onClick={() => addItem(produto)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{produto.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Estoque: {produto.estoque ?? "N/A"}
                    </p>
                  </div>
                  <span className="font-semibold text-primary shrink-0 text-sm">
                    R$ {produto.preco.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items Table */}
        {itens.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto">
            <Table className="min-w-0">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12 hidden sm:table-cell">Cód.</TableHead>
                  <TableHead className="px-2 sm:px-4">Produto</TableHead>
                  <TableHead className="w-[110px] sm:w-28 text-center px-1 sm:px-4">Qtd</TableHead>
                  <TableHead className="w-20 sm:w-24 text-right px-1 sm:px-4">Unit.</TableHead>
                  <TableHead className="w-20 sm:w-24 text-right hidden sm:table-cell">Total</TableHead>
                  <TableHead className="w-10 px-1 sm:px-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground hidden sm:table-cell">
                      {item.produto_id.slice(0, 4)}
                    </TableCell>
                    <TableCell className="font-medium px-2 sm:px-4 py-2 sm:py-4">
                      <div className="min-w-0">
                        <p className="text-sm break-words">{item.nome}</p>
                        <p className="text-xs font-semibold text-primary sm:hidden mt-0.5">
                          R$ {item.total.toFixed(2)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-1 sm:px-4 py-2 sm:py-4">
                      <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => updateQuantity(index, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantidade}
                          onChange={(e) => {
                            const newQtd = parseInt(e.target.value) || 1;
                            if (newQtd < 1) return;
                            const newItens = [...itens];
                            newItens[index].quantidade = newQtd;
                            newItens[index].total = newQtd * newItens[index].preco_unitario;
                            onChange(newItens);
                          }}
                          className="w-10 sm:w-16 text-center h-7 text-sm px-1"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => updateQuantity(index, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-1 sm:px-4 py-2 sm:py-4">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.preco_unitario}
                        onChange={(e) => updatePrecoUnitario(index, Number(e.target.value))}
                        className="w-16 sm:w-24 text-right h-8 text-sm px-1 sm:px-3"
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold hidden sm:table-cell">
                      R$ {item.total.toFixed(2)}
                    </TableCell>
                    <TableCell className="px-1 sm:px-4 py-2 sm:py-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum produto adicionado</p>
            <p className="text-xs">Busque e selecione produtos acima</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
