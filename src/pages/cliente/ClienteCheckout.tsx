import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ClienteLayout } from "@/components/cliente/ClienteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useCliente } from "@/contexts/ClienteContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, setCachedClienteId } from "@/lib/clienteAppLookup";
import {
  CreditCard,
  Banknote,
  QrCode,
  Wallet,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Home,
  Building,
  Plus,
  Star,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

const paymentMethods = [
  { id: "pix", label: "PIX", icon: QrCode, description: "Pagamento instantâneo" },
  { id: "dinheiro", label: "Dinheiro", icon: Banknote, description: "Pague na entrega" },
  { id: "cartao", label: "Cartão", icon: CreditCard, description: "Débito ou Crédito" },
  { id: "vale-gas", label: "Vale Gás", icon: Wallet, description: "Use seu vale" },
];

interface Endereco {
  id: string;
  apelido: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string | null;
  cep: string | null;
  principal: boolean | null;
}

export default function ClienteCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, cartTotal, clearCart, lojaSelecionadaId } = useCliente();
  const { user } = useAuth();

  const {
    couponDiscount = 0,
    walletDiscount = 0,
    appliedCoupon,
    finalTotal = cartTotal,
  } = location.state || {};

  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [changeFor, setChangeFor] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Endereços salvos
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [enderecoSelecionadoId, setEnderecoSelecionadoId] = useState<string | null>(null);
  const [showNovoEndereco, setShowNovoEndereco] = useState(false);
  const [novoEndereco, setNovoEndereco] = useState({
    rua: "", numero: "", complemento: "", bairro: "", referencia: ""
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("cliente_enderecos")
      .select("*")
      .eq("user_id", user.id)
      .order("principal", { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setEnderecos(data);
          // Pré-seleciona o principal
          const principal = data.find(e => e.principal) || data[0];
          setEnderecoSelecionadoId(principal.id);
        } else {
          // Sem endereços: mostra formulário
          setShowNovoEndereco(true);
        }
      });
  }, [user]);

  const enderecoSelecionado = enderecos.find(e => e.id === enderecoSelecionadoId);

  const buildEnderecoString = () => {
    if (enderecoSelecionado) {
      const e = enderecoSelecionado;
      return `${e.rua}, ${e.numero}${e.complemento ? ` - ${e.complemento}` : ""} - ${e.bairro}${e.cidade ? `, ${e.cidade}` : ""}`;
    }
    const e = novoEndereco;
    return `${e.rua}, ${e.numero}${e.complemento ? ` - ${e.complemento}` : ""} - ${e.bairro}${e.referencia ? ` (Ref: ${e.referencia})` : ""}`;
  };

  const handleSubmit = async () => {
    const usingNovo = showNovoEndereco && enderecos.length === 0;

    if (enderecoSelecionadoId == null && !usingNovo) {
      toast.error("Selecione um endereço de entrega");
      return;
    }
    if (usingNovo && (!novoEndereco.rua || !novoEndereco.numero || !novoEndereco.bairro)) {
      toast.error("Preencha o endereço completo");
      return;
    }

    setIsSubmitting(true);
    try {
      const enderecoCompleto = buildEnderecoString();

      // Empresa do usuário autenticado (fonte de verdade para RLS)
      let empresaId: string | null = null;
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("empresa_id")
          .eq("user_id", user.id)
          .maybeSingle();
        empresaId = (profileData as any)?.empresa_id || null;
      }

      if (!empresaId) {
        toast.error("Não foi possível identificar sua empresa. Faça login novamente.");
        setIsSubmitting(false);
        return;
      }

      // cliente_id: prioridade
      // (1) match por endereço já cadastrado na empresa → reaproveita o cliente
      // (2) match por telefone (normalizado em dígitos)
      // (3) match por email
      // (4) cria novo registro com nome significativo
      let clienteId: string | null = null;
      const userPhoneRaw = (user as any)?.phone || (user?.user_metadata as any)?.telefone || null;
      const userPhone = normalizePhone(userPhoneRaw);
      const userEmail = user?.email || null;
      const userNome =
        (user?.user_metadata as any)?.nome ||
        (user?.user_metadata as any)?.full_name ||
        null;

      // (1) Procura por endereço já cadastrado (mesma empresa)
      const enderecoRua = (enderecoSelecionado?.rua || novoEndereco.rua || "").trim();
      const enderecoNumero = (enderecoSelecionado?.numero || novoEndereco.numero || "").trim();
      const enderecoBairro = (enderecoSelecionado?.bairro || novoEndereco.bairro || "").trim();

      if (enderecoRua && enderecoNumero && enderecoBairro) {
        const { data: enderecosMatch } = await (supabase as any)
          .from("cliente_enderecos")
          .select("cliente_id, rua, numero, bairro, clientes!inner(id, empresa_id, telefone)")
          .ilike("rua", enderecoRua)
          .eq("numero", enderecoNumero)
          .ilike("bairro", enderecoBairro)
          .eq("clientes.empresa_id", empresaId)
          .limit(5);

        const hit = (enderecosMatch || []).find((e: any) => e.cliente_id);
        if (hit?.cliente_id) {
          clienteId = hit.cliente_id;
          // Atualiza telefone se estiver vazio ou diferente
          const telefoneAtual = normalizePhone(hit?.clientes?.telefone);
          if (userPhone && telefoneAtual !== userPhone) {
            await (supabase as any)
              .from("clientes")
              .update({ telefone: userPhone })
              .eq("id", clienteId);
          }
        }
      }

      // (2) telefone
      if (!clienteId && userPhone) {
        const { data: porTel } = await (supabase as any)
          .from("clientes")
          .select("id, telefone")
          .eq("empresa_id", empresaId)
          .not("telefone", "is", null)
          .limit(200);
        const hit = (porTel || []).find(
          (c: any) => normalizePhone(c.telefone) === userPhone
        );
        if (hit) clienteId = hit.id;
      }

      // (3) email
      if (!clienteId && userEmail) {
        const { data: porEmail } = await (supabase as any)
          .from("clientes")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("email", userEmail)
          .maybeSingle();
        if (porEmail?.id) clienteId = porEmail.id;
      }

      // (4) cria novo
      if (!clienteId) {
        const nomeBase =
          userNome ||
          (userEmail ? userEmail.split("@")[0] : null) ||
          (userPhone ? `Cliente ${userPhone.slice(-4)}` : null) ||
          "Cliente App";
        const { data: novoCliente, error: novoClienteErr } = await (supabase as any)
          .from("clientes")
          .insert({
            empresa_id: empresaId,
            nome: nomeBase,
            email: userEmail,
            telefone: userPhone,
            tipo: "varejo",
            ativo: true,
          })
          .select("id")
          .single();
        if (novoClienteErr) {
          console.error("Erro ao criar cliente:", novoClienteErr);
        } else {
          clienteId = novoCliente?.id || null;
        }
      }

      if (!clienteId) {
        toast.error("Não foi possível identificar seu cadastro de cliente.");
        setIsSubmitting(false);
        return;
      }

      // Cache local para que ClienteHome/Historico achem rapidamente
      setCachedClienteId(clienteId);

      // Unidade: prefere a loja escolhida pelo cliente (se pertencer à empresa);
      // fallback: primeira unidade ativa da empresa (satisfaz tenant_isolation_pedidos)
      let unidadeId: string | null = null;
      if (lojaSelecionadaId) {
        const { data: lojaData } = await (supabase as any)
          .from("unidades")
          .select("id")
          .eq("id", lojaSelecionadaId)
          .eq("empresa_id", empresaId)
          .eq("ativo", true)
          .maybeSingle();
        unidadeId = lojaData?.id || null;
      }
      if (!unidadeId) {
        const { data: unidadeData } = await (supabase as any)
          .from("unidades")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("ativo", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        unidadeId = unidadeData?.id || null;
      }

      if (!unidadeId) {
        toast.error("Nenhuma unidade ativa disponível para receber o pedido.");
        setIsSubmitting(false);
        return;
      }

      const { data: pedido, error: pedidoError } = await (supabase as any)
        .from("pedidos")
        .insert({
          cliente_id: clienteId,
          unidade_id: unidadeId,
          endereco_entrega: enderecoCompleto,
          forma_pagamento: paymentMethods.find(p => p.id === paymentMethod)?.label || paymentMethod,
          valor_total: finalTotal,
          status: "pendente",
          canal_venda: "Aplicativo",
          origem_pedido: "app_cliente",
          observacoes: [
            userNome || userEmail || userPhone ? `Cliente App: ${userNome || userEmail || userPhone}${userPhone ? ` (${userPhone})` : ""}` : null,
            changeFor ? `Troco para R$ ${changeFor}` : null,
          ].filter(Boolean).join(" — ") || null,
        })
        .select("id")
        .single();


      if (pedidoError) throw pedidoError;

      const itens = cart.map(item => ({
        pedido_id: pedido.id,
        produto_id: item.id,
        quantidade: item.quantity,
        preco_unitario: item.price,
      }));

      const { error: itensError } = await supabase
        .from("pedido_itens")
        .insert(itens);

      if (itensError) throw itensError;

      clearCart();
      try { localStorage.setItem("last_pedido_id", pedido.id); } catch {}
      toast.success("Pedido realizado com sucesso! 🎉");
      navigate(`/cliente/rastreamento/${pedido.id}`);

    } catch (error: any) {
      console.error("Erro ao criar pedido:", error);
      const msg = error?.message || error?.details || "Tente novamente.";
      toast.error(`Erro ao processar pedido: ${msg}`);

    } finally {
      setIsSubmitting(false);
    }
  };

  const ApelidoIcon = ({ apelido }: { apelido: string }) => {
    if (apelido === "Casa") return <Home className="h-4 w-4 text-primary" />;
    if (apelido === "Trabalho") return <Building className="h-4 w-4 text-primary" />;
    return <MapPin className="h-4 w-4 text-primary" />;
  };

  return (
    <ClienteLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Finalizar Pedido</h1>
        </div>

        {/* Endereço de Entrega */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço de Entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {enderecos.length > 0 && (
              <>
                {/* Lista de endereços salvos */}
                <RadioGroup
                  value={enderecoSelecionadoId || ""}
                  onValueChange={(val) => {
                    setEnderecoSelecionadoId(val);
                    setShowNovoEndereco(false);
                  }}
                >
                  {enderecos.map((e) => (
                    <label
                      key={e.id}
                      className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                        enderecoSelecionadoId === e.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value={e.id} />
                      <ApelidoIcon apelido={e.apelido} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{e.apelido}</span>
                          {e.principal && (
                            <Badge variant="secondary" className="text-xs gap-0.5 px-1.5 py-0">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              Principal
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {e.rua}, {e.numero}{e.complemento ? ` - ${e.complemento}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.bairro}{e.cidade ? `, ${e.cidade}` : ""}
                        </p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>

                {/* Botão adicionar novo */}
                <Button
                  variant="ghost"
                  className="w-full gap-2 border border-dashed"
                  onClick={() => {
                    setShowNovoEndereco(!showNovoEndereco);
                    if (!showNovoEndereco) setEnderecoSelecionadoId(null);
                    else setEnderecoSelecionadoId(enderecos[0]?.id || null);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {showNovoEndereco ? "Cancelar novo endereço" : "Usar outro endereço"}
                </Button>
              </>
            )}

            {/* Formulário para endereço sem salvar */}
            {(showNovoEndereco || enderecos.length === 0) && (
              <div className="space-y-3 pt-1">
                {enderecos.length === 0 && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Nenhum endereço salvo. Preencha abaixo ou
                    <button
                      className="text-primary underline"
                      onClick={() => navigate("/cliente/enderecos")}
                    >
                      adicione um fixo
                    </button>.
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label>Rua</Label>
                    <Input
                      placeholder="Nome da rua"
                      value={novoEndereco.rua}
                      onChange={e => setNovoEndereco(p => ({ ...p, rua: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Número</Label>
                    <Input
                      placeholder="Nº"
                      value={novoEndereco.numero}
                      onChange={e => setNovoEndereco(p => ({ ...p, numero: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Complemento</Label>
                    <Input
                      placeholder="Apto, bloco..."
                      value={novoEndereco.complemento}
                      onChange={e => setNovoEndereco(p => ({ ...p, complemento: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input
                      placeholder="Bairro"
                      value={novoEndereco.bairro}
                      onChange={e => setNovoEndereco(p => ({ ...p, bairro: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Ponto de Referência</Label>
                  <Textarea
                    placeholder="Ex: Próximo ao mercado..."
                    value={novoEndereco.referencia}
                    onChange={e => setNovoEndereco(p => ({ ...p, referencia: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* Atalho para gerenciar endereços */}
            {enderecos.length > 0 && (
              <button
                onClick={() => navigate("/cliente/enderecos")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <MapPin className="h-3 w-3" />
                Gerenciar endereços salvos
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </CardContent>
        </Card>

        {/* Forma de Pagamento */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Forma de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div className="space-y-2">
                {paymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                      paymentMethod === method.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem value={method.id} />
                    <method.icon className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{method.label}</p>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </RadioGroup>

            {paymentMethod === "dinheiro" && (
              <div className="mt-4">
                <Label>Troco para quanto?</Label>
                <Input
                  type="number"
                  placeholder="Ex: 150.00"
                  value={changeFor}
                  onChange={e => setChangeFor(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tempo estimado */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Tempo estimado de entrega</p>
                <p className="text-sm text-muted-foreground">30 - 50 minutos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumo do Pedido */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resumo do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cart.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.name}</span>
                <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}

            <Separator className="my-2" />

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>R$ {cartTotal.toFixed(2)}</span>
            </div>

            {couponDiscount > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Desconto cupom</span>
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

            <Separator className="my-2" />

            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span className="text-primary">R$ {finalTotal.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Botão confirmar */}
        <Button
          className="w-full h-12 text-lg gap-2"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            "Processando..."
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Confirmar Pedido
            </>
          )}
        </Button>
      </div>
    </ClienteLayout>
  );
}
