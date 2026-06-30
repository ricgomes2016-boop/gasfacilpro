import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Search, Trash2, Plus, Minus, ShoppingBasket, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import gasP13Img from "@/assets/products/gas-p13.png";
import gasP20Img from "@/assets/products/gas-p20.png";
import gasP45Img from "@/assets/products/gas-p45.png";
import agua20lImg from "@/assets/products/agua-20l.png";
import { VendaSectionHeader } from "./VendaSectionHeader";
import { cn } from "@/lib/utils";

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

const produtosPrincipais = [
  { label: "Gás P13", aliases: ["gas p13", "gás p13", "p13"], image: gasP13Img, tone: "text-warning", surface: "bg-warning/10", ring: "ring-warning/35" },
  { label: "Gás P20", aliases: ["gas p20", "gás p20", "p20"], image: gasP20Img, tone: "text-info", surface: "bg-info/10", ring: "ring-info/35" },
  { label: "Gás P45", aliases: ["gas p45", "gás p45", "p45"], image: gasP45Img, tone: "text-primary", surface: "bg-primary/10", ring: "ring-primary/35" },
  { label: "Água Mineral 20L", aliases: ["agua mineral 20", "água mineral 20", "agua 20", "20l"], image: agua20lImg, tone: "text-info", surface: "bg-info/10", ring: "ring-info/35" },
  { label: "Kit Regulador 13kg", aliases: ["kit regulador", "regulador 13", "regulador"], image: null, tone: "text-foreground", surface: "bg-muted", ring: "ring-border" },
];

export function ProductSearch({ itens, onChange, unidadeId, clienteId }: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Produto[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const buscarProdutoPrincipal = async (atalho: typeof produtosPrincipais[number]) => {
    try {
      let query = supabase
        .from("produtos")
        .select("id, nome, preco, estoque")
        .eq("ativo", true)
        .limit(100);

      if (unidadeId) query = query.eq("unidade_id", unidadeId);

      const { data, error } = await query;
      if (error || !data) return;

      const produto = data.find((p) => {
        const nome = normalize(p.nome);
        return atalho.aliases.some((alias) => nome.includes(normalize(alias)));
      });

      if (produto) {
        await addItem(produto);
      } else {
        setSearchTerm(atalho.label);
        searchProdutos(atalho.label);
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Erro ao buscar produto principal:", error);
    }
  };

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
      // Priority: 1) negotiated price for client, 2) last price paid, 3) default
      let precoUnitario = produto.preco;
      if (clienteId) {
        try {
          const { data: precoNeg } = await supabase
            .from("cliente_precos_negociados")
            .select("preco_negociado")
            .eq("cliente_id", clienteId)
            .eq("produto_id", produto.id)
            .eq("ativo", true)
            .maybeSingle();
          if (precoNeg) {
            precoUnitario = Number(precoNeg.preco_negociado);
          } else {
            const { data: lastItem } = await supabase
              .from("pedido_itens")
              .select("preco_unitario, pedidos!inner(cliente_id)")
              .eq("produto_id", produto.id)
              .eq("pedidos.cliente_id", clienteId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (lastItem) precoUnitario = Number(lastItem.preco_unitario);
          }
        } catch (err) {
          console.error("Erro ao buscar preço negociado/último:", err);
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

  const isProdutoPrincipalSelecionado = (atalho: typeof produtosPrincipais[number]) => {
    return itens.some((item) => {
      const nome = normalize(item.nome);
      return atalho.aliases.some((alias) => nome.includes(normalize(alias)));
    });
  };

  const total = itens.reduce((acc, item) => acc + item.total, 0);

  return (
    <Card ref={searchRef} className="venda-card overflow-hidden">
      <VendaSectionHeader
        title="Produtos"
        icon={<Package className="h-5 w-5" />}
        tone="warning"
        action={
          <div className="rounded-md border border-warning-foreground/20 bg-warning-foreground/10 px-3 py-1.5 text-sm font-semibold text-warning-foreground shadow-sm">
            Total R$ {total.toFixed(2)}
          </div>
        }
      />
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {produtosPrincipais.map((produto) => {
            const selected = isProdutoPrincipalSelecionado(produto);
            return (
            <button
              key={produto.label}
              type="button"
              aria-pressed={selected}
              onClick={() => buscarProdutoPrincipal(produto)}
              data-selected={selected}
              className={cn(
                "venda-product-shortcut group min-h-[132px] rounded-xl border p-3 text-center transition-all duration-200 hover:scale-[1.02] hover:border-primary/35 hover:bg-primary/5 hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                selected ? "ring-2 ring-offset-2 shadow-xl scale-[1.02] ring-primary/40" : produto.ring
              )}
            >
              <span className={cn(
                "mx-auto flex h-16 w-16 items-center justify-center rounded-lg ring-1 transition-transform group-hover:scale-105",
                selected ? "bg-primary-foreground/15 text-primary-foreground ring-primary-foreground/30" : `${produto.surface} ${produto.tone} ${produto.ring}`
              )}>
                {produto.image ? (
                  <img src={produto.image} alt={produto.label} className="h-14 w-14 object-contain" loading="lazy" />
                ) : (
                  <Wrench className="h-8 w-8 drop-shadow-sm" />
                )}
              </span>
              <span className={cn("mt-2 block text-xs font-semibold leading-tight text-center", selected ? "text-primary-foreground" : "text-foreground")}>{produto.label}</span>
            </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="venda-modern-surface relative rounded-lg border p-2 shadow-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Buscar produto por nome..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              searchProdutos(e.target.value);
            }}
            className="h-11 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
            data-venda-enter-skip
          />

          {/* Autocomplete Results */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 w-full min-w-0 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl">
              {searchResults.map((produto) => (
                <button
                  key={produto.id}
                  className="w-full min-w-0 px-4 py-3 text-left hover:bg-primary/10 transition-colors border-b border-border last:border-0 flex justify-between items-center gap-2"
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
          <div className="venda-modern-surface overflow-x-auto rounded-lg border shadow-sm">
            <Table className="min-w-0">
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
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
                  <TableRow key={item.id} className="hover:bg-primary/5">
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
                          data-venda-enter-next
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
                        data-venda-enter-next
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
          <div className="rounded-lg border border-dashed bg-muted/20 py-10 text-center text-muted-foreground">
            <ShoppingBasket className="h-11 w-11 mx-auto mb-3 text-primary/70" />
            <p className="text-sm font-medium text-foreground">Nenhum produto adicionado</p>
            <p className="text-xs">Busque e selecione produtos acima</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
