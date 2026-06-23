import { useState, useEffect } from "react";
import { ClienteLayout } from "@/components/cliente/ClienteLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCliente } from "@/contexts/ClienteContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { resolveClienteIdForUser } from "@/lib/clienteAppLookup";
import { Search, Plus, Minus, ShoppingCart, Flame, Droplets, Package, RotateCcw, Zap, Star, Clock, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ProdutoDB {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  categoria: string | null;
  image_url: string | null;
  estoque: number | null;
}

const categoryIcons: Record<string, typeof Flame> = {
  gas: Flame,
  agua: Droplets,
};

const categories = ["Todos", "gas", "agua", "acessorios"];
const categoryLabels: Record<string, string> = {
  Todos: "Todos",
  gas: "🔥 Gás",
  agua: "💧 Água",
  acessorios: "🔧 Acessórios",
};

interface UltimoPedido {
  id: string;
  valor_total: number;
  created_at: string;
  itens: { nome: string; quantidade: number; produto_id: string; preco: number }[];
}

export default function ClienteHome() {
  const { addToCart, cartItemsCount, cart, empresaInfo, lojaSelecionadaId } = useCliente();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [produtos, setProdutos] = useState<ProdutoDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ultimoPedido, setUltimoPedido] = useState<UltimoPedido | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [imageFallbacks, setImageFallbacks] = useState<Record<string, string>>({});

  useEffect(() => {
    setIsLoading(true);
    const fetchProdutos = async () => {
      try {
        let query = supabase
          .from("produtos")
          .select("id, nome, descricao, preco, categoria, image_url, estoque")
          .eq("ativo", true)
          .or("tipo_botijao.is.null,tipo_botijao.neq.vazio")
          .order("nome");

        if (lojaSelecionadaId) {
          query = query.eq("unidade_id", lojaSelecionadaId);
        }

        const { data, error } = await query;

        if (!error && data) {
          setProdutos(data);
        }
      } catch (err) {
        console.error("Erro ao buscar produtos:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProdutos();
  }, [lojaSelecionadaId]);

  // Fallback: buscar imagens da empresa quando a loja não tem image_url
  useEffect(() => {
    const missing = produtos.filter(p => !p.image_url).map(p => p.nome);
    if (missing.length === 0 || !empresaInfo?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("produtos")
        .select("nome, image_url, unidades!inner(empresa_id)")
        .eq("unidades.empresa_id", empresaInfo.id)
        .in("nome", missing)
        .not("image_url", "is", null);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((row: any) => {
          if (row.image_url && !map[row.nome]) map[row.nome] = row.image_url;
        });
        setImageFallbacks(map);
      }
    })();
  }, [produtos, empresaInfo?.id]);

  const [pedidoAtivo, setPedidoAtivo] = useState<{ id: string; status: string } | null>(null);

  // Fetch último pedido e pedido em andamento do cliente
  useEffect(() => {
    const fetchPedidos = async () => {
      if (!user) return;

      // Resolve empresa
      const { data: profileData } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const empresaId = (profileData as any)?.empresa_id;
      if (!empresaId) return;

      const userPhone = (user as any)?.phone || (user.user_metadata as any)?.telefone || null;
      const clienteId = await resolveClienteIdForUser({
        userId: user.id,
        empresaId,
        email: user.email,
        phone: userPhone,
      });

      if (!clienteId) return;
      const clienteData = { id: clienteId };

      // Último pedido entregue (para "Pedir de novo")
      const { data } = await supabase
        .from("pedidos")
        .select(`
          id, valor_total, created_at,
          pedido_itens (quantidade, preco_unitario, produto_id, produtos:produto_id (nome))
        `)
        .eq("cliente_id", clienteData.id)
        .eq("status", "entregue")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setUltimoPedido({
          id: data.id,
          valor_total: data.valor_total || 0,
          created_at: data.created_at,
          itens: ((data as any).pedido_itens || []).map((i: any) => ({
            nome: i.produtos?.nome || "Produto",
            quantidade: i.quantidade,
            produto_id: i.produto_id,
            preco: i.preco_unitario,
          })),
        });
      }

      // Pedido em andamento
      const { data: ativo } = await supabase
        .from("pedidos")
        .select("id, status")
        .eq("cliente_id", clienteData.id)
        .in("status", ["pendente", "em_rota"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ativo) {
        setPedidoAtivo({ id: ativo.id, status: ativo.status || "pendente" });

        // Realtime: limpar quando concluir
        const channel = supabase
          .channel(`home-pedido-${ativo.id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${ativo.id}` },
            (payload) => {
              const novoStatus = (payload.new as any).status;
              if (novoStatus === "entregue" || novoStatus === "cancelado") {
                setPedidoAtivo(null);
              } else {
                setPedidoAtivo({ id: ativo.id, status: novoStatus });
              }
            }
          )
          .subscribe();

        return () => { supabase.removeChannel(channel); };
      }
    };
    fetchPedidos();
  }, [user]);

  const filteredProducts = produtos.filter(product => {
    const matchesSearch = product.nome.toLowerCase().includes(search.toLowerCase()) ||
      (product.descricao || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "Todos" || product.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getQuantity = (productId: string) => quantities[productId] ?? 0;

  const setQuantity = (productId: string, qty: number) => {
    if (qty < 0) qty = 0;
    if (qty > 10) qty = 10;
    setQuantities(prev => ({ ...prev, [productId]: qty }));
  };

  const handleAddToCart = async (product: ProdutoDB) => {
    setAddingToCart(product.id);
    const current = getQuantity(product.id);
    const qty = current === 0 ? 1 : current;
    addToCart({
      id: product.id,
      name: product.nome,
      description: product.descricao || "",
      price: product.preco,
      image: product.image_url || "📦",
      category: product.categoria || "outros"
    }, qty);
    toast.success(`${qty}x ${product.nome} adicionado!`, {
      action: {
        label: "Ver carrinho",
        onClick: () => navigate("/cliente/carrinho"),
      },
    });
    setQuantities(prev => ({ ...prev, [product.id]: 0 }));
    setTimeout(() => setAddingToCart(null), 600);
  };

  const getCartQuantity = (productId: string) => {
    const item = cart.find(i => i.id === productId);
    return item?.quantity || 0;
  };

  const handleRepetirUltimoPedido = () => {
    if (!ultimoPedido) return;
    ultimoPedido.itens.forEach(item => {
      addToCart({
        id: item.produto_id,
        name: item.nome,
        description: "",
        price: item.preco,
        image: "📦",
        category: "",
      }, item.quantidade);
    });
    toast.success("Itens do último pedido adicionados ao carrinho!");
  };

  const ProductIcon = (cat: string | null) => categoryIcons[cat || ""] || Package;

  const gasProducts = filteredProducts.filter(p => p.categoria === "gas");
  const otherProducts = filteredProducts.filter(p => p.categoria !== "gas");
  const showGrouped = selectedCategory === "Todos" && !search;

  return (
    <ClienteLayout cartItemsCount={cartItemsCount}>
      <div className="space-y-4 pb-24">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground p-5">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 fill-current" />
              <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Entrega rápida</span>
            </div>
            <h1 className="text-2xl font-bold leading-tight">Gás e Água<br />na sua porta! 🚀</h1>
            <p className="text-primary-foreground/80 text-sm mt-1">
              Peça agora e receba em até 1 hora
            </p>
          <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1 bg-primary-foreground/20 rounded-full px-2 py-0.5">
                <Star className="h-3 w-3 fill-current" />
                <span className="text-xs font-bold">4.9</span>
              </div>
              <div className="flex items-center gap-1 bg-primary-foreground/20 rounded-full px-2 py-0.5">
                <Clock className="h-3 w-3" />
                <span className="text-xs font-bold">30-60 min</span>
              </div>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -right-4 -bottom-6 w-20 h-20 bg-white/10 rounded-full" />
        </div>

        {/* Pedido em andamento */}
        {pedidoAtivo && (
          <button
            onClick={() => navigate(`/cliente/rastreamento/${pedidoAtivo.id}`)}
            className="w-full text-left"
          >
            <Card className="border-primary bg-primary text-primary-foreground shadow-md">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 bg-primary-foreground/20 rounded-full flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">Pedido em andamento</p>
                      <p className="text-xs opacity-90 truncate">
                        {pedidoAtivo.status === "em_rota" ? "A caminho — toque para acompanhar" : "Aguardando confirmação da loja"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </div>
              </CardContent>
            </Card>
          </button>
        )}

        {/* Repetir último pedido */}
        {ultimoPedido && (
          <button
            onClick={handleRepetirUltimoPedido}
            className="w-full text-left"
          >
            <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent hover:from-primary/10 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <RotateCcw className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground">Pedir de novo</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {ultimoPedido.itens.map(i => `${i.quantidade}x ${i.nome}`).join(", ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-bold text-primary">R$ {ultimoPedido.valor_total.toFixed(2)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-muted/50 border-0 focus-visible:bg-background"
          />
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={`whitespace-nowrap rounded-full h-8 px-4 text-xs font-medium transition-all ${
                selectedCategory === category 
                  ? "shadow-md shadow-primary/30" 
                  : "border-border/50"
              }`}
            >
              {categoryLabels[category] || category}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Grouped view: Gas first as featured */}
            {showGrouped && gasProducts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-destructive" />
                  <h2 className="font-bold text-base">Gás</h2>
                </div>
                {gasProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={getQuantity(product.id)}
                    cartQty={getCartQuantity(product.id)}
                    onQuantityChange={(delta) => setQuantity(product.id, getQuantity(product.id) + delta)}
                    onAddToCart={() => handleAddToCart(product)}
                    isAdding={addingToCart === product.id}
                    resolvedImage={product.image_url || imageFallbacks[product.nome] || null}
                  />
                ))}
              </div>
            )}

            {showGrouped && otherProducts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-primary" />
                  <h2 className="font-bold text-base">Água & Outros</h2>
                </div>
                {otherProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={getQuantity(product.id)}
                    cartQty={getCartQuantity(product.id)}
                    onQuantityChange={(delta) => setQuantity(product.id, getQuantity(product.id) + delta)}
                    onAddToCart={() => handleAddToCart(product)}
                    isAdding={addingToCart === product.id}
                    resolvedImage={product.image_url || imageFallbacks[product.nome] || null}
                  />
                ))}
              </div>
            )}

            {/* Filtered view */}
            {!showGrouped && (
              <div className="space-y-3">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={getQuantity(product.id)}
                    cartQty={getCartQuantity(product.id)}
                    onQuantityChange={(delta) => setQuantity(product.id, getQuantity(product.id) + delta)}
                    onAddToCart={() => handleAddToCart(product)}
                    isAdding={addingToCart === product.id}
                    resolvedImage={product.image_url || imageFallbacks[product.nome] || null}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!isLoading && filteredProducts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-14 w-14 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum produto encontrado</p>
            <p className="text-sm mt-1">Tente outra busca ou categoria</p>
          </div>
        )}

        {/* Botão flutuante global vem do ClienteLayout */}
      </div>
    </ClienteLayout>
  );
}

