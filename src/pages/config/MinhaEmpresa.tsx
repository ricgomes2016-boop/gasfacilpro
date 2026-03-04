import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Save, Loader2, Users, MapPin, Crown, Check, ExternalLink, RefreshCw, Plus, Minus } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PLANS, formatPrice } from "@/config/stripePlans";
import { useSearchParams } from "react-router-dom";

export default function MinhaEmpresa() {
  const { empresa, refetch, subscription, subscriptionLoading, checkSubscription } = useEmpresa();
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const [selectedQuantity, setSelectedQuantity] = useState<Record<string, number>>({
    basico: 1,
    standard: 1,
    enterprise: 1,
  });

  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [totalUnidades, setTotalUnidades] = useState(0);

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    if (checkoutStatus === "success") {
      toast.success("Assinatura realizada com sucesso! Atualizando...");
      checkSubscription();
    } else if (checkoutStatus === "cancel") {
      toast.info("Checkout cancelado.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (empresa) {
      setNome(empresa.nome);
      setCnpj(empresa.cnpj || "");
      setEmail(empresa.email || "");
      setTelefone(empresa.telefone || "");
      fetchStats();
    }
  }, [empresa]);

  const fetchStats = async () => {
    if (!empresa) return;
    const [usersRes, unidadesRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id),
      supabase.from("unidades").select("id", { count: "exact", head: true }).eq("empresa_id", empresa.id),
    ]);
    setTotalUsuarios(usersRes.count || 0);
    setTotalUnidades(unidadesRes.count || 0);
  };

  const handleSave = async () => {
    if (!empresa) return;
    setIsLoading(true);
    const { error } = await supabase
      .from("empresas")
      .update({ nome, cnpj: cnpj || null, email: email || null, telefone: telefone || null })
      .eq("id", empresa.id);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Dados da empresa atualizados!");
      await refetch();
    }
    setIsLoading(false);
  };

  const handleCheckout = async (priceId: string, planKey: string) => {
    setCheckoutLoading(priceId);
    try {
      const qty = selectedQuantity[planKey] || 1;
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId, quantity: qty },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast.error("Erro ao iniciar checkout: " + error.message);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast.error("Erro ao abrir portal: " + error.message);
    } finally {
      setPortalLoading(false);
    }
  };

  const updateQuantity = (planKey: string, delta: number) => {
    setSelectedQuantity((prev) => ({
      ...prev,
      [planKey]: Math.max(1, (prev[planKey] || 1) + delta),
    }));
  };

  if (!empresa) {
    return (
      <MainLayout>
        <Header title="Minha Empresa" subtitle="Carregando..." />
        <div className="p-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header title="Minha Empresa" subtitle="Gerencie os dados da sua distribuidora" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl">
        {/* Plan & Usage */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Plano</CardTitle>
              <Crown className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <Badge variant="default" className="text-lg px-3 py-1">
                {subscription.plan?.name || empresa.plano}
              </Badge>
              {subscription.subscribed && (
                <p className="text-xs text-muted-foreground mt-2">
                  {subscription.unitQuantity} unidade{subscription.unitQuantity !== 1 ? "s" : ""} contratada{subscription.unitQuantity !== 1 ? "s" : ""}
                </p>
              )}
              {subscription.subscribed && subscription.subscriptionEnd && (
                <p className="text-xs text-muted-foreground mt-1">
                  Renova em {new Date(subscription.subscriptionEnd).toLocaleDateString("pt-BR")}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalUsuarios} <span className="text-sm font-normal text-muted-foreground">/ {empresa.plano_max_usuarios}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Unidades</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalUnidades} <span className="text-sm font-normal text-muted-foreground">/ {empresa.plano_max_unidades}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plans */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Planos e Assinatura
                </CardTitle>
                <CardDescription>Preço por unidade/mês — escolha quantas unidades precisar</CardDescription>
              </div>
              <div className="flex gap-2">
                {subscription.subscribed && (
                  <Button variant="outline" size="sm" onClick={handleManageSubscription} disabled={portalLoading}>
                    {portalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                    Gerenciar Assinatura
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={checkSubscription} disabled={subscriptionLoading}>
                  <RefreshCw className={`h-4 w-4 ${subscriptionLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(PLANS).map(([key, plan]) => {
                const isActive = subscription.subscribed && subscription.planKey === key;
                const qty = selectedQuantity[key] || 1;
                const totalPrice = plan.price * qty;

                return (
                  <Card
                    key={key}
                    className={`relative ${isActive ? "border-primary ring-2 ring-primary/20" : ""}`}
                  >
                    {isActive && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">Seu Plano</Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <div className="text-3xl font-bold text-primary">
                        {formatPrice(plan.price)}
                        <span className="text-sm font-normal text-muted-foreground">/unidade/mês</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {!isActive && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Quantas unidades?</Label>
                            <div className="flex items-center justify-center gap-3">
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(key, -1)} disabled={qty <= 1}>
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="text-xl font-bold w-8 text-center">{qty}</span>
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(key, 1)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-center text-sm text-muted-foreground">
                              Total: <span className="font-semibold text-foreground">{formatPrice(totalPrice)}/mês</span>
                            </p>
                            <p className="text-center text-xs text-muted-foreground">
                              {plan.usersPerUnit * qty} usuários inclusos
                            </p>
                          </div>
                        </>
                      )}

                      {isActive ? (
                        <Button variant="outline" className="w-full" disabled>
                          Plano Atual ({subscription.unitQuantity} unidade{subscription.unitQuantity !== 1 ? "s" : ""})
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          variant={key === "standard" ? "default" : "outline"}
                          onClick={() => handleCheckout(plan.priceId, key)}
                          disabled={checkoutLoading === plan.priceId}
                        >
                          {checkoutLoading === plan.priceId ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          {subscription.subscribed ? "Trocar Plano" : "Assinar"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Dados da Empresa
            </CardTitle>
            <CardDescription>Informações cadastrais da sua distribuidora</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Empresa</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Slug: <code className="bg-muted px-2 py-0.5 rounded">{empresa.slug}</code>
              </p>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
