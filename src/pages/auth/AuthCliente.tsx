import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthForm } from "@/hooks/useAuthForm";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Loader2, Eye, EyeOff, ShoppingBag, AlertTriangle } from "lucide-react";
import { detectSubdomainApp } from "@/lib/subdomain";

interface EmpresaInfo {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
}




function SimpleLoginForm({ form }: { form: ReturnType<typeof useAuthForm> }) {
  return (
    <form onSubmit={form.handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cliente-login-phone">Celular</Label>
        <Input
          id="cliente-login-phone"
          type="tel"
          placeholder="(11) 99999-9999"
          value={form.loginPhone}
          onChange={(e) => form.setLoginPhone(e.target.value)}
          disabled={form.isLoading}
        />
        {form.errors.phone && <p className="text-sm text-destructive">{form.errors.phone}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="cliente-login-password">Senha</Label>
        <div className="relative">
          <Input
            id="cliente-login-password"
            type={form.showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={form.loginPassword}
            onChange={(e) => form.setLoginPassword(e.target.value)}
            disabled={form.isLoading}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => form.setShowPassword(!form.showPassword)}
          >
            {form.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {form.errors.password && <p className="text-sm text-destructive">{form.errors.password}</p>}
      </div>

      <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={form.isLoading}>
        {form.isLoading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}

function SignupForm({ form }: { form: ReturnType<typeof useAuthForm> }) {
  return (
    <form onSubmit={form.handleSignup} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cliente-signup-name">Nome completo</Label>
        <Input
          id="cliente-signup-name"
          type="text"
          placeholder="Seu nome"
          value={form.signupName}
          onChange={(e) => form.setSignupName(e.target.value)}
          disabled={form.isLoading}
        />
        {form.errors.fullName && <p className="text-sm text-destructive">{form.errors.fullName}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="cliente-signup-phone">Celular (WhatsApp)</Label>
        <Input
          id="cliente-signup-phone"
          type="tel"
          placeholder="(11) 99999-9999"
          value={form.signupPhone}
          onChange={(e) => form.setSignupPhone(e.target.value)}
          disabled={form.isLoading}
        />
        {form.errors.phone && <p className="text-sm text-destructive">{form.errors.phone}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="cliente-signup-password">Senha</Label>
        <div className="relative">
          <Input
            id="cliente-signup-password"
            type={form.showSignupPassword ? "text" : "password"}
            placeholder="Mínimo 6 caracteres"
            value={form.signupPassword}
            onChange={(e) => form.setSignupPassword(e.target.value)}
            disabled={form.isLoading}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => form.setShowSignupPassword(!form.showSignupPassword)}
          >
            {form.showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {form.errors.password && <p className="text-sm text-destructive">{form.errors.password}</p>}
      </div>

      <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={form.isLoading}>
        {form.isLoading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando conta...</>
        ) : (
          "Criar minha conta"
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Ao criar sua conta, você poderá fazer pedidos de gás direto pelo app.
      </p>
    </form>
  );
}

export default function AuthCliente() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, roles, loading, signOut } = useAuth();
  const isSubdomain = detectSubdomainApp() === "cliente";

  const urlSlug = searchParams.get("empresa");
  const urlUnidade = searchParams.get("unidade");
  const [showSignup, setShowSignup] = useState(false);
  const [empresaSlug, setEmpresaSlug] = useState<string | undefined>(
    urlSlug || localStorage.getItem("cliente_empresa_slug") || undefined
  );
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null);
  const [empresaLoading, setEmpresaLoading] = useState(!!empresaSlug);
  const [empresaError, setEmpresaError] = useState(false);
  const [unidadeNome, setUnidadeNome] = useState<string | null>(null);

  const form = useAuthForm(empresaSlug);

  useEffect(() => {
    if (urlSlug) {
      localStorage.setItem("cliente_empresa_slug", urlSlug);
      setEmpresaSlug(urlSlug);
    }
  }, [urlSlug]);

  // Fetch unit name when unidade param is present
  useEffect(() => {
    if (!urlUnidade) return;
    supabase
      .from("unidades")
      .select("nome")
      .eq("id", urlUnidade)
      .single()
      .then(({ data }) => {
        if (data?.nome) setUnidadeNome(data.nome);
      });
  }, [urlUnidade]);

  useEffect(() => {
    async function fetchEmpresa() {
      if (!empresaSlug) {
        setEmpresaLoading(false);
        if (isSubdomain) setEmpresaError(true);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("get_empresa_by_slug", { _slug: empresaSlug });
        if (error || !data || (Array.isArray(data) && data.length === 0)) {
          setEmpresaError(true);
          localStorage.removeItem("cliente_empresa_slug");
        } else {
          const empresaData = Array.isArray(data) ? data[0] : data;
          setEmpresa(empresaData as EmpresaInfo);
          setEmpresaError(false);
        }
      } catch {
        setEmpresaError(true);
      } finally {
        setEmpresaLoading(false);
      }
    }

    fetchEmpresa();
  }, [empresaSlug]);

  useEffect(() => {
    const nome = empresa?.nome || "GásFácil Pro";
    document.title = `${nome} — Área do Cliente`;
  }, [empresa]);

  const [roleError, setRoleError] = useState(false);

  useEffect(() => {
    if (!user || loading) return;
    if (roles.length === 0) return;
    
    if (!roles.includes("cliente")) {
      signOut();
      setRoleError(true);
      return;
    }
    navigate("/cliente");
  }, [user, loading, roles, navigate, signOut]);

  if (loading || empresaLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSubdomain && empresaError && !empresa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-background dark:via-background dark:to-muted/20 p-4">
        <Card className="w-full max-w-md border-orange-200/50 dark:border-primary/20">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <CardTitle className="text-xl font-bold">Acesso Indisponível</CardTitle>
            <CardDescription className="text-base">
              Para acessar o aplicativo do cliente, utilize o link fornecido pela sua distribuidora de gás.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Exemplo: <code className="bg-muted px-2 py-1 rounded text-xs">clientes.gasfacilpro.com.br?empresa=nome-da-empresa</code>
            </p>
            <p className="text-xs text-muted-foreground">
              Se você é um administrador, acesse pelo{" "}
              <a href="https://app.gasfacilpro.com.br" className="text-primary underline">sistema ERP</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-background dark:via-background dark:to-muted/20 p-4">
      <Card className="w-full max-w-md border-orange-200/50 dark:border-primary/20">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            {empresa?.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.nome}
                className="h-16 w-16 rounded-2xl object-cover shadow-lg"
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                <Flame className="h-10 w-10 text-white" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <ShoppingBag className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-2xl font-bold">{empresa?.nome || "GásFácil Pro"}</CardTitle>
          </div>
          <CardDescription>
            Peça seu gás com rapidez e acompanhe suas entregas
          </CardDescription>
        </CardHeader>

        <CardContent>
          {roleError && (
            <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              Esta conta não é de cliente. Se você é administrador, acesse pelo sistema ERP.
            </div>
          )}
          {form.errors.general && (
            <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {form.errors.general}
            </div>
          )}

          {showSignup ? (
            <>
              <SignupForm form={form} />
              <p className="text-center text-sm text-muted-foreground mt-4">
                Já tem conta?{" "}
                <button
                  type="button"
                  onClick={() => setShowSignup(false)}
                  className="text-primary hover:underline font-medium"
                >
                  Faça login
                </button>
              </p>
            </>
          ) : (
            <>
              <SimpleLoginForm form={form} />
              <p className="text-center text-sm text-muted-foreground mt-4">
                Não tem conta?{" "}
                <button
                  type="button"
                  onClick={() => setShowSignup(true)}
                  className="text-primary hover:underline font-medium"
                >
                  Crie sua conta
                </button>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
