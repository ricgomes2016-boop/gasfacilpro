import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClienteLayout } from "@/components/cliente/ClienteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCliente } from "@/contexts/ClienteContext";
import { 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Tag, 
  Wallet,
  ArrowRight,
  Percent
} from "lucide-react";
import { toast } from "sonner";

export default function ClienteCarrinho() {
  const navigate = useNavigate();
  const { 
    cart, 
    removeFromCart, 
    updateQuantity, 
    cartTotal, 
    cartItemsCount,
    walletBalance,
    applyCoupon
  } = useCliente();
  
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [useWallet, setUseWallet] = useState(false);

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    
    const result = applyCoupon(couponCode);
    if (result.valid) {
      setAppliedCoupon({ code: couponCode.toUpperCase(), discount: result.discount });
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    setCouponCode("");
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    toast.info("Cupom removido");
  };

  const couponDiscount = appliedCoupon ? (cartTotal * appliedCoupon.discount) / 100 : 0;
  const walletDiscount = useWallet ? Math.min(walletBalance, cartTotal - couponDiscount) : 0;
  const finalTotal = cartTotal - couponDiscount - walletDiscount;

  if (cart.length === 0) {
    return (
      <ClienteLayout cartItemsCount={0}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Carrinho vazio</h2>
          <p className="text-muted-foreground mb-4">
            Adicione produtos para continuar
          </p>
          <Button asChild>
            <Link to="/cliente">Ver Produtos</Link>
          </Button>
        </div>
      </ClienteLayout>
    );
  }

  return (
    <ClienteLayout cartItemsCount={cartItemsCount}>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Meu Carrinho</h1>

        {/* Cart Items */}
        <div className="space-y-3">
          {cart.map(item => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                    {item.image && item.image.startsWith("http") ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement!.textContent = "🛒";
                        }}
                      />
                    ) : (
                      <span>{item.image || "🛒"}</span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-8 w-8"
                        onClick={() => {
                          removeFromCart(item.id);
                          toast.info(`${item.name} removido do carrinho`);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border rounded-lg">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <span className="font-semibold">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Coupon Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Cupom de Desconto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appliedCoupon ? (
              <div className="flex items-center justify-between bg-primary/10 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  <span className="font-medium">{appliedCoupon.code}</span>
                  <span className="text-sm text-muted-foreground">
                    (-{appliedCoupon.discount}%)
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={removeCoupon}>
                  Remover
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o cupom"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                />
                <Button onClick={handleApplyCoupon}>Aplicar</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wallet Section */}
        {walletBalance > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Usar saldo da carteira</p>
                    <p className="text-sm text-muted-foreground">
                      Disponível: R$ {walletBalance.toFixed(2)}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useWallet}
                    onChange={(e) => setUseWallet(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resumo do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal ({cartItemsCount} itens)</span>
              <span>R$ {cartTotal.toFixed(2)}</span>
            </div>
            
            {couponDiscount > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Desconto cupom ({appliedCoupon?.discount}%)</span>
                <span>-R$ {couponDiscount.toFixed(2)}</span>
              </div>
            )}
            
            {walletDiscount > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Saldo carteira</span>
                <span>-R$ {walletDiscount.toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Entrega</span>
              <span className="text-success">Grátis</span>
            </div>
            
            <Separator />
            
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span className="text-primary">R$ {finalTotal.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Checkout Button */}
        <Button 
          className="w-full h-12 text-lg gap-2"
          onClick={() => navigate("/cliente/checkout", { 
            state: { 
              couponDiscount,
              walletDiscount,
              useWallet,
              appliedCoupon,
              finalTotal
            }
          })}
        >
          Continuar
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </ClienteLayout>
  );
}
