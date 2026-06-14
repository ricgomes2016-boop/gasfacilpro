import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthForm } from "@/hooks/useAuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ShoppingBag } from "lucide-react";
import { CircleAuthLayout } from "@/components/auth/CircleAuthLayout";

export default function AuthVendedor() {
  const navigate = useNavigate();
  const { user, roles, loading, signOut } = useAuth();
  const form = useAuthForm();
  const [roleError, setRoleError] = useState(false);

  useEffect(() => {
    form.setLoginMethod("email");
  }, []);

  useEffect(() => {
    document.title = "GásFácil Pro — Portal do Vendedor";
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    if (roles.length === 0) return;
    const allowed = roles.includes("vendedor") || roles.includes("admin") || roles.includes("gestor");
    if (!allowed) {
      signOut();
      setRoleError(true);
      return;
    }
    navigate("/vendedor");
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
      portalKey="vendedor"
      title="GásFácil Pro — Vendedor"
      subtitle="Registre vendas, acompanhe metas e clientes"
      gradientFrom="160 75% 45%"
      gradientTo="200 70% 40%"
      logo={
        <div className="h-16 w-16 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg">
          <ShoppingBag className="h-8 w-8 text-white" />
        </div>
      }
    >
      {roleError && (
        <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          Esta conta não tem perfil de vendedor. Use o portal correto.
        </div>
      )}
      {form.errors.general && (
        <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {form.errors.general}
        </div>
      )}

      <form onSubmit={form.handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vendedor-email">Email</Label>
          <Input
            id="vendedor-email"
            type="email"
            placeholder="Digite seu email"
            value={form.loginEmail}
            onChange={(e) => form.setLoginEmail(e.target.value)}
            disabled={form.isLoading}
          />
          {form.errors.email && <p className="text-sm text-destructive">{form.errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="vendedor-password">Senha</Label>
          <div className="relative">
            <Input
              id="vendedor-password"
              type={form.showPassword ? "text" : "password"}
              placeholder="Digite sua senha"
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

        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={form.isLoading}>
          {form.isLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
          ) : (
            "Acessar Portal de Vendas"
          )}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Sua conta é criada pelo administrador da distribuidora
      </p>
    </CircleAuthLayout>
  );
}
