import { useEffect, useState } from "react";
import { VendedorLayout } from "@/components/vendedor/VendedorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Phone, MessageCircle } from "lucide-react";
import { useUnidade } from "@/contexts/UnidadeContext";
import { supabase } from "@/integrations/supabase/client";

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
}

export default function VendedorClientes() {
  const { unidadeAtual } = useUnidade();
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!unidadeAtual?.id) return;
    setLoading(true);
    const t = setTimeout(async () => {
      let query = supabase
        .from("clientes")
        .select("id, nome, telefone, endereco")
        .eq("unidade_id", unidadeAtual.id)
        .order("nome")
        .limit(50);
      if (busca.length >= 2) {
        query = query.or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%`);
      }
      const { data } = await query;
      setClientes((data as any) || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [busca, unidadeAtual?.id]);

  const whatsapp = (tel: string) => {
    const num = tel.replace(/\D/g, "");
    window.open(`https://wa.me/55${num}`, "_blank");
  };

  return (
    <VendedorLayout title="Meus Clientes">
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar cliente por nome ou telefone"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {loading && <p className="text-center text-muted-foreground">Carregando...</p>}
        {!loading && clientes.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum cliente encontrado</p>
        )}
        {clientes.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{c.nome}</p>
                  {c.telefone && <p className="text-xs text-muted-foreground">{c.telefone}</p>}
                  {c.endereco && (
                    <p className="text-xs text-muted-foreground truncate">{c.endereco}</p>
                  )}
                </div>
                {c.telefone && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9"
                      onClick={() => window.open(`tel:${c.telefone}`)}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 text-emerald-600"
                      onClick={() => whatsapp(c.telefone!)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </VendedorLayout>
  );
}
