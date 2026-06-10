import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, CheckCircle } from "lucide-react";
import { aplicarModoEntregador, vibrar } from "@/utils/mobileApp";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Pedido {
  id: string;
  cliente: string;
  endereco: string;
}

export default function EntregadorApp() {
  const [entregas, setEntregas] = useState<Pedido[]>([]);
  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    aplicarModoEntregador();
    carregarPedidos();

    const channel = supabase
      .channel(`pedidos-entregador-app-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos" },
        (payload) => {
          const novo: any = payload.new;

          const pertenceAoEntregador =
            novo.entregador_id === entregadorId ||
            (!novo.entregador_id && novo.unidade_id === unidadeId);

          if (novo.status === "pendente" && pertenceAoEntregador) {
            vibrar(300);

            setEntregas((prev) => [
              {
                id: novo.id,
                cliente: "Novo pedido",
                endereco: novo.endereco_entrega,
              },
              ...prev,
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, entregadorId, unidadeId]);

  const carregarPedidos = async () => {
    if (!user?.id) return;

    const { data: entregador } = await supabase
      .from("entregadores")
      .select("id, unidade_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!entregador) {
      setEntregas([]);
      return;
    }

    setEntregadorId(entregador.id);
    setUnidadeId(entregador.unidade_id);

    const { data, error } = await supabase
      .from("pedidos")
      .select("id, endereco_entrega, clientes(nome)")
      .eq("status", "pendente")
      .or(`entregador_id.eq.${entregador.id},and(entregador_id.is.null,unidade_id.eq.${entregador.unidade_id})`)
      .limit(20);

    if (error) return;

    const lista = (data || []).map((p: any) => ({
      id: p.id,
      cliente: p.clientes?.nome || "Cliente",
      endereco: p.endereco_entrega,
    }));

    setEntregas(lista);
  };

  const abrirRota = (endereco: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
    window.open(url, "_system");
  };

  const finalizar = async (id: string) => {
    vibrar(200);

    const { error } = await supabase
      .from("pedidos")
      .update({ status: "entregue" })
      .eq("id", id);

    if (!error) {
      setEntregas((prev) => prev.filter((e) => e.id !== id));
    }
  };

  return (
    <div className="p-3 space-y-4 w-full min-w-0">
      <h1 className="text-lg font-bold">Minhas Entregas</h1>

      {entregas.map((e) => (
        <Card key={e.id} className="w-full min-w-0">
          <CardContent className="p-3 space-y-2">
            <div className="min-w-0">
              <p className="font-semibold truncate">{e.cliente}</p>
              <p className="text-sm text-muted-foreground truncate">{e.endereco}</p>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 h-12"
                variant="secondary"
                onClick={() => abrirRota(e.endereco)}
              >
                <MapPin className="h-5 w-5 mr-1" />
                Rota
              </Button>

              <Button
                className="flex-1 h-12"
                onClick={() => finalizar(e.id)}
              >
                <CheckCircle className="h-5 w-5 mr-1" />
                Finalizar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {entregas.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Nenhuma entrega pendente
        </p>
      )}
    </div>
  );
}
