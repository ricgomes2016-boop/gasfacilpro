import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PdvProductCard, PdvProductLike } from "./PdvProductCard";
import { cn } from "@/lib/utils";

interface PDVQuickProductsProps {
  onSelectProduct: (produto: PdvProductLike) => void;
  onIncrement?: (produto: PdvProductLike) => void;
  onDecrement?: (produto: PdvProductLike) => void;
  getQuantidade?: (produtoId: string) => number;
  unidadeId?: string | null;
}

type Filtro = "todos" | "gas" | "agua" | "acessorios" | "disponiveis";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "disponiveis", label: "Disponíveis" },
  { id: "gas", label: "Gás" },
  { id: "agua", label: "Água" },
  { id: "acessorios", label: "Acessórios" },
];

export function PDVQuickProducts({
  onSelectProduct,
  onIncrement,
  onDecrement,
  getQuantidade,
  unidadeId,
}: PDVQuickProductsProps) {
  const [produtos, setProdutos] = useState<PdvProductLike[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  useEffect(() => {
    const fetchProdutos = async () => {
      try {
        let query = supabase
          .from("produtos")
          .select("id, nome, preco, estoque, categoria, image_url")
          .eq("ativo", true)
          .order("nome")
          .limit(24);

        if (unidadeId) {
          query = query.eq("unidade_id", unidadeId);
        }

        const { data, error } = await query;
        if (!error && data) setProdutos(data as PdvProductLike[]);
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProdutos();
  }, [unidadeId]);

  const categoriasPresentes = useMemo(() => {
    const set = new Set(produtos.map((p) => (p.categoria || "").toLowerCase()));
    return set;
  }, [produtos]);

  const filtrosVisiveis = useMemo(
    () =>
      FILTROS.filter((f) => {
        if (f.id === "todos" || f.id === "disponiveis") return true;
        return categoriasPresentes.has(f.id);
      }),
    [categoriasPresentes]
  );

  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      if (filtro === "todos") return true;
      if (filtro === "disponiveis") return (p.estoque ?? 0) > 0;
      return (p.categoria || "").toLowerCase() === filtro;
    });
  }, [produtos, filtro]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-[18px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filtrosVisiveis.length > 1 && (
        <div className="-mx-1 overflow-x-auto">
          <div className="flex items-center gap-1.5 px-1 pb-1">
            {filtrosVisiveis.map((f) => (
              <Button
                key={f.id}
                variant={filtro === f.id ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-semibold whitespace-nowrap",
                  filtro !== f.id && "bg-card"
                )}
                onClick={() => setFiltro(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {produtosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {produtosFiltrados.map((produto) => {
            const qtd = getQuantidade?.(produto.id) ?? 0;
            return (
              <PdvProductCard
                key={produto.id}
                produto={produto}
                quantidadeNoCarrinho={qtd}
                onAdd={() => onSelectProduct(produto)}
                onIncrement={onIncrement ? () => onIncrement(produto) : undefined}
                onDecrement={onDecrement ? () => onDecrement(produto) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
