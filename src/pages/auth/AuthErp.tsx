import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { useAuthForm } from "@/hooks/useAuthForm";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Building2, Eye, EyeOff, Headphones, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import iconErp from "@/assets/icons/icon-erp.png";
import { CircleAuthLayout } from "@/components/auth/CircleAuthLayout";

const ERP_ROLES: AppRole[] = ["admin", "gestor", "financeiro", "operacional"];

export default function AuthErp() {
  const navigate = useNavigate();
  const { user, roles, loading, signOut } = useAuth();
  const form = useAuthForm();

  useEffect(() => {
    form.setLoginMethod("email");
  }, []);
  const [roleError, setRoleError] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    document.title = "GásFácil Pro - Sistema de Gestão";
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    if (roles.length === 0) return;

    if (roles.includes("super_admin")) {
      navigate("/admin");
      return;
    }

    const hasAccess = ERP_ROLES.some((r) => roles.includes(r));
    if (!hasAccess) {
      signOut();
      setRoleError(true);
      return;
    }
    navigate("/dashboard");
  }, [user, loading, roles, navigate, signOut]);

  const handlePasswordReset = async () => {
    form.setErrors({});

    if (!form.loginEmail.trim()) {
      form.setErrors({ email: "Informe seu email para recuperar a senha" });
      return;
    }

    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(form.loginEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);

    if (error) {
      form.setErrors({ general: "Não foi possível enviar o email de recuperação. Tente novamente." });
      return;
    }

    toast.success("Enviamos as instruções de recuperação para o email informado.");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <CircleAuthLayout
      portalKey="erp"
      title="GásFácil Pro - ERP"
      subtitle="Sistema de gestão da distribuidora"
      gradientFrom="220 78% 58%"
      gradientTo="265 70% 52%"
      showFooter={false}
      showMobileHero={false}
      sideContent={
        <div className="space-y-6 text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/85">
            <ShieldCheck className="h-3.5 w-3.5" />
            Portal operacional
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold leading-tight drop-shadow-sm">
              Acesso seguro para a rotina da distribuidora.
            </h2>
            <p className="text-sm leading-6 text-white/80">
              Entre com seu usuário autorizado para acompanhar vendas, financeiro, estoque e operação em um só lugar.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-white/85">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12">
                <Building2 className="h-4 w-4" />
              </span>
              Perfis de administrador, gestor, financeiro e operacional
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12">
                <Headphones className="h-4 w-4" />
              </span>
              Suporte disponível para problemas de acesso
            </div>
          </div>
        </div>
      }
      logo={
        <div className="h-14 w-14 rounded-xl overflow-hidden shadow-lg">
          <img src={iconErp} alt="ERP" className="h-14 w-14 object-cover" />
        </div>
      }
    >
      <p className="mb-5 text-center text-sm text-muted-foreground md:text-left">
        Acesso para administradores e operadores autorizados.
      </p>

      {roleError && (
        <div className="mb-4 flex gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Esta conta não possui acesso ao sistema de gestão. Use o portal correto para o seu perfil.</span>
        </div>
      )}
      {form.errors.general && (
        <div className="mb-4 flex gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{form.errors.general}</span>
        </div>
      )}

      <form onSubmit={form.handleLogin} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="erp-email">Email</Label>
          <Input
            id="erp-email"
            type="email"
            autoComplete="email"
            placeholder="Digite seu email"
            value={form.loginEmail}
            onChange={(e) => form.setLoginEmail(e.target.value)}
            disabled={form.isLoading || resetLoading}
            aria-invalid={Boolean(form.errors.email)}
            aria-describedby={form.errors.email ? "erp-email-error" : undefined}
          />
          {form.errors.email && (
            <p id="erp-email-error" className="text-sm text-destructive">
              {form.errors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="erp-password">Senha</Label>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={form.isLoading || resetLoading}
              className="text-xs font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              {resetLoading ? "Enviando..." : "Esqueci minha senha"}
            </button>
          </div>
          <div className="relative">
            <Input
              id="erp-password"
              type={form.showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Digite sua senha"
              value={form.loginPassword}
              onChange={(e) => form.setLoginPassword(e.target.value)}
              disabled={form.isLoading || resetLoading}
              aria-invalid={Boolean(form.errors.password)}
              aria-describedby={form.errors.password ? "erp-password-error" : undefined}
              className="pr-12"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={form.showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => form.setShowPassword(!form.showPassword)}
              disabled={form.isLoading || resetLoading}
            >
              {form.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {form.errors.password && (
            <p id="erp-password-error" className="text-sm text-destructive">
              {form.errors.password}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full bg-teal-500 text-slate-950 hover:bg-teal-400" disabled={form.isLoading || resetLoading}>
          {form.isLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
          ) : (
            "Entrar no Sistema"
          )}
        </Button>
      </form>

      <div className="mt-5 flex flex-col gap-2 text-center text-xs text-muted-foreground md:text-left">
        <p>Problemas para acessar? Confirme seu email corporativo ou solicite apoio ao administrador.</p>
        <a href="mailto:suporte@gasfacilpro.com.br" className="font-medium text-primary underline-offset-4 hover:underline">
          Falar com suporte
        </a>
      </div>
    </CircleAuthLayout>
  );
}
