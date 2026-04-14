import { TransportadoraLayout } from "@/components/transportadora/TransportadoraLayout";
import { Route } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RotaAtacadoDinamica } from "@/components/operacional/RotaAtacadoDinamica";

export default function TranspRotaAtacado() {
  const { user } = useAuth();

  const { data: profileData } = useQuery({
    queryKey: ["profile-empresa", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("empresa_id").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const empresaId = profileData?.empresa_id;

  return (
    <TransportadoraLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Route className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Rota Atacado Dinâmica</h1>
        </div>

        {empresaId ? (
          <RotaAtacadoDinamica empresaId={empresaId} />
        ) : (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        )}
      </div>
    </TransportadoraLayout>
  );
}
