import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthForm } from "@/hooks/useAuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import iconTransportadora from "@/assets/icons/icon-transportadora.png";
import { CircleAuthLayout } from "@/components/auth/CircleAuthLayout";

export default function AuthTransportadora() {
  const navigate = useNavigate();
  const { user, roles, loading, signOut } = useAuth();
  const form = useAuthForm(undefined, "email");
  const [roleError, setRoleError] = useState(false);

  useEffect(() => {
    document.title = "GásFácil Pro — Transportadora";
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    if (roles.length === 0) return;
    if (!roles.includes("transportadora") && !roles.includes("admin") && !roles.includes("gestor")) {
      signOut();
      setRoleError(true);
      return;
    }
    navigate("/transportadora");
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
      portalKey="transportadora"
      title="GásFácil Pro — Transportadora"
      subtitle="Gerencie custos logísticos e abastecimento entre filiais"
      gradientFrom="175 70% 40%"
      gradientTo="195 75% 35%"
      logo={
        <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-lg">
          <img src={iconTransportadora} alt="Transportadora" className="h-16 w-16 object-cover" />
        </div>
      }
    >
      {roleError && (
        <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          Esta conta não tem acesso ao módulo Transportadora.
        </div>
      )}
      {form.errors.general && (
        <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {form.errors.general}
        </div>
      )}

      <form onSubmit={form.handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="transp-email">Email</Label>
          <Input
            id="transp-email"
            type="email"
            placeholder="Digite seu email"
            value={form.loginEmail}
            onChange={(e) => form.setLoginEmail(e.target.value)}
            disabled={form.isLoading}
          />
          {form.errors.email && <p className="text-sm text-destructive">{form.errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="transp-password">Senha</Label>
          <div className="relative">
            <Input
              id="transp-password"
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

        <Button type="submit" className="w-full bg-success hover:bg-success" disabled={form.isLoading}>
          {form.isLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
          ) : (
            "Acessar Portal Transportadora"
          )}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Sua conta é criada pelo administrador da distribuidora
      </p>
    </CircleAuthLayout>
  );
}
