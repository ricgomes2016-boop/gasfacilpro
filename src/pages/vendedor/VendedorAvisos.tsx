import { useEffect, useState } from "react";
import { VendedorLayout } from "@/components/vendedor/VendedorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUnidade } from "@/contexts/UnidadeContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Megaphone } from "lucide-react";

interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  prioridade: string | null;
  created_at: string;
}

export default function VendedorAvisos() {
  const { unidadeAtual } = useUnidade();
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  useEffect(() => {
    if (!unidadeAtual?.id) return;
    (async () => {
      const { data } = await supabase
        .from("rh_avisos_entregador")
        .select("id, titulo, mensagem, prioridade, created_at")
        .eq("unidade_id", unidadeAtual.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setAvisos((data as any) || []);
    })();
  }, [unidadeAtual?.id]);

  return (
    <VendedorLayout title="Avisos">
      <div className="p-4 space-y-3">
        {avisos.length === 0 && (
          <div className="text-center py-12">
            <Megaphone className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Nenhum aviso no momento</p>
          </div>
        )}
        {avisos.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{a.titulo}</p>
                {a.prioridade && (
                  <Badge
                    variant={a.prioridade === "alta" ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    {a.prioridade}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.mensagem}</p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </VendedorLayout>
  );
}