// Product Card Component
interface ProductCardProps {
  product: ProdutoDB;
  quantity: number;
  cartQty: number;
  onQuantityChange: (delta: number) => void;
  onAddToCart: () => void;
  isAdding: boolean;
  resolvedImage?: string | null;
}

function ProductCard({ product, quantity, cartQty, onQuantityChange, onAddToCart, isAdding, resolvedImage }: ProductCardProps) {
  const isOutOfStock = (product.estoque ?? 1) === 0;
  const Icon = product.categoria === "agua" ? Droplets : product.categoria === "gas" ? Flame : Package;
  const imgSrc = resolvedImage ?? product.image_url ?? null;

  return (
    <Card className={`overflow-hidden border-border/60 transition-all duration-200 active:scale-[0.985] ${isAdding ? "scale-[0.98] shadow-sm" : "hover:shadow-md hover:border-primary/30"}`}>
      <CardContent className="p-2">
        <div className="flex gap-3 items-stretch">
          {/* Product Image */}
          <div className="w-28 h-28 shrink-0 flex items-center justify-center rounded-xl overflow-hidden relative bg-gradient-to-br from-muted/60 via-muted/30 to-muted/10 ring-1 ring-border/40">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={product.nome}
                className="w-full h-full object-contain p-2 drop-shadow-sm"
                loading="lazy"
              />
            ) : (
              <Icon className="h-12 w-12 text-primary/40" />
            )}
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center backdrop-blur-[1px]">
                <span className="text-white text-xs font-bold">Indisponível</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 py-1 pr-1 flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-start justify-between gap-1">
                <h3 className="font-bold text-sm leading-tight">{product.nome}</h3>
                {cartQty > 0 && (
                  <Badge className="bg-primary/10 text-primary border-0 shrink-0 text-[10px] px-1.5 whitespace-nowrap">
                    {cartQty} no carrinho
                  </Badge>
                )}
              </div>
              {product.descricao && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{product.descricao}</p>
              )}
            </div>

            <div className="flex items-center justify-between mt-2 gap-2">
              <span className="text-lg font-black text-primary tracking-tight">
                R$ {product.preco.toFixed(2)}
              </span>

              <div className="flex items-center gap-1.5">
                <div className={`flex items-center border rounded-lg overflow-hidden bg-background transition-opacity ${quantity === 0 ? "border-border/50 opacity-60" : "border-border"}`}>
                  <button
                    className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                    onClick={() => onQuantityChange(-1)}
                    disabled={quantity === 0 || isOutOfStock}
                    aria-label="Diminuir quantidade"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className={`w-7 text-center text-sm font-bold ${quantity === 0 ? "text-muted-foreground" : ""}`}>{quantity}</span>
                  <button
                    className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
                    onClick={() => onQuantityChange(1)}
                    disabled={isOutOfStock}
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                <Button
                  size="sm"
                  onClick={onAddToCart}
                  disabled={isOutOfStock || isAdding}
                  className={`h-7 px-3 rounded-lg text-xs font-bold transition-all ${isAdding ? "bg-green-600 hover:bg-green-600" : ""}`}
                >
                  {isAdding ? "✓" : <><ShoppingCart className="h-3 w-3 mr-1" />Add</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
