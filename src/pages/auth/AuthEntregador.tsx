import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthForm } from "@/hooks/useAuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Loader2, Eye, EyeOff } from "lucide-react";

export default function AuthEntregador() {
  const navigate = useNavigate();
  const { user, roles, loading, signOut } = useAuth();
  const form = useAuthForm();
  const [roleError, setRoleError] = useState(false);

  useEffect(() => {
    document.title = "GásFácil Pro — Portal do Entregador";
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    if (roles.length === 0) return;

    if (!roles.includes("entregador")) {
      signOut();
      setRoleError(true);
      return;
    }
    navigate("/entregador");
  }, [user, loading, roles, navigate, signOut]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-background dark:via-background dark:to-muted/20 p-4">
      <Card className="w-full max-w-md border-emerald-200/50 dark:border-emerald-500/20">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Truck className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">GásFácil Pro — Entregador</CardTitle>
          <CardDescription>
            Acesse suas entregas, rotas e financeiro
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
              <Label htmlFor="entregador-email">Email</Label>
              <Input
                id="entregador-email"
                type="email"
                placeholder="entregador@distribuidora.com"
                value={form.loginEmail}
                onChange={(e) => form.setLoginEmail(e.target.value)}
                disabled={form.isLoading}
              />
              {form.errors.email && <p className="text-sm text-destructive">{form.errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="entregador-password">Senha</Label>
              <div className="relative">
                <Input
                  id="entregador-password"
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

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={form.isLoading}>
              {form.isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
              ) : (
                "Acessar Minhas Entregas"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Sua conta é criada pelo administrador da distribuidora
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
