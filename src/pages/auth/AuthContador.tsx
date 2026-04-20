import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthForm } from "@/hooks/useAuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Loader2, Eye, EyeOff } from "lucide-react";

export default function AuthContador() {
  const navigate = useNavigate();
  const { user, roles, loading, signOut } = useAuth();
  const form = useAuthForm();
  const [roleError, setRoleError] = useState(false);

  useEffect(() => {
    form.setLoginMethod("email");
  }, []);

  useEffect(() => {
    document.title = "Portal Contábil — GásFácil Pro";
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    if (roles.length === 0) return;

    const allowed = roles.includes("contador") || roles.includes("admin") || roles.includes("super_admin");
    if (!allowed) {
      signOut();
      setRoleError(true);
      return;
    }
    if (window.location.pathname === "/auth") {
      navigate("/contador");
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(220,25%,8%)] via-[hsl(220,22%,12%)] to-[hsl(165,40%,10%)] p-4">
      <Card className="w-full max-w-md border-[hsl(220,15%,20%)] bg-[hsl(220,22%,11%)]/90 backdrop-blur text-[hsl(0,0%,93%)]">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-[hsl(165,60%,40%)]/15 flex items-center justify-center ring-1 ring-[hsl(165,60%,40%)]/30">
              <Calculator className="h-9 w-9 text-[hsl(165,60%,55%)]" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Portal Contábil</CardTitle>
            <CardDescription className="text-[hsl(220,10%,60%)] mt-2">
              Acesso restrito para escritórios contábeis
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {roleError && (
            <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              Esta conta não possui acesso ao Portal Contábil.
            </div>
          )}
          {form.errors.general && (
            <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {form.errors.general}
            </div>
          )}

          <form onSubmit={form.handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cont-email" className="text-[hsl(220,10%,75%)]">Email</Label>
              <Input
                id="cont-email"
                type="email"
                placeholder="contador@escritorio.com.br"
                value={form.loginEmail}
                onChange={(e) => form.setLoginEmail(e.target.value)}
                disabled={form.isLoading}
                className="bg-[hsl(220,18%,15%)] border-[hsl(220,15%,22%)] text-white placeholder:text-[hsl(220,10%,45%)]"
              />
              {form.errors.email && <p className="text-sm text-red-400">{form.errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cont-password" className="text-[hsl(220,10%,75%)]">Senha</Label>
              <div className="relative">
                <Input
                  id="cont-password"
                  type={form.showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.loginPassword}
                  onChange={(e) => form.setLoginPassword(e.target.value)}
                  disabled={form.isLoading}
                  className="bg-[hsl(220,18%,15%)] border-[hsl(220,15%,22%)] text-white placeholder:text-[hsl(220,10%,45%)]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 text-[hsl(220,10%,55%)] hover:text-white hover:bg-transparent"
                  onClick={() => form.setShowPassword(!form.showPassword)}
                >
                  {form.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {form.errors.password && <p className="text-sm text-red-400">{form.errors.password}</p>}
            </div>

            <Button
              type="submit"
              className="w-full bg-[hsl(165,60%,40%)] hover:bg-[hsl(165,60%,45%)] text-white font-medium"
              disabled={form.isLoading}
            >
              {form.isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</>
              ) : (
                "Acessar Portal Contábil"
              )}
            </Button>
          </form>

          <p className="text-xs text-center text-[hsl(220,10%,50%)] mt-6">
            Esqueceu a senha? Solicite ao administrador da empresa.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
