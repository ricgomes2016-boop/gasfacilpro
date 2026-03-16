import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Truck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SugestaoEntregador } from "@/components/sugestao/SugestaoEntregador";
import { useUnidade } from "@/contexts/UnidadeContext";

interface Entregador {
  id: string;
  nome: string;
  status: string | null;
}

interface DeliveryPersonSelectProps {
  value: string | null;
  onChange: (id: string, nome: string) => void;
  endereco?: string;
}

export function DeliveryPersonSelect({ value, onChange, endereco }: DeliveryPersonSelectProps) {
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const { unidadeAtual } = useUnidade();

  useEffect(() => {
    const fetchEntregadores = async () => {
      try {
        let query = supabase
          .from("entregadores")
          .select("id, nome, status")
          .eq("ativo", true)
          .order("nome");

        if (unidadeAtual?.id) {
          query = query.eq("unidade_id", unidadeAtual.id);
        }

        const { data, error } = await query;

        if (!error && data) {
          // Remover duplicados por nome para evitar confusão visual se houver registros redundantes
          const nomesUnicos = new Set();
          const uniqueData = data.filter(e => {
            if (nomesUnicos.has(e.nome)) {
              console.warn(`Entregador duplicado detectado: ${e.nome} (ID: ${e.id})`);
              return false;
            }
            nomesUnicos.add(e.nome);
            return true;
          });
          setEntregadores(uniqueData);
        }
      } catch (error) {
        console.error("Erro ao buscar entregadores:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntregadores();
  }, [unidadeAtual?.id]);

  const handleSelect = (id: string) => {
    const entregador = entregadores.find((e) => e.id === id);
    if (entregador) {
      onChange(id, entregador.nome);
    }
  };

  const handleSugestao = (id: number, nome: string) => {
    const entregador = entregadores.find((e) => e.nome === nome) || entregadores[0];
    if (entregador) {
      onChange(entregador.id, entregador.nome);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "disponivel":
        return <Badge variant="default" className="text-[10px]">Disponível</Badge>;
      case "em_rota":
        return <Badge variant="secondary" className="text-[10px]">Em Rota</Badge>;
      case "indisponivel":
        return <Badge variant="destructive" className="text-[10px]">Indisponível</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-5 w-5" />
          Entregador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={value || undefined} onValueChange={handleSelect} disabled={loading}>
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Carregando..." : "Selecione o entregador"} />
          </SelectTrigger>
          <SelectContent>
            {entregadores.map((entregador) => (
              <SelectItem key={entregador.id} value={entregador.id}>
                <div className="flex items-center gap-2">
                  <span>{entregador.nome}</span>
                  {getStatusBadge(entregador.status)}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {endereco && endereco.length > 10 && (
          <div className="pt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <Sparkles className="h-3 w-3" />
              Sugestão automática
            </div>
            <SugestaoEntregador
              endereco={endereco}
              onSelecionar={handleSugestao}
              compact
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
