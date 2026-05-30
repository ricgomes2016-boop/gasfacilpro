import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import iconParceiro from "@/assets/icons/icon-parceiro.png";
import { CircleAuthLayout } from "@/components/auth/CircleAuthLayout";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

function goToParceiro() {
  if (typeof window !== "undefined" && window.location.pathname !== "/parceiro") {
    window.location.replace("/parceiro");
  }
}

export default function AuthParceiro() {
  const navigate = useNavigate();
  const { user, roles, loading, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [roleError, setRoleError] = useState(false);

  useEffect(() => {
    document.title = "GásFácil Pro — Portal do Parceiro";
  }, []);

  // Se já estiver logado como parceiro, redireciona
  useEffect(() => {
    if (!user || loading) return;
    if (roles.length === 0) return;
    if (!roles.includes("parceiro")) {
      signOut();
      setRoleError(true);
      return;
    }
    navigate("/parceiro", { replace: true });
    // fallback caso o roteador não troque por algum motivo
    setTimeout(goToParceiro, 50);
  }, [user, loading, roles, navigate, signOut]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setRoleError(false);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrors({ general: "Email ou senha incorretos" });
        } else if (error.message.includes("Email not confirmed")) {
          setErrors({ general: "Confirme seu cadastro antes de fazer login" });
        } else {
          setErrors({ general: error.message });
        }
        return;
      }

      const userId = signInData.user?.id;
      if (!userId) {
        setErrors({ general: "Não foi possível identificar o usuário." });
        return;
      }

      // Valida papel "parceiro" diretamente para não depender do contexto
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (rolesError) {
        setErrors({ general: "Erro ao validar permissões. Tente novamente." });
        return;
      }

      const userRoles = (rolesData ?? []).map((r) => r.role);
      if (!userRoles.includes("parceiro")) {
        await supabase.auth.signOut();
        setRoleError(true);
        return;
      }

      toast.success("Login realizado com sucesso!");
      // Redireciona imediatamente, sem esperar o contexto recarregar
      window.location.replace("/parceiro");
    } catch (err) {
      setErrors({ general: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading && !user) {
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
      {errors.general && (
        <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="parceiro-email">Email</Label>
          <Input
            id="parceiro-email"
            type="email"
            placeholder="Digite seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="parceiro-password">Senha</Label>
          <div className="relative">
            <Input
              id="parceiro-password"
              type={showPassword ? "text" : "password"}
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
        </div>

        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
          {isLoading ? (
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
