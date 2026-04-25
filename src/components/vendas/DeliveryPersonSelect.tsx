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
import { Truck, Sparkles, CheckCircle2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SugestaoEntregador } from "@/components/sugestao/SugestaoEntregador";
import { useUnidade } from "@/contexts/UnidadeContext";
import { cn } from "@/lib/utils";

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

  const getInitials = (nome: string) =>
    nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "E";

  return (
    <Card className="venda-card overflow-hidden">
      <CardHeader className="border-b bg-muted/30 p-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/12 text-primary">
            <Truck className="h-5 w-5" />
          </span>
          Entregador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <Select value={value || undefined} onValueChange={handleSelect} disabled={loading}>
          <SelectTrigger className="sr-only">
            <SelectValue placeholder={loading ? "Carregando..." : "Selecione o entregador"} />
          </SelectTrigger>
          <SelectContent>
            {entregadores.map((entregador) => (
              <SelectItem key={entregador.id} value={entregador.id}>{entregador.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {loading && (
            <div className="venda-modern-surface col-span-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Carregando entregadores...
            </div>
          )}
          {!loading && entregadores.length === 0 && (
            <div className="venda-modern-surface col-span-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum entregador disponível
            </div>
          )}
          {entregadores.map((entregador) => {
            const selected = value === entregador.id;
            return (
              <button
                key={entregador.id}
                type="button"
                onClick={() => handleSelect(entregador.id)}
                className={cn(
                   "venda-modern-surface group flex min-h-[104px] items-center gap-3 rounded-lg border p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md",
                  selected && "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20"
                )}
              >
                <div className={cn(
                   "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/20 transition-colors",
                   selected ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "group-hover:bg-primary/15 group-hover:text-primary"
                )}>
                  {getInitials(entregador.nome) || <UserRound className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{entregador.nome}</p>
                    {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                  </div>
                  <div className="mt-1">{getStatusBadge(entregador.status)}</div>
                </div>
              </button>
            );
          })}
        </div>

        {endereco && endereco.length > 10 && (
          <div className="venda-modern-surface rounded-lg border p-3">
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
