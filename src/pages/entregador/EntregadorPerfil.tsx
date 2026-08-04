import { useEffect, useState, useRef } from "react";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  Mail,
  Calendar,
  Clock,
  TrendingUp,
  LogOut,
  Settings,
  ChevronRight,
  Camera,
  RefreshCw,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { resolveSignedUrl } from "@/components/ui/signed-image";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getBrasiliaDate } from "@/lib/utils";
import { forceAppUpdate } from "@/lib/force-app-update";
import { BuildVersionBadge } from "@/components/shared/BuildVersionBadge";

interface EntregadorData {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  status: string | null;
  created_at: string;
}

interface Stats {
  entregasTotais: number;
  entregasMes: number;
}

const menuItems = [
  { label: "Configurações", icon: Settings, path: "/entregador/configuracoes" },
  { label: "Histórico de Entregas", icon: Clock, path: "/entregador/entregas" },
  { label: "Meus Ganhos", icon: TrendingUp, path: "/entregador/ganhos" },
];

export default function EntregadorPerfil() {
  const { signOut, profile, user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entregador, setEntregador] = useState<EntregadorData | null>(null);
  const [stats, setStats] = useState<Stats>({ entregasTotais: 0, entregasMes: 0 });
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) { setLoading(false); return; }

        const { data: ent } = await supabase
          .from("entregadores")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (!ent) { setLoading(false); return; }
        setEntregador(ent);

        // Load avatar
        const { data: profileData } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("user_id", userId)
          .single();
        if (profileData?.avatar_url) setAvatarUrl(await resolveSignedUrl(profileData.avatar_url, "avatars"));

        const now = getBrasiliaDate();
        const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

        const [totalRes, mesRes] = await Promise.all([
          supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("entregador_id", ent.id).eq("status", "entregue"),
          supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("entregador_id", ent.id).eq("status", "entregue").gte("created_at", firstOfMonth),
        ]);

        setStats({
          entregasTotais: totalRes.count ?? 0,
          entregasMes: mesRes.count ?? 0,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      // Resize image client-side
      const resized = await resizeImage(file, 400);
      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, resized, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      // Bucket privado: guardamos o caminho e exibimos via URL assinada
      await supabase
        .from("profiles")
        .update({ avatar_url: filePath })
        .eq("user_id", user.id);

      const signed = await resolveSignedUrl(filePath, "avatars");
      setAvatarUrl(`${signed}${signed.includes("?") ? "&" : "?"}t=${Date.now()}`);
      toast.success("Foto atualizada!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar foto.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleUpdateApp = async () => {
    toast.info("Atualizando app para a versão mais recente...");
    try {
      await forceAppUpdate();
    } catch (e) {
      console.error(e);
      window.location.reload();
    }
  };

  const initials = (entregador?.nome || profile?.full_name || "")
    .split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const dataAdmissao = entregador?.created_at
    ? new Date(entregador.created_at).toLocaleDateString("pt-BR")
    : "—";

  if (loading) {
    return (
      <EntregadorLayout title="Perfil">
        <div className="p-4 space-y-4">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </EntregadorLayout>
    );
  }

  return (
    <EntregadorLayout title="Perfil">
      <div className="p-4 space-y-4">
        {/* Card do perfil */}
        <Card className="border-none shadow-md overflow-hidden">
          <div className="gradient-primary p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background text-foreground flex items-center justify-center shadow-md border-2 border-white hover:bg-muted transition-colors"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <div>
                <h2 className="text-xl font-bold">{entregador?.nome || profile?.full_name}</h2>
                <Badge className="mt-2 bg-primary-foreground/20 text-primary-foreground border-none">
                  {entregador?.status === "disponivel" ? "Disponível" : entregador?.status === "em_rota" ? "Em Rota" : entregador?.status || "—"}
                </Badge>
              </div>
            </div>
          </div>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{entregador?.email || profile?.email || "—"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{entregador?.telefone || profile?.phone || "—"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Desde {dataAdmissao}</span>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Estatísticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-primary">{stats.entregasTotais}</p>
                <p className="text-xs text-muted-foreground">Entregas Totais</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-primary">{stats.entregasMes}</p>
                <p className="text-xs text-muted-foreground">Este Mês</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Menu */}
        <Card className="border-none shadow-md">
          <CardContent className="p-0">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.path}>
                  <Link
                    to={item.path}
                    className="flex items-center justify-between p-4 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                  {index < menuItems.length - 1 && <Separator />}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-sm">
          <span className="text-sm text-muted-foreground">Versão instalada</span>
          <BuildVersionBadge prefix="Build" />
        </div>

        {/* Botão Atualizar */}
        <Button
          variant="outline"
          className="w-full h-12"
          onClick={handleUpdateApp}
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Atualizar App
        </Button>

        {/* Botão Sair */}
        <Button
          variant="outline"
          className="w-full h-12 text-destructive border-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Sair do App
        </Button>
      </div>
    </EntregadorLayout>
  );
}

function resizeImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; } }
      else { if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; } }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Blob error")), "image/jpeg", 0.8);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
