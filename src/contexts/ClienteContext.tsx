import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface WalletTransaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  date: Date;
  referralName?: string;
}

interface ValeGas {
  id: string;
  code: string;
  value: number;
  partner: string;
  expiryDate: Date;
  used: boolean;
}

interface Purchase {
  id: string;
  date: Date;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  status: "pending" | "confirmed" | "delivered";
  discountApplied?: number;
}

export interface LojaOption {
  id: string;
  nome: string;
  cidade: string | null;
  bairro: string | null;
}

export interface EmpresaInfo {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
}

interface ClienteContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartItemsCount: number;
  
  walletBalance: number;
  walletTransactions: WalletTransaction[];
  useWalletBalance: (amount: number) => void;
  
  referralCode: string;
  referralCount: number;
  
  valesGas: ValeGas[];
  
  purchases: Purchase[];
  addPurchase: (purchase: Omit<Purchase, "id">) => void;
  
  applyCoupon: (code: string) => { valid: boolean; discount: number; message: string };

  // Loja selecionada
  lojas: LojaOption[];
  lojaSelecionadaId: string | null;
  setLojaSelecionadaId: (id: string) => void;
  lojasLoading: boolean;

  // Empresa do cliente
  empresaInfo: EmpresaInfo | null;
  empresaSlug: string | null;
}

const ClienteContext = createContext<ClienteContextType | undefined>(undefined);

