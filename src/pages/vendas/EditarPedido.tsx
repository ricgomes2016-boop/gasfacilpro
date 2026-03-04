import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Loader2, MapPin, Map, CreditCard, User, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ProductSearch, ItemVenda } from "@/components/vendas/ProductSearch";
import { DeliveryPersonSelect } from "@/components/vendas/DeliveryPersonSelect";
import { PedidoStatus } from "@/types/pedido";
import { useUnidade } from "@/contexts/UnidadeContext";
import { geocodeAddress } from "@/lib/geocoding";
import { MapPickerDialog } from "@/components/ui/map-picker-dialog";
import type { GeocodingResult } from "@/lib/geocoding";

interface PedidoData {
  id: string;
  cliente_id: string | null;
  cliente_nome: string;
  endereco_entrega: string;
  observacoes: string;
  status: PedidoStatus;
  entregador_id: string | null;
  entregador_nome: string | null;
  valor_total: number;
  latitude: number | null;
  longitude: number | null;
}

interface EnderecoFields {
  endereco: string;
  numero: string;
  bairro: string;
  complemento: string;
  cidade: string;
  cep: string;
}

const formasPagamento = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "fiado", label: "Fiado" },
  { value: "Vale Gás", label: "Vale Gás" },
];

export default function EditarPedido() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pedido, setPedido] = useState<PedidoData | null>(null);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [enderecoFields, setEnderecoFields] = useState<EnderecoFields>({
    endereco: "", numero: "", bairro: "", complemento: "", cidade: "", cep: "",
  });
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [observacoes, setObservacoes] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [entregador, setEntregador] = useState<{ id: string | null; nome: string | null }>({ id: null, nome: null });
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Client search
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteResults, setClienteResults] = useState<Array<{ id: string; nome: string; telefone: string | null; endereco: string | null; numero: string | null; bairro: string | null; cidade: string | null; cep: string | null }>>([]);
  const [showClienteResults, setShowClienteResults] = useState(false);
  const clienteSearchRef = useRef<HTMLDivElement>(null);
  const debounceClienteRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clienteSearchRef.current && !clienteSearchRef.current.contains(event.target as Node)) {
        setShowClienteResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchCliente = useCallback((term: string) => {
    if (debounceClienteRef.current) clearTimeout(debounceClienteRef.current);
    if (term.length < 2) { setClienteResults([]); setShowClienteResults(false); return; }
    debounceClienteRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, telefone, endereco, numero, bairro, cidade, cep")
        .eq("ativo", true)
        .or(`nome.ilike.%${term}%,telefone.ilike.%${term}%`)
        .limit(8);
      if (data) { setClienteResults(data); setShowClienteResults(data.length > 0); }
    }, 300);
  }, []);

  const selectCliente = (cliente: typeof clienteResults[0]) => {
    setPedido(prev => prev ? { ...prev, cliente_id: cliente.id, cliente_nome: cliente.nome } : prev);
    setEnderecoFields({
      endereco: cliente.endereco || "",
      numero: cliente.numero || "",
      bairro: cliente.bairro || "",
      complemento: "",
      cidade: cliente.cidade || "",
      cep: cliente.cep || "",
    });
    setClienteSearch("");
    setShowClienteResults(false);
  };

  useEffect(() => {
    if (id) fetchPedido(id);
  }, [id]);

  const fetchPedido = async (pedidoId: string) => {
    try {
      const { data: pedidoData, error: pedidoError } = await supabase
        .from("pedidos")
        .select(`
          *,
          clientes (id, nome, endereco, numero, bairro, cidade, cep),
          entregadores (id, nome)
        `)
        .eq("id", pedidoId)
        .single();

      if (pedidoError) throw pedidoError;

      const { data: itensData, error: itensError } = await supabase
        .from("pedido_itens")
        .select(`*, produtos (id, nome, preco)`)
        .eq("pedido_id", pedidoId);

      if (itensError) throw itensError;

      const cliente = pedidoData.clientes;

      // Populate separate address fields from pedido columns or fallback to client
      const endFields: EnderecoFields = {
        endereco: pedidoData.endereco_entrega || cliente?.endereco || "",
        numero: pedidoData.numero_entrega || cliente?.numero || "",
        bairro: pedidoData.bairro_entrega || cliente?.bairro || "",
        complemento: pedidoData.complemento_entrega || "",
        cidade: pedidoData.cidade_entrega || cliente?.cidade || "",
        cep: pedidoData.cep_entrega || cliente?.cep || "",
      };

      const enderecoCompleto = pedidoData.endereco_entrega ||
        (cliente ? [cliente.endereco, cliente.bairro, cliente.cidade].filter(Boolean).join(", ") : "");

      setPedido({
        id: pedidoData.id,
        cliente_id: pedidoData.cliente_id,
        cliente_nome: cliente?.nome || "Cliente não identificado",
        endereco_entrega: enderecoCompleto,
        observacoes: pedidoData.observacoes || "",
        status: (pedidoData.status as PedidoStatus) || "pendente",
        entregador_id: pedidoData.entregador_id,
        entregador_nome: pedidoData.entregadores?.nome || null,
        valor_total: Number(pedidoData.valor_total) || 0,
        latitude: pedidoData.latitude || null,
        longitude: pedidoData.longitude || null,
      });

      setEnderecoFields(endFields);
      setCoords({ lat: pedidoData.latitude || null, lng: pedidoData.longitude || null });
      setObservacoes(pedidoData.observacoes || "");
      setFormaPagamento(pedidoData.forma_pagamento || "");
      setEntregador({ id: pedidoData.entregador_id, nome: pedidoData.entregadores?.nome || null });

      const itensFormatados: ItemVenda[] = (itensData || []).map((item) => ({
        id: item.id,
        produto_id: item.produto_id || "",
        nome: item.produtos?.nome || "Produto",
        quantidade: item.quantidade,
        preco_unitario: Number(item.preco_unitario),
        total: item.quantidade * Number(item.preco_unitario),
      }));

      setItens(itensFormatados);
    } catch (error: any) {
      console.error("Erro ao buscar pedido:", error);
      toast({ title: "Erro ao carregar pedido", description: error.message, variant: "destructive" });
      navigate("/vendas/pedidos");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof EnderecoFields, value: string) => {
    setEnderecoFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddressBlur = async () => {
    const addr = [enderecoFields.endereco, enderecoFields.numero, enderecoFields.bairro, enderecoFields.cidade].filter(Boolean).join(", ");
    if (addr.length < 5) return;
    setIsGeocoding(true);
    const result = await geocodeAddress(addr);
    if (result) {
      setCoords({ lat: result.latitude, lng: result.longitude });
      setEnderecoFields((prev) => ({
        ...prev,
        bairro: prev.bairro || result.bairro || "",
        cep: prev.cep || result.cep || "",
      }));
    }
    setIsGeocoding(false);
  };

  const handleCepBlur = async () => {
    const cep = (enderecoFields.cep || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    setIsGeocoding(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setEnderecoFields((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
        }));
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    }
    setIsGeocoding(false);
  };

  const handleMapConfirm = (result: GeocodingResult) => {
    setCoords({ lat: result.latitude, lng: result.longitude });
    setEnderecoFields((prev) => ({
      ...prev,
      endereco: result.endereco || prev.endereco,
      bairro: result.bairro || prev.bairro,
      cidade: result.cidade || prev.cidade,
      cep: result.cep || prev.cep,
    }));
  };

  const buildEnderecoCompleto = () => {
    return [enderecoFields.endereco, enderecoFields.numero, enderecoFields.bairro, enderecoFields.cidade]
      .filter(Boolean).join(", ");
  };

  const handleSalvar = async () => {
    if (!pedido || !id) return;

    if (itens.length === 0) {
      toast({ title: "Erro", description: "O pedido deve ter pelo menos um produto.", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const novoTotal = itens.reduce((acc, item) => acc + item.total, 0);
      const enderecoCompleto = buildEnderecoCompleto();

      const { error: pedidoError } = await supabase
        .from("pedidos")
        .update({
          cliente_id: pedido.cliente_id,
          endereco_entrega: enderecoCompleto,
          numero_entrega: enderecoFields.numero || null,
          bairro_entrega: enderecoFields.bairro || null,
          complemento_entrega: enderecoFields.complemento || null,
          cidade_entrega: enderecoFields.cidade || null,
          cep_entrega: enderecoFields.cep || null,
          latitude: coords.lat,
          longitude: coords.lng,
          observacoes,
          forma_pagamento: formaPagamento || null,
          entregador_id: entregador.id,
          valor_total: novoTotal,
        })
        .eq("id", id);

      if (pedidoError) throw pedidoError;

      const { error: deleteError } = await supabase.from("pedido_itens").delete().eq("pedido_id", id);
      if (deleteError) throw deleteError;

      const novosItens = itens.map((item) => ({
        pedido_id: id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
      }));

      const { error: insertError } = await supabase.from("pedido_itens").insert(novosItens);
      if (insertError) throw insertError;

      toast({ title: "Pedido atualizado!", description: `Pedido #${id.slice(0, 6)} foi salvo com sucesso.` });
      navigate("/vendas/pedidos");
    } catch (error: any) {
      console.error("Erro ao salvar pedido:", error);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSelecionarEntregador = (id: string, nome: string) => {
    setEntregador({ id, nome });
  };

  const totalVenda = itens.reduce((acc, item) => acc + item.total, 0);
  const isDisabled = pedido?.status === "entregue" || pedido?.status === "cancelado";

  const getStatusBadge = (status: PedidoStatus) => {
    const statusConfig = {
      pendente: { label: "Pendente", variant: "secondary" as const },
      em_rota: { label: "Em Rota", variant: "default" as const },
      entregue: { label: "Entregue", variant: "default" as const },
      cancelado: { label: "Cancelado", variant: "destructive" as const },
    };
    const config = statusConfig[status] || statusConfig.pendente;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <MainLayout>
        <Header title="Editar Pedido" subtitle="Carregando..." />
        <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48" />
              <Skeleton className="h-64" />
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!pedido) {
    return (
      <MainLayout>
        <Header title="Pedido não encontrado" />
        <div className="p-3 sm:p-4 md:p-6"><p className="text-muted-foreground">Pedido não encontrado.</p></div>
      </MainLayout>
    );
  }

  return (
    <>
      <MainLayout>
        <Header title="Editar Pedido" subtitle={`#${pedido.id.slice(0, 6)} • ${pedido.cliente_nome}`} />
        <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigate("/vendas/pedidos")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {getStatusBadge(pedido.status)}
          </div>

          {isDisabled && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">
              ⚠️ Este pedido já foi {pedido.status === "entregue" ? "entregue" : "cancelado"} e não pode ser editado.
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Cliente */}
              <Card ref={clienteSearchRef}>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-5 w-5" />
                    Cliente: {pedido.cliente_nome}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar outro cliente por nome ou telefone..."
                      value={clienteSearch}
                      onChange={(e) => {
                        setClienteSearch(e.target.value);
                        searchCliente(e.target.value);
                      }}
                      className="pl-10"
                      disabled={isDisabled}
                    />
                    {showClienteResults && clienteResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                        {clienteResults.map((c) => (
                          <button
                            key={c.id}
                            className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-0"
                            onClick={() => selectCliente(c)}
                          >
                            <p className="font-medium text-sm">{c.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.telefone} • {c.endereco}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Endereço de Entrega */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-5 w-5" />
                    Endereço de Entrega
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-3 grid gap-1.5">
                      <Label className="text-xs">Logradouro</Label>
                      <div className="flex gap-1">
                        <Input
                          value={enderecoFields.endereco}
                          onChange={(e) => updateField("endereco", e.target.value)}
                          onBlur={handleAddressBlur}
                          placeholder="Rua, Avenida..."
                          className="flex-1"
                          disabled={isDisabled}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => setMapPickerOpen(true)}
                          disabled={isDisabled}
                        >
                          {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Map className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Nº</Label>
                      <Input
                        value={enderecoFields.numero}
                        onChange={(e) => updateField("numero", e.target.value)}
                        placeholder="123"
                        disabled={isDisabled}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Bairro</Label>
                      <Input
                        value={enderecoFields.bairro}
                        onChange={(e) => updateField("bairro", e.target.value)}
                        placeholder="Bairro"
                        disabled={isDisabled}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Cidade</Label>
                      <Input
                        value={enderecoFields.cidade}
                        onChange={(e) => updateField("cidade", e.target.value)}
                        placeholder="Cidade"
                        disabled={isDisabled}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">CEP</Label>
                      <Input
                        value={enderecoFields.cep}
                        onChange={(e) => updateField("cep", e.target.value)}
                        onBlur={handleCepBlur}
                        placeholder="00000-000"
                        disabled={isDisabled}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Complemento</Label>
                      <Input
                        value={enderecoFields.complemento}
                        onChange={(e) => updateField("complemento", e.target.value)}
                        placeholder="Apto, Bloco..."
                        disabled={isDisabled}
                      />
                    </div>
                    <div className="flex items-end">
                      {coords.lat && coords.lng && (
                        <p className="text-[10px] text-muted-foreground pb-2">
                          📍 {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Observações</Label>
                    <Textarea
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Observações do pedido..."
                      className="mt-1"
                      disabled={isDisabled}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Forma de Pagamento */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-5 w-5" />
                    Forma de Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento} disabled={isDisabled}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {formasPagamento.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <DeliveryPersonSelect
                value={entregador.id}
                onChange={handleSelecionarEntregador}
                endereco={buildEnderecoCompleto()}
              />

              <ProductSearch itens={itens} onChange={setItens} unidadeId={unidadeAtual?.id} />
            </div>

            {/* Resumo */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resumo do Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cliente</span>
                      <span className="font-medium">{pedido.cliente_nome}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Entregador</span>
                      <span className="font-medium">{entregador.nome || "Não atribuído"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Itens</span>
                      <span className="font-medium">{itens.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pagamento</span>
                      <span className="font-medium">{formasPagamento.find(f => f.value === formaPagamento)?.label || "Não informado"}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Total</span>
                      <span className="text-2xl font-bold text-primary">
                        R$ {totalVenda.toFixed(2)}
                      </span>
                    </div>
                    {pedido.valor_total !== totalVenda && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Valor original: R$ {pedido.valor_total.toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-4">
                    <Button className="w-full" onClick={handleSalvar} disabled={saving || isDisabled}>
                      {saving ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                      ) : (
                        <><Save className="h-4 w-4 mr-2" />Salvar Alterações</>
                      )}
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => navigate("/vendas/pedidos")}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </MainLayout>

      <MapPickerDialog
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        initialPosition={coords.lat && coords.lng ? { lat: coords.lat, lng: coords.lng } : null}
        onConfirm={handleMapConfirm}
      />
    </>
  );
}