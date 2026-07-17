import { useEffect, useState } from "react";
import { VendedorLayout } from "@/components/vendedor/VendedorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Phone, MessageCircle, MapPin } from "lucide-react";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
}

export default function VendedorClientes() {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!unidadeAtual?.id || !empresa?.id) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        if (busca.trim().length >= 2) {
          const { data, error } = await supabase.rpc("autocomplete_clientes_v2" as any, {
            _empresa_id: empresa.id,
            _unidade_id: unidadeAtual.id,
            _termo: busca.trim(),
            _limite: 50,
          });
          if (error) throw error;
          setClientes((data as any) || []);
        } else {
          // listagem padrão via cliente_unidades
          const { data: cu, error: cuErr } = await supabase
            .from("cliente_unidades")
            .select("cliente_id")
            .eq("unidade_id", unidadeAtual.id)
            .limit(50);
          if (cuErr) throw cuErr;
          const ids = (cu || []).map((r: any) => r.cliente_id);
          if (ids.length === 0) {
            setClientes([]);
          } else {
            const { data, error } = await supabase
              .from("clientes")
              .select("id, nome, telefone, endereco, numero, bairro, cidade")
              .in("id", ids)
              .eq("ativo", true)
              .order("nome")
              .limit(50);
            if (error) throw error;
            setClientes((data as any) || []);
          }
        }
      } catch (e) {
        console.error("[VendedorClientes] busca falhou", e);
        setClientes([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [busca, unidadeAtual?.id, empresa?.id]);

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
            className="pl-8 text-base"
            placeholder="Buscar por nome, telefone, endereço ou bairro"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {loading && <p className="text-center text-muted-foreground">Carregando...</p>}
        {!loading && clientes.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum cliente encontrado</p>
        )}
        {clientes.map((c) => {
          const endereco = [
            c.endereco && c.numero ? `${c.endereco}, ${c.numero}` : c.endereco,
            c.bairro,
            c.cidade,
          ].filter(Boolean).join(" • ");
          return (
            <Card key={c.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{c.nome}</p>
                    {c.telefone && <p className="text-xs text-muted-foreground">{c.telefone}</p>}
                    {endereco && (
                      <p className="text-xs text-muted-foreground truncate">
                        <MapPin className="inline h-3 w-3 mr-1" />
                        {endereco}
                      </p>
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
                        className="h-9 w-9 text-success"
                        onClick={() => whatsapp(c.telefone!)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </VendedorLayout>
  );
}
