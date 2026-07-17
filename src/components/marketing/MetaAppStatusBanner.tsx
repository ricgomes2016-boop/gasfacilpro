import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function MetaAppStatusBanner() {
  const { data: status } = useQuery({
    queryKey: ["meta-app-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "meta_app_review_status")
        .maybeSingle();
      // valor é jsonb: pode vir como string "dev" ou objeto
      const v = data?.valor;
      return typeof v === "string" ? v : (v as any)?.toString() ?? "dev";
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!status) return null;
  const isDev = status === "dev" || status === '"dev"';

  return (
    <Card className={isDev ? "border-warning/40 bg-warning/5" : "border-success/40 bg-success/5"}>
      <CardContent className="p-4 flex items-start gap-3">
        {isDev ? (
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
        )}
        <div className="flex-1 text-sm">
          {isDev ? (
            <>
              <p className="font-semibold text-warning dark:text-warning">
                Modo Desenvolvimento (Meta)
              </p>
              <p className="text-muted-foreground mt-0.5">
                O app Meta ainda está em revisão. Apenas Facebooks cadastrados como
                testadores conseguem conectar. Solicite ao suporte do GásFácilPro para
                adicionar seu Facebook ID como testador.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-success dark:text-success">
                App Meta aprovado
              </p>
              <p className="text-muted-foreground mt-0.5">
                Qualquer empresa pode conectar suas contas oficiais.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
