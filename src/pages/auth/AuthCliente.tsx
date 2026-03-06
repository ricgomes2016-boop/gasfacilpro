import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthForm } from "@/hooks/useAuthForm";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Flame, Loader2, Eye, EyeOff, ShoppingBag, AlertTriangle } from "lucide-react";

interface EmpresaInfo {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
}

function LoginForm({ form }: { form: ReturnType<typeof useAuthForm> }) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    form.setErrors({});
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      form.setErrors({ general: "Erro ao fazer login com Google. Tente novamente." });
    }
    setIsGoogleLoading(false);
  };

  return (
    <form onSubmit={form.handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cliente-login-email">Email</Label>
        <Input
          id="cliente-login-email"
          type="email"
          placeholder="seu@email.com"
          value={form.loginEmail}
          onChange={(e) => form.setLoginEmail(e.target.value)}
          disabled={form.isLoading}
        />
        {form.errors.email && <p className="text-sm text-destructive">{form.errors.email}</p>}
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

      <div className="relative my-2">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
          ou
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleLogin}
        disabled={isGoogleLoading || form.isLoading}
      >
        {isGoogleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        Entrar com Google
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
        <Label htmlFor="cliente-signup-email">Email</Label>
        <Input
          id="cliente-signup-email"
          type="email"
          placeholder="seu@email.com"
          value={form.signupEmail}
          onChange={(e) => form.setSignupEmail(e.target.value)}
          disabled={form.isLoading}
        />
        {form.errors.email && <p className="text-sm text-destructive">{form.errors.email}</p>}
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
  const { user, loading } = useAuth();

  // Resolve empresa slug: URL param > localStorage
  const urlSlug = searchParams.get("empresa");
  const [empresaSlug, setEmpresaSlug] = useState<string | undefined>(
    urlSlug || localStorage.getItem("cliente_empresa_slug") || undefined
  );
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null);
  const [empresaLoading, setEmpresaLoading] = useState(true);
  const [empresaError, setEmpresaError] = useState(false);

  const form = useAuthForm(empresaSlug);

  // Persist slug from URL to localStorage
  useEffect(() => {
    if (urlSlug) {
      localStorage.setItem("cliente_empresa_slug", urlSlug);
      setEmpresaSlug(urlSlug);
    }
  }, [urlSlug]);

  // Fetch empresa info by slug
  useEffect(() => {
    async function fetchEmpresa() {
      if (!empresaSlug) {
        setEmpresaLoading(false);
        setEmpresaError(true);
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

  useEffect(() => {
    if (!user || loading) return;
    navigate("/cliente");
  }, [user, loading, navigate]);

  if (loading || empresaLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No empresa slug or invalid slug — show error
  if (empresaError && !empresa) {
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
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>

            {form.errors.general && (
              <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {form.errors.general}
              </div>
            )}

            <TabsContent value="login">
              <LoginForm form={form} />
            </TabsContent>

            <TabsContent value="signup">
              <SignupForm form={form} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
