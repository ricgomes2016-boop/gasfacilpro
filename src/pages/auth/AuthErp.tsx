import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthForm } from "@/hooks/useAuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Loader2, Eye, EyeOff, BarChart3 } from "lucide-react";

export default function AuthErp() {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const form = useAuthForm();

  useEffect(() => {
    if (!user || loading) return;
    if (roles.length === 0) {
      const t = setTimeout(() => navigate("/dashboard"), 2000);
      return () => clearTimeout(t);
    }
    navigate("/dashboard");
  }, [user, roles, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/10 to-primary/5 p-4">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center gap-2">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Flame className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-2xl font-bold">Painel de Gestão</CardTitle>
          </div>
          <CardDescription>
            Acesse o sistema de gestão da sua distribuidora
          </CardDescription>
        </CardHeader>

        <CardContent>
          {form.errors.general && (
            <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {form.errors.general}
            </div>
          )}

          <form onSubmit={form.handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="seu@email.com"
                value={form.loginEmail}
                onChange={(e) => form.setLoginEmail(e.target.value)}
                disabled={form.isLoading}
              />
              {form.errors.email && <p className="text-sm text-destructive">{form.errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Senha</Label>
              <div className="relative">
                <Input
                  id="login-password"
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

            <Button type="submit" className="w-full" disabled={form.isLoading}>
              {form.isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
              ) : (
                "Entrar no Sistema"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Acesso restrito a administradores e operadores
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
