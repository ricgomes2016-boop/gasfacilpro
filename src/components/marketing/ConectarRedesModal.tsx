import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Instagram, Facebook, Youtube, Music2, Linkedin, Loader2, CheckCircle2, Clock, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

const META_CALLBACK_ORIGIN = new URL(import.meta.env.VITE_SUPABASE_URL).origin;

type Plataforma = {
  id: string;
  label: string;
  icon: any;
  color: string;
  bg: string;
  status: "oauth" | "em_breve";
  descricao: string;
};

const PLATAFORMAS: Plataforma[] = [
  {
    id: "instagram",
    label: "Instagram",
    icon: Instagram,
    color: "text-primary",
    bg: "bg-primary/10",
    status: "oauth",
    descricao: "Publica fotos, vídeos e stories automaticamente.",
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: Facebook,
    color: "text-info",
    bg: "bg-info/10",
    status: "oauth",
    descricao: "Publica em páginas do Facebook automaticamente.",
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: Music2,
    color: "text-foreground",
    bg: "bg-foreground/10",
    status: "em_breve",
    descricao: "Publicação automática de vídeos curtos.",
  },
  {
    id: "youtube",
    label: "YouTube",
    icon: Youtube,
    color: "text-destructive",
    bg: "bg-destructive/10",
    status: "em_breve",
    descricao: "Upload automático de vídeos e Shorts.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    color: "text-info",
    bg: "bg-info/10",
    status: "em_breve",
    descricao: "Publica em páginas de empresa.",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidadeId?: string | null;
  contasConectadas: Array<{ plataforma: string; conectado_via?: string | null }>;
  onConnected?: () => void;
}

export function ConectarRedesModal({ open, onOpenChange, unidadeId, contasConectadas, onConnected }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const isMobile = useIsMobile();


  const isConectada = (id: string) =>
    contasConectadas.some((c) => c.plataforma === id && c.conectado_via === "oauth");

  const handleConnect = async (p: Plataforma) => {
    if (p.status === "em_breve") {
      toast({
        title: `${p.label} em breve`,
        description: "A integração oficial está em desenvolvimento. Avisaremos assim que estiver disponível.",
      });
      return;
    }

    // OAuth Meta (Instagram + Facebook compartilham o mesmo fluxo)
    setLoadingId(p.id);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({ title: "Faça login para conectar", variant: "destructive" });
        return;
      }

      const usarRedirect = isMobile;

      const { data, error } = await supabase.functions.invoke("meta-oauth-start", {
        body: {
          unidade_id: unidadeId,
          return_url: window.location.origin + window.location.pathname,
          mode: usarRedirect ? "redirect" : "popup",
        },
      });

      if (error || !data?.url) throw new Error(error?.message || "Não foi possível iniciar OAuth");

      if (usarRedirect) {
        window.location.href = data.url;
        return;
      }

      const popup = window.open(data.url, "meta-oauth", "width=600,height=750");

      if (!popup) {
        // Pop-up bloqueado: navega na própria aba
        window.location.href = data.url;
        return;
      }

      const onMessage = (ev: MessageEvent) => {
        if (ev.origin === META_CALLBACK_ORIGIN && ev.data?.type === "meta-oauth") {
          window.removeEventListener("message", onMessage);
          if (ev.data.ok) {
            toast({ title: "Conta conectada com sucesso! 🎉" });
            onConnected?.();
            onOpenChange(false);
          } else {
            toast({ title: "Falha ao conectar", variant: "destructive" });
          }
          try { popup?.close(); } catch {}
        }
      };
      window.addEventListener("message", onMessage);

      const interval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(interval);
          window.removeEventListener("message", onMessage);
          onConnected?.();
        }
      }, 1000);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar rede social</DialogTitle>
          <DialogDescription>
            Escolha a rede. Você fará login direto na plataforma — não precisa criar conta aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-foreground">
          <strong>Conexão protegida por empresa:</strong> o login pessoal serve apenas para autorizar.
          O sistema aceitará somente a Página com o nome da empresa/unidade selecionada e o Instagram
          profissional ligado a ela. O perfil pessoal não será salvo.
        </div>

        <div className="space-y-2 py-2">
          {PLATAFORMAS.map((p) => {
            const Icon = p.icon;
            const conectada = isConectada(p.id);
            const loading = loadingId === p.id;
            const emBreve = p.status === "em_breve";

            return (
              <button
                key={p.id}
                onClick={() => handleConnect(p)}
                disabled={loading || conectada}
                className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-border"
              >
                <div className={`p-2.5 rounded-xl ${p.bg} ${p.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{p.label}</span>
                    {conectada && (
                      <Badge className="gap-1 bg-success/15 text-success dark:text-success border border-success/30 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" /> Conectada
                      </Badge>
                    )}
                    {emBreve && !conectada && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Clock className="h-3 w-3" /> Em breve
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.descricao}</p>
                </div>
                <div className="shrink-0">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : conectada ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-1">
          Não tem conta ainda? O próprio popup vai oferecer criar uma na plataforma.
        </p>
      </DialogContent>
    </Dialog>
  );
}
