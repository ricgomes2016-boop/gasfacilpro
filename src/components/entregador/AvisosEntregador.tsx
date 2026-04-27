import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getBrasiliaDateString } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface AvisoEntregador {
  id: string;
  titulo: string;
  mensagem: string;
  prioridade: "normal" | "importante" | "urgente";
  fixado: boolean;
  exibir_de: string;
  exibir_ate: string | null;
}

const prioridadeConfig = {
  normal: {
    icon: Bell,
    badge: "outline" as const,
    card: "border-primary/20 bg-card",
    iconWrap: "bg-primary/10 text-primary",
  },
  importante: {
    icon: Megaphone,
    badge: "warning" as const,
    card: "border-warning/30 bg-warning/10",
    iconWrap: "bg-warning/20 text-warning-foreground",
  },
  urgente: {
    icon: AlertTriangle,
    badge: "destructive" as const,
    card: "border-destructive/30 bg-destructive/10",
    iconWrap: "bg-destructive/15 text-destructive",
  },
};

export function AvisosEntregador() {
  const { user } = useAuth();
  const [avisos, setAvisos] = useState<AvisoEntregador[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      if (!user) return;
      setLoading(true);

      const { data: entregador } = await supabase
        .from("entregadores")
        .select("id, unidade_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!entregador) {
        setAvisos([]);
        setLoading(false);
        return;
      }

      const hoje = getBrasiliaDateString();
      let query = (supabase
        .from("rh_avisos_entregador" as any)
        .select("id, titulo, mensagem, prioridade, fixado, exibir_de, exibir_ate")
        .eq("ativo", true)
        .lte("exibir_de", hoje)
        .or(`exibir_ate.is.null,exibir_ate.gte.${hoje}`)
        .order("fixado", { ascending: false })
        .order("created_at", { ascending: false }) as any);

      if ((entregador as any).unidade_id) {
        query = query.or(`unidade_id.is.null,unidade_id.eq.${(entregador as any).unidade_id}`);
      } else {
        query = query.is("unidade_id", null);
      }

      const { data } = await query.limit(5);
      setAvisos((data || []) as AvisoEntregador[]);
      setLoading(false);
    };

    carregar();
  }, [user]);

  if (loading || avisos.length === 0) return null;

  return (
    <Card className="border-none shadow-md rounded-2xl overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-foreground/90">
          <Bell className="h-5 w-5 text-primary" />
          Avisos do RH
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2.5">
        {avisos.map((aviso) => {
          const config = prioridadeConfig[aviso.prioridade] || prioridadeConfig.normal;
          const Icon = config.icon;
          return (
            <article key={aviso.id} className={cn("rounded-2xl border p-3", config.card)}>
              <div className="flex gap-3">
                <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", config.iconWrap)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="font-bold text-sm text-foreground leading-snug">{aviso.titulo}</h3>
                    <Badge variant={config.badge}>{aviso.prioridade}</Badge>
                    {aviso.fixado && <Badge variant="default">fixado</Badge>}
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">{aviso.mensagem}</p>
                </div>
              </div>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}
