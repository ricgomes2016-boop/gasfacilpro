import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAvisosEntregador } from "@/hooks/useAvisosEntregador";

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
  const { avisos, naoLidos, loading, marcarComoLidos } = useAvisosEntregador();

  useEffect(() => {
    if (!loading && avisos.length > 0) {
      const timer = window.setTimeout(() => marcarComoLidos(avisos.map((aviso) => aviso.id)), 1200);
      return () => window.clearTimeout(timer);
    }
  }, [avisos, loading, marcarComoLidos]);

  if (loading || avisos.length === 0) return null;

  return (
    <Card className="border-none shadow-md rounded-2xl overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-foreground/90">
          <Bell className="h-5 w-5 text-primary" />
          Avisos do RH
          {naoLidos > 0 && <Badge variant="destructive">{naoLidos} novo{naoLidos > 1 ? "s" : ""}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2.5">
        {avisos.slice(0, 5).map((aviso) => {
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
                    {!aviso.lido && <span className="h-2.5 w-2.5 rounded-full bg-destructive" aria-label="Aviso não lido" />}
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