export function ClienteProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [referralCode, setReferralCode] = useState("CLIENTE");
  const [referralCount, setReferralCount] = useState(0);
  
  const [valesGas] = useState<ValeGas[]>([]);
  
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  // Empresa
  const [empresaInfo, setEmpresaInfo] = useState<EmpresaInfo | null>(null);
  const [empresaSlug, setEmpresaSlug] = useState<string | null>(null);

  // Loja
  const [lojas, setLojas] = useState<LojaOption[]>([]);
  const [lojaSelecionadaId, setLojaSelecionadaIdState] = useState<string | null>(
    localStorage.getItem("cliente_loja_id")
  );
  const [lojasLoading, setLojasLoading] = useState(true);

  // Resolve empresa: from URL param, localStorage, or user profile
  useEffect(() => {
    const resolveEmpresa = async () => {
      // Priority 0: URL param ?u=<slug-da-unidade> → resolve a empresa via unidade
      const unidadeSlugFromUrl = searchParams.get("u") || localStorage.getItem("cliente_unidade_slug");
      if (unidadeSlugFromUrl) {
        const { data: uData } = await supabase.rpc("get_unidade_by_slug", { _slug: unidadeSlugFromUrl });
        const row = Array.isArray(uData) ? uData[0] : uData;
        if (row?.empresa_slug) {
          localStorage.setItem("cliente_unidade_slug", unidadeSlugFromUrl);
          localStorage.setItem("cliente_empresa_slug", row.empresa_slug);
          localStorage.setItem("cliente_loja_id", row.id);
          setEmpresaSlug(row.empresa_slug);
          setEmpresaInfo({
            id: row.empresa_id,
            nome: row.empresa_nome,
            slug: row.empresa_slug,
            logo_url: row.logo_url || row.empresa_logo_url || null,
          } as EmpresaInfo);
          setLojaSelecionadaIdState(row.id);
          return;
        }
      }

      // Priority 1: URL param ?empresa=slug
      const slugFromUrl = searchParams.get("empresa");
      // Priority 2: localStorage
      const savedSlug = localStorage.getItem("cliente_empresa_slug");
      // Priority 3: user profile empresa_id
      
      const slug = slugFromUrl || savedSlug;
      
      if (slug) {
        setEmpresaSlug(slug);
        localStorage.setItem("cliente_empresa_slug", slug);
        
        const { data } = await supabase.rpc("get_empresa_by_slug", { _slug: slug });
        if (data && data.length > 0) {
          setEmpresaInfo(data[0] as EmpresaInfo);
        }
      } else if (user && (profile as any)?.empresa_id) {
        // Resolve from profile empresa_id
        const { data } = await supabase
          .from("empresas")
          .select("id, nome, slug, logo_url")
          .eq("id", (profile as any).empresa_id)
          .single();
        if (data) {
          setEmpresaInfo(data as EmpresaInfo);
          setEmpresaSlug(data.slug);
          localStorage.setItem("cliente_empresa_slug", data.slug);
        }
      }
    };
    resolveEmpresa();
  }, [searchParams, user, profile]);

  // Fetch lojas filtered by empresa
  useEffect(() => {
    const fetchLojas = async () => {
      setLojasLoading(true);
      
      let query = supabase
        .from("unidades")
        .select("id, nome, cidade, bairro")
        .eq("ativo", true)
        .order("nome");
      
      // Filter by empresa if known
      if (empresaInfo?.id) {
        query = query.eq("empresa_id", empresaInfo.id);
      }
      
      const { data } = await query;
      if (data && data.length > 0) {
        setLojas(data);
        // Auto-select if only one or if saved is valid
        const saved = localStorage.getItem("cliente_loja_id");
        if (saved && data.some(l => l.id === saved)) {
          setLojaSelecionadaIdState(saved);
        } else if (data.length === 1) {
          setLojaSelecionadaIdState(data[0].id);
          localStorage.setItem("cliente_loja_id", data[0].id);
        }
      } else {
        setLojas([]);
      }
      setLojasLoading(false);
    };
    
    // Only fetch when empresa is resolved (or if no empresa context at all)
    if (empresaInfo || (!searchParams.get("empresa") && !localStorage.getItem("cliente_empresa_slug"))) {
      fetchLojas();
    }
  }, [empresaInfo, searchParams]);

  useEffect(() => {
    const fetchIndicacoesCarteira = async () => {
      if (!user || !empresaInfo?.id || !profile) return;

      const { data: resumo } = await (supabase as any).rpc("get_cliente_indicacao_resumo");
      if (!resumo) return;

      setReferralCode(resumo.codigo_indicacao || "CLIENTE");
      setReferralCount(Number(resumo.referral_count) || 0);
      setWalletBalance(Number(resumo.wallet_balance) || 0);
      setWalletTransactions((resumo.transactions || []).map((item: any) => ({
        id: item.id,
        type: item.type === "debit" ? "debit" : "credit",
        amount: Number(item.amount) || 0,
        description: item.description,
        date: new Date(item.date),
      })) as WalletTransaction[]);
    };

    fetchIndicacoesCarteira();
  }, [user, profile, empresaInfo?.id]);

  const setLojaSelecionadaId = (id: string) => {
    setLojaSelecionadaIdState(id);
    localStorage.setItem("cliente_loja_id", id);
  };

  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const useWalletBalance = (amount: number) => {
    if (amount > walletBalance) return;
    setWalletBalance(prev => prev - amount);
    setWalletTransactions(prev => [
      {
        id: Date.now().toString(),
        type: "debit",
        amount,
        description: "Usado em compra",
        date: new Date()
      },
      ...prev
    ]);
  };

  const addPurchase = (purchase: Omit<Purchase, "id">) => {
    setPurchases(prev => [
      { ...purchase, id: Date.now().toString() },
      ...prev
    ]);
    clearCart();
  };

  const applyCoupon = (code: string) => {
    const coupons: Record<string, { discount: number; message: string }> = {
      "PRIMEIRACOMPRA": { discount: 10, message: "10% de desconto na primeira compra!" },
      "FIDELIDADE": { discount: 5, message: "5% de desconto para cliente fiel!" },
    };
    
    const coupon = coupons[code.toUpperCase()];
    if (coupon) {
      return { valid: true, ...coupon };
    }
    return { valid: false, discount: 0, message: "Cupom inválido ou expirado" };
  };

  return (
    <ClienteContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartTotal,
      cartItemsCount,
      walletBalance,
      walletTransactions,
      useWalletBalance,
      referralCode,
      referralCount,
      valesGas,
      purchases,
      addPurchase,
      applyCoupon,
      lojas,
      lojaSelecionadaId,
      setLojaSelecionadaId,
      lojasLoading,
      empresaInfo,
      empresaSlug,
    }}>
      {children}
    </ClienteContext.Provider>
  );
}

export function useCliente() {
  const context = useContext(ClienteContext);
  if (!context) {
    throw new Error("useCliente must be used within ClienteProvider");
  }
  return context;
}
