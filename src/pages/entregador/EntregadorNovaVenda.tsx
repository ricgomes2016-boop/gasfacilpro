import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart,
  User,
  MapPin,
  Phone,
  Package,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Sparkles,
  Mic,
  MicOff,
  Send,
  Loader2,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PaymentSection, Pagamento } from "@/components/vendas/PaymentSection";
import { useEmpresa } from "@/contexts/EmpresaContext";

import { getBrasiliaDateString } from "@/lib/utils";
import { ClienteAutocompleteInput, type ClienteSugestao } from "@/components/clientes/ClienteAutocompleteInput";

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
  numero?: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  tipo: string | null;
}


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
  tipo: string | null;
}

interface EntregadorNovaVendaProps {
  noLayout?: boolean;
}

export default function EntregadorNovaVenda({ noLayout = false }: EntregadorNovaVendaProps = {}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { empresa } = useEmpresa();

  const [produtos, setProdutos] = useState<ProdutoDB[]>([]);
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const [entregadorUnidadeId, setEntregadorUnidadeId] = useState<string | null>(null);
  const [entregadorEmpresaId, setEntregadorEmpresaId] = useState<string | null>(null);

  const [cliente, setCliente] = useState<Cliente>({
    id: null,
    nome: "",
    telefone: "",
    endereco: "",
    numero: "",
    bairro: "",
    complemento: "",
    tipo: null,
  });
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [canalVenda, setCanalVenda] = useState("");
  const [observacao, setObservacao] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Voice / AI command state
  const [aiCommand, setAiCommand] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    fetchData();
  }, [user, empresa?.id]);

  // Realtime subscription for new clients
  useEffect(() => {
    if (!empresa?.id) return;
    const channel = supabase
      .channel(`clientes-entregador-${empresa.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "clientes",
        filter: `empresa_id=eq.${empresa.id}`,
      }, (payload) => {
        const novo = payload.new as ClienteDB;
        setClientes(prev => {
          if (prev.find(c => c.id === novo.id)) return prev;
          return [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [empresa?.id]);

  const fetchData = async () => {
    let unidadeId: string | null = null;
    let empresaId = empresa?.id || null;

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
        if (unidadeId && !empresaId) {
          const { data: unidade } = await supabase
            .from("unidades")
            .select("empresa_id")
            .eq("id", unidadeId)
            .maybeSingle();
          empresaId = unidade?.empresa_id || null;
        }
      }
    }

    setEntregadorEmpresaId(empresaId);

    let produtosQuery = supabase
      .from("produtos")
      .select("id, nome, preco, estoque, categoria")
      .eq("ativo", true)
      
      .order("nome");

    if (unidadeId) {
      produtosQuery = produtosQuery.eq("unidade_id", unidadeId);
    }

    let clientesQuery = supabase
      .from("clientes")
      .select("id, nome, telefone, endereco, numero, bairro, cep, cidade, tipo")
      .eq("ativo", true)
      .order("nome")
      .limit(500);
    if (empresaId) clientesQuery = clientesQuery.eq("empresa_id", empresaId);

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
          tipo: null,
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
          empresa_id: entregadorEmpresaId || empresa?.id || null,
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
          tipo: null,
        });
        if (criado) {
          // Update local state immediately
          setClientes(prev => {
            if (prev.find(c => c.id === criado.id)) return prev;
            return [...prev, {
              id: criado.id,
              nome: data.cliente_nome,
              telefone: data.cliente_telefone || null,
              endereco: data.endereco || null,
              bairro: data.bairro || null,
              cep: data.cep || null,
              cidade: data.cidade || null,
              tipo: null,
            }].sort((a, b) => a.nome.localeCompare(b.nome));
          });
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

      if (data.forma_pagamento) {
        setPagamentos([{
          id: crypto.randomUUID(),
          forma: data.forma_pagamento,
          valor: total || 0,
        }]);
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

  const alterarPreco = (index: number, novoPreco: number) => {
    setItens((prev) => prev.map((item, i) => i === index ? { ...item, precoUnitario: novoPreco } : item));
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
      numero: c.numero || "",
      bairro: c.bairro || "",
      complemento: "",
      tipo: c.tipo,
    });
  };

  const selecionarClienteAutocomplete = (nome: string, c?: ClienteSugestao) => {
    if (c) {
      setCliente({
        id: c.id,
        nome: c.nome,
        telefone: c.telefone || "",
        endereco: c.endereco || "",
        numero: c.numero || "",
        bairro: c.bairro || "",
        complemento: "",
        tipo: c.tipo,
      });
    } else {
      // Digitou nome manualmente sem selecionar da lista — mantém o id anterior apenas se o nome não foi editado
      setCliente((prev) => ({ ...prev, nome, id: prev.id && prev.nome === nome ? prev.id : null }));
    }
  };

  const limparCliente = () => {
    setCliente({
      id: null,
      nome: "",
      telefone: "",
      endereco: "",
      numero: "",
      bairro: "",
      complemento: "",
      tipo: null,
    });
  };

  const finalizarVenda = async () => {
    if (!canalVenda) {
      toast({ title: "Canal de venda obrigatório", description: "Selecione o canal de venda antes de finalizar.", variant: "destructive" });
      return;
    }
    if (!cliente.nome || !cliente.endereco) {
      toast({ title: "Dados incompletos", description: "Preencha nome e endereço do cliente.", variant: "destructive" });
      return;
    }
    const itensValidos = itens.filter((item) =>
      !!item.produtoId &&
      Number(item.quantidade) > 0 &&
      Number.isFinite(Number(item.precoUnitario)) &&
      Number(item.precoUnitario) >= 0
    );
    if (itensValidos.length === 0) {
      toast({ title: "Carrinho vazio", description: "Adicione pelo menos um produto.", variant: "destructive" });
      return;
    }
    if (itensValidos.length !== itens.length) {
      toast({ title: "Produto inválido", description: "Revise os produtos antes de finalizar.", variant: "destructive" });
      return;
    }
    const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
    if (pagamentos.length === 0 || totalPago < total) {
      toast({ title: "Pagamento", description: "O total pago deve cobrir o valor da venda.", variant: "destructive" });
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
          unidade_id: entregadorUnidadeId,
          endereco_entrega: enderecoCompleto,
          valor_total: total,
          forma_pagamento: pagamentos.map(p => p.forma).filter((v, i, a) => a.indexOf(v) === i).join(", "),
          canal_venda: canalVenda,
          origem_pedido: "app_entregador",
          observacoes: observacao || null,
          status: "entregue",
          data_entrega: getBrasiliaDateString(),
        } as any)
        .select("id, numero_sequencial")
        .single();

      if (pedidoError) throw pedidoError;

      const itensInsert = itensValidos.map((item) => ({
        pedido_id: pedido.id,
        produto_id: item.produtoId,
        quantidade: item.quantidade,
        preco_unitario: item.precoUnitario,
      }));

      const { error: itensError } = await supabase.from("pedido_itens").insert(itensInsert);
      if (itensError) {
        await supabase.from("pedidos").delete().eq("id", pedido.id);
        throw itensError;
      }

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

      // Update carregamento_rota_itens (quantidade_vendida) for active route
      if (entregadorId) {
        const { data: carregAtivo } = await supabase
          .from("carregamentos_rota")
          .select("id")
          .eq("entregador_id", entregadorId)
          .eq("status", "em_rota")
          .order("data_saida", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (carregAtivo) {
          for (const item of itens) {
            const { data: carregItem } = await supabase
              .from("carregamento_rota_itens")
              .select("id, quantidade_vendida")
              .eq("carregamento_id", carregAtivo.id)
              .eq("produto_id", item.produtoId)
              .maybeSingle();

            if (carregItem) {
              await supabase
                .from("carregamento_rota_itens")
                .update({
                  quantidade_vendida: (carregItem.quantidade_vendida || 0) + item.quantidade,
                })
                .eq("id", carregItem.id);
            }
          }
        }
      }

      toast({ title: "Venda registrada! ✅", description: `Pedido #${(pedido as any).numero_sequencial ?? pedido.id.slice(0, 8).toUpperCase()} criado com sucesso.` });
      navigate("/entregador/entregas");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTipoBadge = (tipo: string | null) => {
    switch (tipo) {
      case "revenda": return { label: "Revenda", className: "bg-warning text-warning border-warning" };
      case "comercial": return { label: "Comercial", className: "bg-info text-info border-info" };
      default: return { label: "Residencial", className: "bg-gray-100 text-gray-800 border-gray-200" };
    }
  };

  // Fetch canais de venda
  const { data: canaisVenda = [] } = useQuery({
    queryKey: ["canais-venda-entregador", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canais_venda")
        .select("id, nome, tipo")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;

      return data || [];
    },
  });

  const todosCanais = canaisVenda.map((c) => ({ value: c.nome, label: c.nome }));

  const content = (
    <>
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
                variant={isListening ? "destructive" : "microphone"}
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
                {cliente.id && cliente.tipo && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getTipoBadge(cliente.tipo).className}`}>
                    {getTipoBadge(cliente.tipo).label}
                  </span>
                )}
              </CardTitle>
              {cliente.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={limparCliente}
                >
                  <X className="h-3.5 w-3.5" />
                  Trocar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="col-span-2">
              <Label className="text-xs">Buscar cliente cadastrado</Label>
              <ClienteAutocompleteInput
                value={cliente.nome}
                onChange={selecionarClienteAutocomplete}
                placeholder="Nome, telefone ou endereço..."
              />
              {!cliente.id && cliente.nome.trim().length > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  💡 Cliente avulso — preencha os dados abaixo ou selecione da lista.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nome *</Label>
                <Input value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value, id: null })} placeholder="Nome do cliente" />
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
                  <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-2">
                     <div className="flex items-center justify-between gap-2">
                       <p className="font-medium text-sm truncate flex-1">{item.nome}</p>
                       <p className="font-bold text-primary text-sm whitespace-nowrap">
                         R$ {(item.quantidade * item.precoUnitario).toFixed(2)}
                       </p>
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removerItem(index)}>
                         <Trash2 className="h-3.5 w-3.5" />
                       </Button>
                     </div>
                     <div className="flex items-center justify-between gap-2">
                       <div className="flex items-center gap-1">
                         <span className="text-xs text-muted-foreground">R$</span>
                         <Input
                           type="number"
                           step="0.01"
                           min="0"
                           value={item.precoUnitario}
                           onChange={(e) => alterarPreco(index, Number(e.target.value))}
                           className="w-20 h-7 text-xs px-1"
                         />
                         <span className="text-xs text-muted-foreground">/ un</span>
                       </div>
                       <div className="flex items-center gap-1">
                         <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alterarQuantidade(index, -1)}>
                           <Minus className="h-4 w-4" />
                         </Button>
                         <Input
                           type="number"
                           min="1"
                           value={item.quantidade}
                           onChange={(e) => {
                             const newQtd = parseInt(e.target.value) || 1;
                             if (newQtd >= 1) alterarQuantidade(index, newQtd - item.quantidade);
                           }}
                           className="w-12 h-8 text-center text-base font-medium"
                         />
                         <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => alterarQuantidade(index, 1)}>
                           <Plus className="h-4 w-4" />
                         </Button>
                       </div>
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
        <PaymentSection
          pagamentos={pagamentos}
          onChange={setPagamentos}
          totalVenda={total}
          unidadeId={entregadorUnidadeId || undefined}
        />

        {/* Observação */}
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <Label className="text-xs">Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observações..." rows={2} />
          </CardContent>
        </Card>

        {/* Canal */}
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium shrink-0">Canal de Venda:</span>
              <Select value={canalVenda} onValueChange={setCanalVenda}>
                <SelectTrigger className="w-auto min-w-[160px] h-9 text-sm">
                  <SelectValue placeholder="Selecione o canal *" />
                </SelectTrigger>
                <SelectContent>
                  {todosCanais.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Finalizar */}
        <Button
          onClick={finalizarVenda}
          className="w-full h-14 text-lg gradient-primary text-white shadow-lg"
          disabled={itens.length === 0 || !cliente.nome || pagamentos.length === 0 || !canalVenda || isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <CheckCircle className="h-5 w-5 mr-2" />
          )}
          Finalizar Venda • R$ {total.toFixed(2)}
        </Button>
      </div>
    </>
  );

  if (noLayout) return content;
  return <EntregadorLayout title="Nova Venda">{content}</EntregadorLayout>;
}
