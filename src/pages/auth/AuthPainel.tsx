import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthForm } from "@/hooks/useAuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, Eye, EyeOff } from "lucide-react";
import { CircleAuthLayout } from "@/components/auth/CircleAuthLayout";

export default function AuthPainel() {
  const navigate = useNavigate();
  const { user, roles, loading, signOut } = useAuth();
  const form = useAuthForm();
  const [roleError, setRoleError] = useState(false);

  useEffect(() => {
    form.setLoginMethod("email");
  }, []);

  useEffect(() => {
    document.title = "GásFácil Pro — Painel Super Admin v2";
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    if (roles.length === 0) return;
    if (!roles.includes("super_admin")) {
      signOut();
      setRoleError(true);
      return;
    }
    if (window.location.pathname === "/auth") {
      navigate("/admin");
    }
  }, [user, loading, roles, navigate, signOut]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <CircleAuthLayout
      portalKey="painel"
      title="GásFácil Pro — Super Admin"
      subtitle="Painel administrativo SaaS — acesso restrito"
      gradientFrom="40 95% 55%"
      gradientTo="25 90% 45%"
      pageClassName="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      cardClassName="bg-slate-800/90 border-slate-700 text-white"
      logo={
        <div className="h-14 w-14 rounded-xl bg-warning/20 flex items-center justify-center">
          <Shield className="h-8 w-8 text-warning" />
        </div>
      }
    >
      {roleError && (
        <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          Esta conta não possui acesso ao painel Super Admin.
        </div>
      )}
      {form.errors.general && (
        <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {form.errors.general}
        </div>
      )}

      <form onSubmit={form.handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-email" className="text-slate-300">Email</Label>
          <Input
            id="admin-email"
            type="email"
            placeholder="Digite seu email"
            value={form.loginEmail}
            onChange={(e) => form.setLoginEmail(e.target.value)}
            disabled={form.isLoading}
            className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
          />
          {form.errors.email && <p className="text-sm text-destructive">{form.errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="admin-password" className="text-slate-300">Senha</Label>
          <div className="relative">
            <Input
              id="admin-password"
              type={form.showPassword ? "text" : "password"}
              placeholder="Digite sua senha"
              value={form.loginPassword}
              onChange={(e) => form.setLoginPassword(e.target.value)}
              disabled={form.isLoading}
              className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-white"
              onClick={() => form.setShowPassword(!form.showPassword)}
            >
              {form.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {form.errors.password && <p className="text-sm text-destructive">{form.errors.password}</p>}
        </div>

        <Button type="submit" className="w-full bg-warning hover:bg-warning text-white" disabled={form.isLoading}>
          {form.isLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</>
          ) : (
            "Acessar Painel Admin"
          )}
        </Button>
      </form>
    </CircleAuthLayout>
  );
}
