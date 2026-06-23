import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart,
  Search,
  Trash2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  ScanBarcode,
  CameraOff,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateReceiptPdf, EmpresaConfig } from "@/services/receiptPdfService";
import { atualizarEstoqueVenda } from "@/services/estoqueService";
import { rotearPagamentosVenda } from "@/services/paymentRoutingService";

import { BarcodeScanner } from "@/components/pdv/BarcodeScanner";
import { PDVProductList, PDVItem } from "@/components/pdv/PDVProductList";
import { PDVPayment, PDVPagamento } from "@/components/pdv/PDVPayment";
import { PDVQuickProducts } from "@/components/pdv/PDVQuickProducts";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { CaixaBloqueadoBanner } from "@/components/caixa/CaixaBloqueadoBanner";

interface Produto {
  id: string;
  nome: string;
  preco: number;
  estoque: number | null;
  categoria?: string | null;
  tipo_botijao?: string | null;
  botijao_par_id?: string | null;
}

export default function PDV() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [itens, setItens] = useState<PDVItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Produto[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const total = itens.reduce((acc, item) => acc + item.total, 0);
  const totalItens = itens.reduce((acc, item) => acc + item.quantidade, 0);

  // Focus search input on mount and handle keyboard shortcuts
  useEffect(() => {
    searchInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 - Finalizar venda
      if (e.key === "F12") {
        e.preventDefault();
        if (itens.length > 0) {
          setPaymentOpen(true);
        }
      }
      // Escape - Cancelar/Fechar
      if (e.key === "Escape") {
        if (paymentOpen) {
          setPaymentOpen(false);
        } else if (showResults) {
          setShowResults(false);
          setSearchResults([]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [itens.length, paymentOpen, showResults]);

  // Search products
  const searchProdutos = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    try {
      let query = supabase
        .from("produtos")
        .select("id, nome, preco, estoque, categoria, tipo_botijao, botijao_par_id")
        .eq("ativo", true)
        .or("tipo_botijao.is.null,tipo_botijao.neq.vazio")
        .ilike("nome", `%${term}%`)
        .limit(8);

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data, error } = await query;

      if (!error && data) {
        setSearchResults(data);
        setShowResults(data.length > 0);
      }
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    }
  };

  // Add product to cart
  const addProduct = useCallback((produto: Produto) => {
    setItens((prev) => {
      const existingIndex = prev.findIndex((i) => i.produto_id === produto.id);

      if (existingIndex >= 0) {
        const newItens = [...prev];
        newItens[existingIndex].quantidade += 1;
        newItens[existingIndex].total =
          newItens[existingIndex].quantidade * newItens[existingIndex].preco_unitario;
        return newItens;
      }

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          produto_id: produto.id,
          nome: produto.nome,
          quantidade: 1,
          preco_unitario: produto.preco,
          total: produto.preco,
        },
      ];
    });

    setSearchTerm("");
    setShowResults(false);
    setSearchResults([]);
    searchInputRef.current?.focus();

    // Play beep sound
    const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQgAHoTPxaR2J...")
    audio.volume = 0.3;
    audio.play().catch(() => {});
  }, []);

  // Handle barcode scan
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    try {
      // Try to find product by barcode field first, then fallback to nome/ID
      let { data, error } = await supabase
        .from("produtos")
        .select("id, nome, preco, estoque, categoria, tipo_botijao, botijao_par_id")
        .eq("ativo", true)
        .eq("codigo_barras", barcode)
        .limit(1);

      // If not found by barcode, try nome/ID
      if (!data || data.length === 0) {
        const result = await supabase
          .from("produtos")
          .select("id, nome, preco, estoque, categoria, tipo_botijao, botijao_par_id")
          .eq("ativo", true)
          .or(`nome.ilike.%${barcode}%`)
          .limit(1);
        data = result.data;
        error = result.error;
      }

      if (error || !data || data.length === 0) {
        toast({
          title: "Produto não encontrado",
          description: `Código: ${barcode}`,
          variant: "destructive",
        });
        return;
      }

      addProduct(data[0]);
      toast({
        title: "Produto adicionado",
        description: data[0].nome,
      });
    } catch (error) {
      console.error("Erro ao buscar produto por código:", error);
    }
  }, [addProduct, toast]);

  // Update quantity
  const updateQuantity = (index: number, delta: number) => {
    setItens((prev) => {
      const newItens = [...prev];
      const newQtd = newItens[index].quantidade + delta;
      if (newQtd < 1) return prev;
      newItens[index].quantidade = newQtd;
      newItens[index].total = newQtd * newItens[index].preco_unitario;
      return newItens;
    });
  };

  // Update price
  const updatePrice = (index: number, newPrice: number) => {
    setItens((prev) => {
      const newItens = [...prev];
      newItens[index].preco_unitario = newPrice;
      newItens[index].total = newItens[index].quantidade * newPrice;
      return newItens;
    });
  };

  // Remove item
  const removeItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index));
  };

  // Clear cart
  const clearCart = () => {
    if (itens.length > 0 && !confirm("Limpar todos os itens?")) return;
    setItens([]);
    searchInputRef.current?.focus();
  };

  // Finalize sale
  const finalizeSale = async (pagamentos: PDVPagamento[], _valorRecebidoDinheiro: number) => {
    if (itens.length === 0 || pagamentos.length === 0) return;

    setIsLoading(true);

    try {
      const formaPagamentoLabel =
        pagamentos.length === 1
          ? pagamentos[0].forma
          : `multiplo:${pagamentos.map((p) => p.forma).join("+")}`;

      // Create order
      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          valor_total: total,
          forma_pagamento: formaPagamentoLabel,
          canal_venda: null,
          origem_pedido: "balcao_pdv",
          responsavel_acerto: "portaria",
          status: "finalizado", // PDV: venda imediata, sem acerto com entregador
          endereco_entrega: "Retirada no local",
          unidade_id: unidadeAtual?.id || null,
        } as any)
        .select("id, numero_sequencial")
        .single();

      if (pedidoError) throw pedidoError;

      // Create order items
      const itensInsert = itens.map((item) => ({
        pedido_id: pedido.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
      }));

      const { error: itensError } = await supabase.from("pedido_itens").insert(itensInsert);
      if (itensError) throw itensError;

      // Update stock using shared service
      await atualizarEstoqueVenda(
        itens.map((item) => ({
          produto_id: item.produto_id,
          quantidade: item.quantidade,
        })),
        unidadeAtual?.id
      );

      // Get company config for receipt
      let empresaConfig: EmpresaConfig | undefined;
      try {
        let cfgQuery = supabase
          .from("configuracoes_empresa")
          .select("nome_empresa, cnpj, telefone, endereco, mensagem_cupom")
          .limit(1);
        if (empresa?.id) cfgQuery = cfgQuery.eq("empresa_id", empresa.id);
        const { data: configData } = await cfgQuery.maybeSingle();

        empresaConfig = {
          nome_empresa: empresa?.nome || configData?.nome_empresa || "Empresa",
          cnpj: configData?.cnpj ?? null,
          telefone: configData?.telefone ?? null,
          endereco: configData?.endereco ?? null,
          mensagem_cupom: configData?.mensagem_cupom ?? null,
        };
      } catch {
        console.warn("Não foi possível carregar configurações da empresa");
        if (empresa?.nome) empresaConfig = { nome_empresa: empresa.nome };
      }

      // Generate receipt
      generateReceiptPdf({
        pedidoId: pedido.id,
        pedidoNumero: (pedido as any).numero_sequencial ?? null,
        data: new Date(),
        cliente: {
          nome: "Consumidor Final",
          telefone: "",
          endereco: "Retirada no local",
        },
        itens,
        pagamentos: pagamentos.map((p) => ({ id: p.id, forma: p.forma, valor: p.valor })),
        entregadorNome: null,
        canalVenda: "portaria",
        observacoes: "",
        empresa: empresaConfig,
      });

      // Rotear pagamentos para caixa/financeiro
      await rotearPagamentosVenda({
        pedidoId: pedido.id,
        pedidoNumero: (pedido as any).numero_sequencial ?? null,
        clienteNome: "Consumidor Final",
        pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor: p.valor })),
        unidadeId: unidadeAtual?.id,
      });

      toast({
        title: "Venda finalizada!",
        description: `Pedido #${(pedido as any).numero_sequencial ?? pedido.id.slice(0, 8).toUpperCase()} - R$ ${total.toFixed(2)}`,
      });

      // Reset
      setItens([]);
      setPaymentOpen(false);
      searchInputRef.current?.focus();
    } catch (error: any) {
      console.error("Erro ao finalizar venda:", error);
      toast({
        title: "Erro ao finalizar",
        description: error.message || "Ocorreu um erro",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <Header title="PDV" subtitle="Venda rápida para retirada no local" />
      <div className="h-[calc(100vh-4rem)] flex flex-col p-3 md:p-4 gap-3 md:gap-4 w-full min-w-0 max-w-full overflow-x-hidden">
        <CaixaBloqueadoBanner />
        {/* Header */}
        <div className="flex items-center justify-between gap-2 w-full min-w-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => navigate("/vendas")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg md:text-xl font-bold truncate">PDV - Portaria</h1>
              <p className="text-xs text-muted-foreground truncate">
                {unidadeAtual ? `Loja: ${unidadeAtual.nome}` : "Venda rápida para retirada no local"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm md:text-lg px-2 md:px-4 py-1 md:py-2 shrink-0">
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </Badge>
        </div>

        {/* Main Content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 min-h-0 w-full min-w-0">
          {/* Left: Products */}
          <Card className="lg:col-span-2 flex flex-col min-h-0 w-full min-w-0 max-w-full overflow-hidden">
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="space-y-2 w-full min-w-0">
                <div className="flex items-center gap-2 w-full min-w-0">
                  <div className="flex-1 relative min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Buscar produto..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        searchProdutos(e.target.value);
                      }}
                      className="pl-10 w-full min-w-0 h-10"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && searchResults.length > 0) {
                          addProduct(searchResults[0]);
                        }
                      }}
                    />
                    
                    {/* Search Results Dropdown */}
                    {showResults && searchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden max-w-full">
                        {searchResults.map((produto) => (
                          <button
                            key={produto.id}
                            className="w-full px-3 py-3 text-left hover:bg-accent transition-colors border-b last:border-0 flex justify-between items-center gap-2 min-w-0"
                            onClick={() => addProduct(produto)}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{produto.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                Estoque: {produto.estoque ?? 0}
                              </p>
                            </div>
                            <span className="font-semibold text-primary shrink-0">
                              R$ {produto.preco.toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    variant={scannerActive ? "destructive" : "photo"}
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setScannerActive(!scannerActive)}
                    title={scannerActive ? "Fechar scanner" : "Escanear código de barras"}
                  >
                    {scannerActive ? <CameraOff className="h-4 w-4" /> : <ScanBarcode className="h-4 w-4" />}
                  </Button>
                </div>

                {scannerActive && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 text-xs text-primary font-medium">
                      <Zap className="h-3.5 w-3.5" />
                      Aponte a câmera para o código de barras
                    </div>
                    <BarcodeScanner
                      isActive={scannerActive}
                      onToggle={() => setScannerActive(!scannerActive)}
                      onScan={handleBarcodeScan}
                      hideToggle
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col min-h-0 pt-2">
              {/* Quick Products Grid */}
              <div className="mb-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Produtos Rápidos</p>
                <PDVQuickProducts onSelectProduct={addProduct} unidadeId={unidadeAtual?.id} />
              </div>

              <Separator className="my-2" />

              {/* Cart Items */}
              <PDVProductList
                itens={itens}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={removeItem}
                onUpdatePrice={updatePrice}
              />
            </CardContent>
          </Card>

          {/* Right: Summary */}
          <Card className="flex flex-col w-full min-w-0 max-w-full overflow-hidden">
            <CardContent className="p-3 md:p-6 flex flex-col lg:flex-1 w-full min-w-0">
              {/* Mobile: compact horizontal layout */}
              <div className="flex items-center justify-between lg:hidden mb-3 gap-2 w-full min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground truncate">Total ({totalItens} itens)</p>
                  <p className="text-2xl font-bold text-primary truncate">
                    R$ {total.toFixed(2)}
                  </p>
                </div>
                <Button
                  className="h-12 px-4 text-base shrink-0"
                  disabled={itens.length === 0}
                  onClick={() => setPaymentOpen(true)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Finalizar
                </Button>
              </div>
              <div className="flex gap-2 lg:hidden w-full min-w-0">
                <Button
                  variant="outline"
                  className="flex-1 h-10 min-w-0"
                  onClick={clearCart}
                  disabled={itens.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-1 shrink-0" />
                  <span className="truncate">Limpar</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 h-10 min-w-0 text-muted-foreground"
                  onClick={() => navigate("/vendas")}
                >
                  <XCircle className="h-4 w-4 mr-1 shrink-0" />
                  <span className="truncate">Cancelar</span>
                </Button>
              </div>

              {/* Desktop: original vertical layout */}
              <div className="hidden lg:flex lg:flex-col lg:flex-1 w-full min-w-0">
                <CardTitle className="text-base mb-4">Resumo</CardTitle>
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Itens</span>
                    <span className="font-medium">{totalItens}</span>
                  </div>
                  <Separator />
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-5xl font-bold text-primary truncate">
                      R$ {total.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 mt-auto">
                  <Button
                    className="w-full h-14 text-lg"
                    size="lg"
                    disabled={itens.length === 0}
                    onClick={() => setPaymentOpen(true)}
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Finalizar (F12)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-10"
                    onClick={clearCart}
                    disabled={itens.length === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full h-10 text-muted-foreground"
                    onClick={() => navigate("/vendas")}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Modal */}
        <PDVPayment
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          total={total}
          onConfirm={finalizeSale}
          isLoading={isLoading}
          itens={itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade }))}
        />
      </div>
    </MainLayout>
  );
}
