import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Mail, Phone, Building2, Shield, Lock, Save, Pencil, X, Eye, EyeOff, Sparkles, RefreshCw, LayoutGrid } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { z } from "zod";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(100),
  phone: z.string().max(20).optional(),
});

const passwordSchema = z.object({
  newPassword: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(72),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export default function MeuPerfil() {
  const { user, profile, roles } = useAuth();
  const { empresa } = useEmpresa();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Preferência: versão da tela Nova Venda
  const [novaVendaView, setNovaVendaView] = useState<"new" | "old">(() => {
    if (typeof window === "undefined") return "new";
    return (localStorage.getItem("nova-venda-view-mode") as "new" | "old") || "new";
  });
  const handleChangeNovaVendaView = (v: string) => {
    const mode = (v === "old" ? "old" : "new") as "new" | "old";
    setNovaVendaView(mode);
    try { localStorage.setItem("nova-venda-view-mode", mode); } catch {}
    toast.success(`Versão definida: ${mode === "new" ? "Nova" : "Antiga"}`);
  };

  const handleForceUpdate = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      toast.success("Atualizando o sistema...");
      setTimeout(() => window.location.reload(), 400);
    } catch {
      window.location.reload();
    }
  };


  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const initials = (profile?.full_name || "U")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSaveProfile = async () => {
    const result = profileSchema.safeParse({ full_name: fullName, phone });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() || null })
        .eq("user_id", user!.id);
      if (error) throw error;
      toast.success("Perfil atualizado!");
      setIsEditingProfile(false);
    } catch {
      toast.error("Erro ao salvar perfil");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordErrors({});
    const result = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        errs[e.path[0] as string] = e.message;
      });
      setPasswordErrors(errs);
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao alterar senha");
    } finally {
      setSavingPassword(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive" as const;
      case "gestor": return "default" as const;
      case "super_admin": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <MainLayout>
      <Header title="Meu Perfil" subtitle="Gerencie seus dados e senha" />
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        {/* Avatar + Info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Avatar className="h-20 w-20 text-2xl">
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left flex-1 space-y-1">
                <h2 className="text-xl font-bold">{profile?.full_name || "Usuário"}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="flex flex-wrap gap-1 justify-center sm:justify-start mt-2">
                  {roles.map((role) => (
                    <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
                {empresa && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 justify-center sm:justify-start">
                    <Building2 className="h-3.5 w-3.5" />
                    {empresa.nome}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dados Pessoais */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" /> Dados Pessoais
                </CardTitle>
                <CardDescription>Atualize seu nome e telefone</CardDescription>
              </div>
              {!isEditingProfile ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditingProfile(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => {
                  setIsEditingProfile(false);
                  setFullName(profile?.full_name || "");
                  setPhone(profile?.phone || "");
                }}>
                  <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Nome
                </Label>
                {isEditingProfile ? (
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
                ) : (
                  <p className="text-sm py-2 px-3 bg-muted/50 rounded-md">{profile?.full_name || "—"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> E-mail
                </Label>
                <p className="text-sm py-2 px-3 bg-muted/50 rounded-md text-muted-foreground">{user?.email}</p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Telefone
                </Label>
                {isEditingProfile ? (
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="(00) 00000-0000" />
                ) : (
                  <p className="text-sm py-2 px-3 bg-muted/50 rounded-md">{profile?.phone || "Não informado"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Função
                </Label>
                <p className="text-sm py-2 px-3 bg-muted/50 rounded-md text-muted-foreground">
                  {roles.join(", ") || "—"}
                </p>
              </div>
            </div>
            {isEditingProfile && (
              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm">
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {savingProfile ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preferências de interface */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" /> Preferências de Interface
            </CardTitle>
            <CardDescription>Escolha qual versão da tela de Nova Venda usar</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={novaVendaView} onValueChange={handleChangeNovaVendaView} className="grid gap-2 sm:grid-cols-2">
              <Label htmlFor="view-new" className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-border p-3 hover:bg-muted/40 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                <RadioGroupItem value="new" id="view-new" className="mt-0.5" />
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-primary" /> Nova</p>
                  <p className="text-xs text-muted-foreground">Fluxo por etapas (stepper) — recomendado</p>
                </div>
              </Label>
              <Label htmlFor="view-old" className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-border p-3 hover:bg-muted/40 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                <RadioGroupItem value="old" id="view-old" className="mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Antiga</p>
                  <p className="text-xs text-muted-foreground">Tudo em uma única página</p>
                </div>
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Atualização do Sistema */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Atualização do Sistema
            </CardTitle>
            <CardDescription>Force a busca pela versão mais recente do app</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={handleForceUpdate}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Buscar nova atualização
            </Button>
          </CardContent>
        </Card>

        {/* Alterar Senha */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" /> Alterar Senha
            </CardTitle>
            <CardDescription>Defina uma nova senha para sua conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nova Senha</Label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    maxLength={72}
                    placeholder="Mínimo 6 caracteres"
                    className={passwordErrors.newPassword ? "border-destructive" : ""}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNew(!showNew)}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="text-xs text-destructive">{passwordErrors.newPassword}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Confirmar Senha</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    maxLength={72}
                    placeholder="Repita a nova senha"
                    className={passwordErrors.confirmPassword ? "border-destructive" : ""}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="text-xs text-destructive">{passwordErrors.confirmPassword}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                size="sm"
              >
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                {savingPassword ? "Alterando..." : "Alterar Senha"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
