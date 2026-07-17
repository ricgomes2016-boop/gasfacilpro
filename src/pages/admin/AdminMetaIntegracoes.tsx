import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetaIntegrationsPanel } from "@/components/admin/MetaIntegrationsPanel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export default function AdminMetaIntegracoes() {
  const qc = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ["admin-meta-app-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "meta_app_review_status")
        .maybeSingle();
      const v = data?.valor;
      return typeof v === "string" ? v : (v as any)?.toString() ?? "dev";
    },
  });

  const toggle = useMutation({
    mutationFn: async (novo: "dev" | "approved") => {
      const { error } = await supabase
        .from("configuracoes_globais")
        .update({ valor: JSON.stringify(novo) as any })
        .eq("chave", "meta_app_review_status");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-meta-app-status"] });
      qc.invalidateQueries({ queryKey: ["meta-app-status"] });
      toast({ title: "Status do app Meta atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const isDev = status === "dev" || status === '"dev"';

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Integrações Meta</h1>
          <p className="text-sm text-muted-foreground">
            Conexões OAuth Meta (Facebook + Instagram) por empresa cliente.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Status do App Meta</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm">
              Estado atual:{" "}
              <span className={isDev ? "text-warning font-semibold" : "text-success font-semibold"}>
                {isDev ? "Modo Desenvolvimento (só testadores)" : "Aprovado (produção)"}
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => toggle.mutate(isDev ? "approved" : "dev")}
              disabled={toggle.isPending}
            >
              {isDev ? "Marcar como aprovado" : "Voltar para desenvolvimento"}
            </Button>
          </CardContent>
        </Card>

        <MetaIntegrationsPanel />
      </div>
    </AdminLayout>
  );
}
