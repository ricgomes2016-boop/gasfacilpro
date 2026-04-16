import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, CheckCircle } from "lucide-react";
import { aplicarModoEntregador, vibrar } from "@/utils/mobileApp";

// MOCK inicial (pode ligar no Supabase depois)
const entregas = [
  { id: "1", cliente: "Maria", endereco: "Rua A, 123", status: "pendente" },
  { id: "2", cliente: "João", endereco: "Av B, 456", status: "pendente" },
];

export default function EntregadorApp() {
  useEffect(() => {
    aplicarModoEntregador();
  }, []);

  const abrirRota = (endereco: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
    window.open(url, "_system");
  };

  const finalizar = (id: string) => {
    vibrar(200);
    alert(`Entrega ${id} finalizada`);
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
    </div>
  );
}
