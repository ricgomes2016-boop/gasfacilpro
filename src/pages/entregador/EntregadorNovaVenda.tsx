import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ShoppingCart,
  User,
  MapPin,
  Phone,
  Package,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  CheckCircle,
  Search,
  Sparkles,
  Mic,
  MicOff,
  Send,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PixKeySelectorModal } from "@/components/pagamento/PixKeySelectorModal";
import { CardOperatorSelectorModal } from "@/components/pagamento/CardOperatorSelectorModal";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface ProdutoDB {
  id: string;
  nome: string;
  preco: number;
  estoque: number | null;
  categoria: string | null;
}

interface ClienteDB {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
}

const formasPagamento = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "pix_maquininha", label: "PIX Maquininha" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "fiado", label: "Fiado" },
];

interface ItemVenda {
  produtoId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
}

interface Cliente {
  id: string | null;
  nome: string;
  telefone: string;
  endereco: string;
  numero: string;
  bairro: string;
  complemento: string;
}

export default function EntregadorNovaVenda() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { empresa } = useEmpresa();

  const [produtos, setProdutos] = useState<ProdutoDB[]>([]);
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const [entregadorUnidadeId, setEntregadorUnidadeId] = useState<string | null>(null);

  const [cliente, setCliente] = useState<Cliente>({
    id: null,
    nome: "",
    telefone: "",
    endereco: "",
    numero: "",
    bairro: "",
    complemento: "",
  });
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [dialogClienteAberto, setDialogClienteAberto] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Payment provider modals
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardModalTipo, setCardModalTipo] = useState<"credito" | "debito" | "pix_maquininha">("credito");
  const [selectedPaymentInfo, setSelectedPaymentInfo] = useState<string | null>(null);
  const [selectedPaymentExtras, setSelectedPaymentExtras] = useState<{ operadora_id?: string; conta_bancaria_id?: string }>({});

  // Voice / AI command state
  const [aiCommand, setAiCommand] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    let unidadeId: string | null = null;

    if (user) {
      const { data: entregador } = await supabase
        .from("entregadores")
        .select("id, unidade_id, terminal_id, terminal_ativo_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (entregador) {
        setEntregadorId(entregador.id);
        unidadeId = entregador.unidade_id;
        setEntregadorUnidadeId(entregador.unidade_id);
        
        // Auto-detect active terminal's operadora for card payments
        const activeTerminalId = entregador.terminal_ativo_id || entregador.terminal_id;
        if (activeTerminalId) {
          const { data: terminal } = await (supabase.from("terminais_cartao" as any).select("operadora_id").eq("id", activeTerminalId).maybeSingle() as any);
          if (terminal?.operadora_id) {
            setSelectedPaymentExtras(prev => ({ ...prev, operadora_id: terminal.operadora_id }));
          }
        }
      }
    }

    let produtosQuery = supabase
      .from("produtos")
      .select("id, nome, preco, estoque, categoria")
      .eq("ativo", true)
      .or("tipo_botijao.is.null,tipo_botijao.neq.vazio")
      .order("nome");

    if (unidadeId) {
      produtosQuery = produtosQuery.eq("unidade_id", unidadeId);
    }

    // Filter clientes by empresa
    let clientesQuery = supabase.from("clientes").select("id, nome, telefone, endereco, bairro, cep, cidade").eq("ativo", true).order("nome").limit(500);
    if (empresa?.id) clientesQuery = clientesQuery.eq("empresa_id", empresa.id);

    const [produtosRes, clientesRes] = await Promise.all([
      produtosQuery,
      clientesQuery,
    ]);

    if (produtosRes.data) setProdutos(produtosRes.data);
    if (clientesRes.data) setClientes(clientesRes.data);
  };

  // Voice recognition
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Não suportado", description: "Use Chrome ou Edge para comando de voz.", variant: "destructive" });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setAiCommand(transcript);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        toast({ title: "Microfone bloqueado", description: "Permita o acesso ao microfone.", variant: "destructive" });
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      setTimeout(() => {
        const btn = document.getElementById("entregador-ai-send-btn");
        if (btn) btn.click();
      }, 300);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
  };

  const handleAiCommand = async () => {
    if (!aiCommand.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-sales-command", {
        body: { comando: aiCommand },
      });
      if (error) throw error;

      // Fill client
      if (data.cliente_id) {
        setCliente({
          id: data.cliente_id,
          nome: data.cliente_nome || "",
          telefone: data.cliente_telefone || "",
          endereco: data.endereco || "",
          numero: data.numero || "",
          bairro: data.bairro || "",
          complemento: data.complemento || "",
        });
      } else if (data.cliente_nome) {
        // Auto-register new client
        const novoCliente = {
          nome: data.cliente_nome,
          endereco: data.endereco || null,
          bairro: data.bairro || null,
          cep: data.cep || null,
          cidade: data.cidade || null,
          telefone: data.cliente_telefone || null,
          ativo: true,
          empresa_id: empresa?.id || null,
        };
        const { data: criado, error: createErr } = await supabase.from("clientes").insert(novoCliente).select("id").single();
        setCliente({
          id: criado?.id || null,
          nome: data.cliente_nome,
          telefone: data.cliente_telefone || "",
          endereco: data.endereco || "",
          numero: data.numero || "",
          bairro: data.bairro || "",
          complemento: data.complemento || "",
        });
        if (criado) {
          // Associate with entregador's unidade
          const { data: entData } = await supabase
            .from("entregadores")
            .select("unidade_id")
            .eq("user_id", user?.id || "")
            .maybeSingle();
          if (entData?.unidade_id) {
            await supabase.from("cliente_unidades").insert({
              cliente_id: criado.id,
              unidade_id: entData.unidade_id,
            });
          }
          toast({ title: "Novo cliente cadastrado!", description: `${data.cliente_nome} adicionado ao sistema.` });
        }
      }

      // Fill items
      if (data.itens?.length > 0) {
        const newItens: ItemVenda[] = data.itens.map((item: any) => ({
          produtoId: item.produto_id,
          nome: item.nome,
          quantidade: item.quantidade || 1,
          precoUnitario: item.preco_unitario,
        }));
        setItens(newItens);
      }

      // Fill payment
      if (data.forma_pagamento) {
        setFormaPagamento(data.forma_pagamento);
      }

      setAiCommand("");
      toast({ title: "Comando interpretado!", description: `Venda pré-preenchida para ${data.cliente_nome || "cliente"}.` });
    } catch (err: any) {
      toast({ title: "Erro ao interpretar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const total = itens.reduce((acc, item) => acc + item.quantidade * item.precoUnitario, 0);

  const adicionarProduto = (produtoId: string) => {
    const produto = produtos.find((p) => p.id === produtoId);
    if (!produto) return;
    const existente = itens.findIndex((i) => i.produtoId === produto.id);
    if (existente >= 0) {
      alterarQuantidade(existente, 1);
    } else {
      setItens((prev) => [...prev, { produtoId: produto.id, nome: produto.nome, quantidade: 1, precoUnitario: produto.preco }]);
    }
  };

  const alterarQuantidade = (index: number, delta: number) => {
    setItens((prev) => prev.map((item, i) => i === index ? { ...item, quantidade: Math.max(1, item.quantidade + delta) } : item));
  };

  const removerItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index));
  };

  const selecionarCliente = (c: ClienteDB) => {
    setCliente({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone || "",
      endereco: c.endereco || "",
      numero: "",
      bairro: c.bairro || "",
      complemento: "",
    });
    setDialogClienteAberto(false);
  };

  const finalizarVenda = async () => {
    if (!cliente.nome || !cliente.endereco) {
      toast({ title: "Dados incompletos", description: "Preencha nome e endereço do cliente.", variant: "destructive" });
      return;
    }
    if (itens.length === 0) {
      toast({ title: "Carrinho vazio", description: "Adicione pelo menos um produto.", variant: "destructive" });
      return;
    }
    if (!formaPagamento) {
      toast({ title: "Pagamento", description: "Selecione uma forma de pagamento.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const enderecoCompleto = [cliente.endereco, cliente.numero && `Nº ${cliente.numero}`, cliente.complemento, cliente.bairro].filter(Boolean).join(", ");

      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          cliente_id: cliente.id,
          entregador_id: entregadorId,
          endereco_entrega: enderecoCompleto,
          valor_total: total,
          forma_pagamento: formaPagamento,
          canal_venda: "entregador",
          observacoes: observacao || null,
          status: "em_rota",
        })
        .select("id")
        .single();

      if (pedidoError) throw pedidoError;

      const itensInsert = itens.map((item) => ({
        pedido_id: pedido.id,
        produto_id: item.produtoId,
        quantidade: item.quantidade,
        preco_unitario: item.precoUnitario,
      }));

      const { error: itensError } = await supabase.from("pedido_itens").insert(itensInsert);
      if (itensError) throw itensError;

      // Update stock
      for (const item of itens) {
        const { data: prod } = await supabase.from("produtos").select("id, estoque, tipo_botijao, botijao_par_id").eq("id", item.produtoId).single();
        if (prod) {
          await supabase.from("produtos").update({ estoque: Math.max(0, (prod.estoque || 0) - item.quantidade) }).eq("id", item.produtoId);
          if (prod.tipo_botijao === "cheio" && prod.botijao_par_id) {
            const { data: vazio } = await supabase.from("produtos").select("id, estoque").eq("id", prod.botijao_par_id).single();
            if (vazio) {
              await supabase.from("produtos").update({ estoque: (vazio.estoque || 0) + item.quantidade }).eq("id", vazio.id);
            }
          }
        }
      }

      toast({ title: "Venda registrada! ✅", description: `Pedido #${pedido.id.slice(0, 6)} criado com sucesso.` });
      navigate("/entregador/entregas");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clientesFiltrados = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
      (c.telefone || "").includes(buscaCliente)
  );

  return (
    <EntregadorLayout title="Nova Venda">
      <div className="p-4 space-y-4 pb-24">
        {/* AI Command Bar */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <Input
                placeholder='Ex: "1 P13 para Maria, Rua Ceará 30, pix"'
                value={aiCommand}
                onChange={(e) => setAiCommand(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !aiLoading && handleAiCommand()}
                className="bg-background text-sm"
                disabled={aiLoading || isListening}
              />
              <Button
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                onClick={isListening ? stopListening : startListening}
                disabled={aiLoading}
                className={`shrink-0 ${isListening ? "animate-pulse" : ""}`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                id="entregador-ai-send-btn"
                onClick={handleAiCommand}
                disabled={aiLoading || !aiCommand.trim()}
                size="icon"
                className="shrink-0"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 ml-7">
              {isListening
                ? "🔴 Ouvindo... Fale o comando de venda"
                : "💡 Digite ou clique no 🎤 para ditar"}
            </p>
          </CardContent>
        </Card>

        {/* Cliente */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Cliente
              </CardTitle>
              <Dialog open={dialogClienteAberto} onOpenChange={setDialogClienteAberto}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Search className="h-4 w-4 mr-1" />
                    Buscar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Buscar Cliente</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Nome ou telefone..."
                      value={buscaCliente}
                      onChange={(e) => setBuscaCliente(e.target.value)}
                    />
                    <div className="space-y-2 max-h-60 overflow-auto">
                      {clientesFiltrados.slice(0, 20).map((c) => (
                        <div
                          key={c.id}
                          onClick={() => selecionarCliente(c)}
                          className="p-3 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors"
                        >
                          <p className="font-medium">{c.nome}</p>
                          <p className="text-sm text-muted-foreground">{c.telefone || "Sem telefone"}</p>
                          <p className="text-xs text-muted-foreground">{c.endereco || "Sem endereço"}</p>
                        </div>
                      ))}
                      {clientesFiltrados.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">Nenhum cliente encontrado</p>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nome *</Label>
                <Input value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} placeholder="Nome do cliente" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={cliente.telefone} onChange={(e) => setCliente({ ...cliente, telefone: e.target.value })} placeholder="(00) 00000-0000" className="pl-10" />
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Endereço *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={cliente.endereco} onChange={(e) => setCliente({ ...cliente, endereco: e.target.value })} placeholder="Rua, Avenida..." className="pl-10" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Número</Label>
                <Input value={cliente.numero} onChange={(e) => setCliente({ ...cliente, numero: e.target.value })} placeholder="123" />
              </div>
              <div>
                <Label className="text-xs">Bairro</Label>
                <Input value={cliente.bairro} onChange={(e) => setCliente({ ...cliente, bairro: e.target.value })} placeholder="Bairro" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Complemento</Label>
                <Input value={cliente.complemento} onChange={(e) => setCliente({ ...cliente, complemento: e.target.value })} placeholder="Apto, bloco..." />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Produtos */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Produtos
              </CardTitle>
              <Select onValueChange={adicionarProduto}>
                <SelectTrigger className="w-auto h-8 text-xs">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{p.nome}</span>
                        <span className="text-muted-foreground">R$ {p.preco.toFixed(2)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {itens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum produto adicionado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {itens.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.nome}</p>
                      <p className="text-xs text-muted-foreground">R$ {item.precoUnitario.toFixed(2)} un.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alterarQuantidade(index, -1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-bold">{item.quantidade}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alterarQuantidade(index, 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removerItem(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-3 border-t border-border">
                  <span className="font-medium">Total:</span>
                  <span className="font-bold text-xl text-primary">R$ {total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagamento */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Forma de Pagamento *</Label>
              <Select value={formaPagamento} onValueChange={(v) => {
                setFormaPagamento(v);
                setSelectedPaymentInfo(null);
                setSelectedPaymentExtras({});
                if (v === "pix") {
                  setPixModalOpen(true);
                } else if (v === "cartao_credito" || v === "cartao_debito" || v === "pix_maquininha") {
                  const tipo = v === "cartao_credito" ? "credito" : v === "pix_maquininha" ? "pix_maquininha" : "debito";
                  setCardModalTipo(tipo);
                  setCardModalOpen(true);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {formasPagamento.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPaymentInfo && (
              <div className="p-3 rounded-lg bg-success/10 text-success text-sm text-center font-medium">
                {selectedPaymentInfo}
              </div>
            )}
            <div>
              <Label className="text-xs">Observação</Label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observações..." rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Canal */}
        <Card className="border-none shadow-md bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Canal de Venda:</span>
              <Badge className="gradient-primary text-white">🛵 Entregador</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Finalizar */}
        <Button
          onClick={finalizarVenda}
          className="w-full h-14 text-lg gradient-primary text-white shadow-lg"
          disabled={itens.length === 0 || !cliente.nome || !formaPagamento || isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <CheckCircle className="h-5 w-5 mr-2" />
          )}
          Finalizar Venda • R$ {total.toFixed(2)}
        </Button>
      </div>

      {/* PIX Key Selector */}
      <PixKeySelectorModal
        open={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        valor={total}
        unidadeId={entregadorUnidadeId || undefined}
        onSelect={(chavePix, contaBancariaId) => {
          setSelectedPaymentExtras({ conta_bancaria_id: contaBancariaId });
          setSelectedPaymentInfo("PIX via conta selecionada");
        }}
      />

      {/* Card Operator Selector */}
      <CardOperatorSelectorModal
        open={cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        valor={total}
        tipoCartao={cardModalTipo}
        unidadeId={entregadorUnidadeId || undefined}
        onSelect={(op) => {
          setSelectedPaymentExtras({ operadora_id: op.id });
          setSelectedPaymentInfo(`${op.nome} • Taxa ${op.taxa.toFixed(2)}% • D+${op.prazo} • Líq. R$ ${op.valorLiquido.toFixed(2)}`);
        }}
      />
    </EntregadorLayout>
  );
}
