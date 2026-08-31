import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Facebook, Instagram } from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const META_CALLBACK_ORIGIN = new URL(import.meta.env.VITE_SUPABASE_URL).origin;

interface Props {
  unidadeId?: string | null;
  onConnected?: () => void;
}

export function ConectarRedeSocialButton({ unidadeId, onConnected }: Props) {
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  const handleConnect = async (provider: "instagram" | "facebook") => {
    if (!unidadeId) {
      toast({ title: "Selecione a unidade", description: "Escolha a unidade da empresa antes de conectar a Meta.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({ title: "Faça login para conectar", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("meta-oauth-start", {
        body: {
          unidade_id: unidadeId,
          provider,
          return_url: window.location.origin + window.location.pathname,
          mode: isMobile ? "redirect" : "popup",
        },
      });

      if (error || !data?.url) {
        throw new Error(error?.message || "Não foi possível iniciar OAuth");
      }

      if (isMobile) {
        window.location.href = data.url;
        return;
      }

      const popup = window.open(data.url, "meta-oauth", "width=600,height=750");

      if (!popup) {
        window.location.href = data.url;
        return;
      }


      const onMessage = (ev: MessageEvent) => {
        if (ev.origin === META_CALLBACK_ORIGIN && ev.data?.type === "meta-oauth") {
          window.removeEventListener("message", onMessage);
          if (ev.data.ok) {
            toast({ title: "Conta conectada com sucesso! 🎉" });
            onConnected?.();
          } else {
            toast({ title: "Falha ao conectar", variant: "destructive" });
          }
          try { popup?.close(); } catch {}
        }
      };
      window.addEventListener("message", onMessage);

      // Fallback: detecta fechamento manual
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
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => handleConnect("instagram")} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
        Entrar com Instagram
      </Button>
      <Button onClick={() => handleConnect("facebook")} disabled={loading} variant="outline" className="gap-2">
        <Facebook className="h-4 w-4" />
        Entrar com Facebook
      </Button>
    </div>
  );
}
