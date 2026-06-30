import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, Droplets, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Produto {
  id: string;
  nome: string;
  preco: number;
  estoque: number | null;
  categoria: string | null;
  image_url: string | null;
}

interface PDVQuickProductsProps {
  onSelectProduct: (produto: Produto) => void;
  unidadeId?: string | null;
}

export function PDVQuickProducts({ onSelectProduct, unidadeId }: PDVQuickProductsProps) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProdutos = async () => {
      try {
        let query = supabase
          .from("produtos")
          .select("id, nome, preco, estoque, categoria, image_url")
          .eq("ativo", true)
          
          .order("nome")
          .limit(12);

        if (unidadeId) {
          query = query.eq("unidade_id", unidadeId);
        }

        const { data, error } = await query;

        if (!error && data) {
          setProdutos(data as Produto[]);
        }
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProdutos();
  }, [unidadeId]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {produtos.map((produto) => {
        const isGas = produto.categoria === "gas";
        const isAgua = produto.categoria === "agua";
        const estoqueBaixo = (produto.estoque ?? 0) <= 5;
        const FallbackIcon = isGas ? Flame : isAgua ? Droplets : Package;

        return (
          <Button
            key={produto.id}
            variant="outline"
            className={`h-28 flex-col items-center justify-start gap-1 p-2 whitespace-normal ${
              estoqueBaixo ? "border-warning/50" : ""
            } ${isGas ? "bg-primary/5 hover:bg-primary/10" : ""}`}
            onClick={() => onSelectProduct(produto)}
            disabled={(produto.estoque ?? 0) === 0}
          >
            <div className="h-10 w-10 shrink-0 rounded-md bg-primary/10 flex items-center justify-center overflow-hidden">
              {produto.image_url ? (
                <img
                  src={produto.image_url}
                  alt={produto.nome}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <FallbackIcon className="h-5 w-5 text-primary" />
              )}
            </div>
            <span className="text-xs font-medium text-center line-clamp-2 leading-tight min-h-[2rem]">
              {produto.nome}
            </span>
            <span className="text-sm font-bold text-primary leading-none">
              R$ {produto.preco.toFixed(2)}
            </span>
            <span className="text-[10px] text-muted-foreground leading-none">
              Est: {produto.estoque ?? 0}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
