import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  X,
  ShoppingBag,
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
import { PdvProductLike } from "@/components/pdv/PdvProductCard";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { CaixaBloqueadoBanner } from "@/components/caixa/CaixaBloqueadoBanner";
import { cn } from "@/lib/utils";

interface Produto {
  id: string;
  nome: string;
  preco: number;
  estoque: number | null;
  categoria?: string | null;
  tipo_botijao?: string | null;
  botijao_par_id?: string | null;
  image_url?: string | null;
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
  const [now, setNow] = useState<string>(() =>
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const total = itens.reduce((acc, item) => acc + item.total, 0);
  const totalItens = itens.reduce((acc, item) => acc + item.quantidade, 0);
  const carrinhoVazio = itens.length === 0;

  // Focus search input on mount and handle keyboard shortcuts
  useEffect(() => {
    searchInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        if (itens.length > 0) setPaymentOpen(true);
      }
      if (e.key === "Escape") {
        if (paymentOpen) setPaymentOpen(false);
        else if (showResults) {
          setShowResults(false);
          setSearchResults([]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [itens.length, paymentOpen, showResults]);

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

  const addProduct = useCallback((produto: Produto | PdvProductLike) => {
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

    const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQgAHoTPxaR2J...");
    audio.volume = 0.3;
    audio.play().catch(() => {});
  }, []);

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    try {
      let { data, error } = await supabase
        .from("produtos")
        .select("id, nome, preco, estoque, categoria, tipo_botijao, botijao_par_id")
        .eq("ativo", true)
        .eq("codigo_barras", barcode)
        .limit(1);

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
      toast({ title: "Produto adicionado", description: data[0].nome });
    } catch (error) {
      console.error("Erro ao buscar produto por código:", error);
    }
  }, [addProduct, toast]);

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

  const updatePrice = (index: number, newPrice: number) => {
    setItens((prev) => {
      const newItens = [...prev];
      newItens[index].preco_unitario = newPrice;
      newItens[index].total = newItens[index].quantidade * newPrice;
      return newItens;
    });
  };

  const removeItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    if (itens.length > 0 && !confirm("Limpar todos os itens?")) return;
    setItens([]);
    searchInputRef.current?.focus();
  };

  const getQuantidade = useCallback(
    (produtoId: string) => itens.find((i) => i.produto_id === produtoId)?.quantidade ?? 0,
    [itens]
  );

  const incrementByProduct = useCallback((produto: PdvProductLike) => {
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.produto_id === produto.id);
      if (idx < 0) return prev;
      const newItens = [...prev];
      newItens[idx].quantidade += 1;
      newItens[idx].total = newItens[idx].quantidade * newItens[idx].preco_unitario;
      return newItens;
    });
  }, []);

  const decrementByProduct = useCallback((produto: PdvProductLike) => {
    setItens((prev) => {
      const idx = prev.findIndex((i) => i.produto_id === produto.id);
      if (idx < 0) return prev;
      const newItens = [...prev];
      const nova = newItens[idx].quantidade - 1;
      if (nova <= 0) return newItens.filter((_, i) => i !== idx);
      newItens[idx].quantidade = nova;
      newItens[idx].total = nova * newItens[idx].preco_unitario;
      return newItens;
    });
  }, []);

  const finalizeSale = async (pagamentos: PDVPagamento[], _valorRecebidoDinheiro: number) => {
    if (itens.length === 0 || pagamentos.length === 0) return;

    setIsLoading(true);

    try {
      const totalTaxasExtras = pagamentos.reduce((acc, p) => acc + (Number((p as any).taxa_extra) || 0), 0);
      const valorTotalPedido = total + totalTaxasExtras;

      const formaPagamentoLabel =
        pagamentos.length === 1
          ? pagamentos[0].forma
          : `multiplo:${pagamentos.map((p) => p.forma).join("+")}`;

      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          valor_total: valorTotalPedido,
          forma_pagamento: formaPagamentoLabel,
          canal_venda: null,
          origem_pedido: "balcao_pdv",
          responsavel_acerto: "portaria",
          status: "finalizado",
          endereco_entrega: "Retirada no local",
          unidade_id: unidadeAtual?.id || null,
        } as any)
        .select("id, numero_sequencial")
        .single();

      if (pedidoError) throw pedidoError;

      const itensInsert = itens.map((item) => ({
        pedido_id: pedido.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
      }));

      const { error: itensError } = await supabase.from("pedido_itens").insert(itensInsert);
      if (itensError) throw itensError;

      await atualizarEstoqueVenda(
        itens.map((item) => ({ produto_id: item.produto_id, quantidade: item.quantidade })),
        unidadeAtual?.id
      );

      let empresaConfig: EmpresaConfig | undefined;
      try {
        let cfgQuery = supabase
          .from("configuracoes_empresa")
          .select("mensagem_cupom")
          .limit(1);
        if (empresa?.id) cfgQuery = cfgQuery.eq("empresa_id", empresa.id);
        const { data: configData } = await cfgQuery.maybeSingle();

        const enderecoUnidade = [
          unidadeAtual?.endereco,
          unidadeAtual?.bairro,
          [unidadeAtual?.cidade, unidadeAtual?.estado].filter(Boolean).join("/"),
          unidadeAtual?.cep,
        ].filter(Boolean).join(", ");

        empresaConfig = {
          nome_empresa: unidadeAtual?.nome || empresa?.nome || "Empresa",
          cnpj: unidadeAtual?.cnpj ?? null,
          telefone: unidadeAtual?.telefone ?? null,
          endereco: enderecoUnidade || null,
          mensagem_cupom: configData?.mensagem_cupom ?? null,
        };
      } catch {
        console.warn("Não foi possível carregar configurações da empresa");
        empresaConfig = { nome_empresa: unidadeAtual?.nome || empresa?.nome || "Empresa" };
      }

      generateReceiptPdf({
        pedidoId: pedido.id,
        pedidoNumero: (pedido as any).numero_sequencial ?? null,
        data: new Date(),
        cliente: { nome: "Consumidor Final", telefone: "", endereco: "Retirada no local" },
        itens,
        pagamentos: pagamentos.map((p) => ({ id: p.id, forma: p.forma, valor: p.valor })),
        entregadorNome: null,
        canalVenda: "portaria",
        observacoes: "",
        empresa: empresaConfig,
      });

      await rotearPagamentosVenda({
        pedidoId: pedido.id,
        pedidoNumero: (pedido as any).numero_sequencial ?? null,
        clienteNome: "Consumidor Final",
        pagamentos: pagamentos.map((p) => ({
          forma: p.forma,
          valor: p.valor,
          operadora_id: p.operadora_id,
          conta_bancaria_id: p.conta_bancaria_id,
        })),
        unidadeId: unidadeAtual?.id,
      });

      toast({
        title: "Venda finalizada!",
        description: `Pedido #${(pedido as any).numero_sequencial ?? pedido.id.slice(0, 8).toUpperCase()} - R$ ${total.toFixed(2)}`,
      });

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
      <div className="min-h-[calc(100vh-0rem)] bg-[hsl(220,14%,96%)]">
        <div className="mx-auto max-w-[1400px] px-3 md:px-6 pt-3 md:pt-5 pb-40 md:pb-6 space-y-3 md:space-y-4">
          <CaixaBloqueadoBanner />

          {/* Compact premium header */}
          <div className="flex items-center justify-between gap-2 w-full min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={() => navigate("/vendas")}
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base md:text-lg font-bold truncate leading-tight">PDV – Portaria</h1>
                <p className="text-[11px] md:text-xs text-muted-foreground truncate">
                  {unidadeAtual ? `Loja: ${unidadeAtual.nome}` : "Venda rápida para retirada no local"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-card border border-border px-3 h-10 shrink-0 text-sm font-semibold tabular-nums shadow-sm">
              {now}
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-3 md:gap-4">
            {/* Left: Products */}
            <div className="space-y-3 md:space-y-4 min-w-0">
              {/* Search bar */}
              <Card className="rounded-2xl border-border shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
                <CardContent className="p-2.5 md:p-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-background focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary h-[52px] px-3 relative">
                    <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Buscar produto, código ou descrição"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        searchProdutos(e.target.value);
                      }}
                      className="flex-1 min-w-0 border-0 shadow-none focus-visible:ring-0 h-full text-[15px] px-0 bg-transparent"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && searchResults.length > 0) {
                          addProduct(searchResults[0]);
                        }
                      }}
                    />
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg shrink-0"
                        onClick={() => {
                          setSearchTerm("");
                          setSearchResults([]);
                          setShowResults(false);
                          searchInputRef.current?.focus();
                        }}
                        aria-label="Limpar busca"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="h-6 w-px bg-border" />
                    <Button
                      variant={scannerActive ? "destructive" : "ghost"}
                      size="icon"
                      className={cn("h-9 w-9 rounded-lg shrink-0", !scannerActive && "text-primary hover:bg-primary/10")}
                      onClick={() => setScannerActive(!scannerActive)}
                      aria-label={scannerActive ? "Fechar scanner" : "Escanear código de barras"}
                    >
                      {scannerActive ? <CameraOff className="h-4 w-4" /> : <ScanBarcode className="h-4 w-4" />}
                    </Button>

                    {showResults && searchResults.length > 0 && (
                      <div className="absolute z-40 left-0 right-0 top-full mt-2 bg-popover border border-border rounded-2xl shadow-lg overflow-hidden">
                        {searchResults.map((produto) => (
                          <button
                            key={produto.id}
                            className="w-full px-3 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-0 flex justify-between items-center gap-2 min-w-0"
                            onClick={() => addProduct(produto)}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{produto.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                Estoque: {produto.estoque ?? 0}
                              </p>
                            </div>
                            <span className="font-semibold text-primary shrink-0 tabular-nums">
                              R$ {produto.preco.toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {scannerActive && (
                    <div className="mt-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
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
                </CardContent>
              </Card>

              {/* Products grid */}
              <Card className="rounded-2xl border-border shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm md:text-base font-semibold text-foreground">Produtos rápidos</h2>
                  </div>
                  <PDVQuickProducts
                    onSelectProduct={addProduct}
                    onIncrement={incrementByProduct}
                    onDecrement={decrementByProduct}
                    getQuantidade={getQuantidade}
                    unidadeId={unidadeAtual?.id}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right: Cart */}
            <div className="min-w-0 lg:sticky lg:top-4 lg:self-start space-y-3">
              <Card className="rounded-2xl border-border shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ShoppingBag className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight">Carrinho</p>
                        <p className="text-[11px] text-muted-foreground">
                          {totalItens} {totalItens === 1 ? "item" : "itens"}
                        </p>
                      </div>
                    </div>
                    {!carrinhoVazio && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                        onClick={clearCart}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Limpar
                      </Button>
                    )}
                  </div>

                  {carrinhoVazio ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
                      <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                      <p className="text-sm font-medium text-foreground">Carrinho vazio</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Adicione produtos para iniciar a venda.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[46vh] lg:max-h-[52vh] overflow-y-auto -mx-1 px-1">
                      <PDVProductList
                        itens={itens}
                        onUpdateQuantity={updateQuantity}
                        onRemoveItem={removeItem}
                        onUpdatePrice={updatePrice}
                      />
                    </div>
                  )}

                  {/* Desktop summary */}
                  <div className="hidden lg:block mt-3 pt-3 border-t border-border">
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="text-2xl font-bold tabular-nums text-foreground">
                        R$ {total.toFixed(2)}
                      </span>
                    </div>
                    <Button
                      className="w-full h-12 rounded-xl text-[15px] font-semibold shadow-sm"
                      disabled={carrinhoVazio}
                      onClick={() => setPaymentOpen(true)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {carrinhoVazio ? "Adicione produtos" : "Finalizar venda"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full h-10 mt-1 rounded-xl text-muted-foreground text-xs"
                      onClick={() => navigate("/vendas")}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      Cancelar venda
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Mobile sticky checkout bar */}
        <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 px-3 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-[1400px]">
            <div className="rounded-2xl border border-border bg-card shadow-[0_-8px_24px_rgba(15,23,42,0.10)] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    {totalItens} {totalItens === 1 ? "item" : "itens"} · Total
                  </p>
                  <p className="text-[22px] font-bold tabular-nums leading-tight truncate">
                    R$ {total.toFixed(2)}
                  </p>
                </div>
                <Button
                  className="h-12 px-5 rounded-xl text-sm font-semibold shrink-0"
                  disabled={carrinhoVazio}
                  onClick={() => setPaymentOpen(true)}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  {carrinhoVazio ? "Adicione itens" : "Finalizar"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-9 rounded-xl text-xs"
                  onClick={clearCart}
                  disabled={carrinhoVazio}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Limpar
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 h-9 rounded-xl text-xs text-muted-foreground"
                  onClick={() => navigate("/vendas")}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
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
