import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthForm } from "@/hooks/useAuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2, Eye, EyeOff } from "lucide-react";

export default function AuthPainel() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const form = useAuthForm();

  useEffect(() => {
    document.title = "GásFácil Pro — Painel Super Admin v2";
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    navigate("/admin");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/80 text-white">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Shield className="h-8 w-8 text-amber-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">GásFácil Pro — Super Admin</CardTitle>
          <CardDescription className="text-slate-400">
            Painel administrativo SaaS — acesso restrito
          </CardDescription>
        </CardHeader>

        <CardContent>
          {form.errors.general && (
            <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {form.errors.general}
            </div>
          )}

          <form onSubmit={form.handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-slate-300">Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@gasfacilpro.com.br"
                value={form.loginEmail}
                onChange={(e) => form.setLoginEmail(e.target.value)}
                disabled={form.isLoading}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
              />
              {form.errors.email && <p className="text-sm text-red-400">{form.errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-slate-300">Senha</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={form.showPassword ? "text" : "password"}
                  placeholder="••••••••"
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
              {form.errors.password && <p className="text-sm text-red-400">{form.errors.password}</p>}
            </div>

            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white" disabled={form.isLoading}>
              {form.isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</>
              ) : (
                "Acessar Painel Admin"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
