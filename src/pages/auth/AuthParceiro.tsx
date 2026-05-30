import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthForm } from "@/hooks/useAuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import iconParceiro from "@/assets/icons/icon-parceiro.png";
import { CircleAuthLayout } from "@/components/auth/CircleAuthLayout";

export default function AuthParceiro() {
  const navigate = useNavigate();
  const { user, roles, loading, signOut } = useAuth();
  const form = useAuthForm();
  const [roleError, setRoleError] = useState(false);

  useEffect(() => {
    document.title = "GásFácil Pro — Portal do Parceiro";
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    if (roles.length === 0) return;
    if (!roles.includes("parceiro")) {
      signOut();
      setRoleError(true);
      return;
    }
    navigate("/parceiro");
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
      portalKey="parceiro"
      title="GásFácil Pro — Parceiro"
      subtitle="Gerencie seus vales gás e acompanhe vendas"
      gradientFrom="220 85% 60%"
      gradientTo="240 75% 50%"
      logo={
        <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-lg">
          <img src={iconParceiro} alt="Parceiro" className="h-16 w-16 object-cover" />
        </div>
      }
    >
      {roleError && (
        <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          Esta conta não é de parceiro. Use o portal correto para o seu perfil.
        </div>
      )}
      {form.errors.general && (
        <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {form.errors.general}
        </div>
      )}

      <form onSubmit={form.handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="parceiro-email">Email</Label>
          <Input
            id="parceiro-email"
            type="email"
            placeholder="Digite seu email"
            value={form.loginEmail}
            onChange={(e) => form.setLoginEmail(e.target.value)}
            disabled={form.isLoading}
          />
          {form.errors.email && <p className="text-sm text-destructive">{form.errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="parceiro-password">Senha</Label>
          <div className="relative">
            <Input
              id="parceiro-password"
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

        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={form.isLoading}>
          {form.isLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
          ) : (
            "Acessar Portal do Parceiro"
          )}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Sua conta é criada pelo administrador da distribuidora
      </p>
    </CircleAuthLayout>
  );
}
