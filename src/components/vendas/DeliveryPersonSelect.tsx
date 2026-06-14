import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { VendaSectionHeader } from "./VendaSectionHeader";

interface Entregador {
  id: string;
  nome: string;
  status: string | null;
  foto_url?: string | null;
  funcionario_id?: string | null;
  is_vendedor?: boolean;
}

interface DeliveryPersonSelectProps {
  value: string | null;
  onChange: (id: string, nome: string) => void;
  endereco?: string;
  /** Called whenever an entregador is selected. Provides the funcionario_id when that entregador is also a vendedor, otherwise null. */
  onVendedorAuto?: (funcionarioId: string | null, nome: string | null) => void;
}

export function DeliveryPersonSelect({ value, onChange, endereco, onVendedorAuto }: DeliveryPersonSelectProps) {

  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const { unidadeAtual } = useUnidade();

  const quickActionColors = [
    { bg: "bg-info text-info-foreground shadow-info/25", ring: "ring-info/40" },
    { bg: "bg-success text-success-foreground shadow-success/25", ring: "ring-success/40" },
    { bg: "bg-warning text-warning-foreground shadow-warning/25", ring: "ring-warning/40" },
    { bg: "bg-primary text-primary-foreground shadow-primary/25", ring: "ring-primary/40" },
    { bg: "bg-secondary text-secondary-foreground shadow-secondary/25", ring: "ring-secondary/40" },
  ];

  useEffect(() => {
    const fetchEntregadores = async () => {
      try {
        let query = supabase
          .from("entregadores")
          .select("id, nome, status, foto_url, funcionario_id, funcionarios:funcionario_id(is_vendedor)")
          .eq("ativo", true)
          .order("nome");

        if (unidadeAtual?.id) {
          query = query.eq("unidade_id", unidadeAtual.id);
        }

        const { data, error } = await query;

        if (!error && data) {
          const nomesUnicos = new Set();
          const uniqueData = (data as any[]).filter((e) => {
            if (nomesUnicos.has(e.nome)) return false;
            nomesUnicos.add(e.nome);
            return true;
          }).map((e) => ({
            id: e.id,
            nome: e.nome,
            status: e.status,
            foto_url: e.foto_url,
            funcionario_id: e.funcionario_id,
            is_vendedor: !!e.funcionarios?.is_vendedor,
          }));
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
      if (onVendedorAuto) {
        if (entregador.is_vendedor && entregador.funcionario_id) {
          onVendedorAuto(entregador.funcionario_id, entregador.nome);
        } else {
          onVendedorAuto(null, null);
        }
      }
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
      <VendaSectionHeader title="Entregador" icon={<Truck className="h-5 w-5" />} tone="primary" />
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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
          {entregadores.map((entregador, index) => {
            const selected = value === entregador.id;
            const colors = quickActionColors[index % quickActionColors.length];
            return (
              <button
                key={entregador.id}
                type="button"
                onClick={() => handleSelect(entregador.id)}
                aria-pressed={selected}
                className={cn(
                  "group flex min-h-[132px] flex-col items-center justify-center gap-3 rounded-xl border border-primary-foreground/15 p-3 text-center shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2",
                  colors.bg,
                  colors.ring,
                  selected && "scale-[1.02] border-primary-foreground/40 shadow-xl ring-2 ring-offset-2 ring-offset-background"
                )}
              >
                <div className={cn(
                  "flex h-16 w-16 shrink-0 overflow-hidden rounded-full bg-primary-foreground/15 text-sm font-bold text-primary-foreground ring-1 ring-primary-foreground/25 transition-colors",
                  selected ? "bg-primary-foreground/25 shadow-md" : "group-hover:bg-primary-foreground/20"
                )}>
                  {entregador.foto_url ? (
                    <img src={entregador.foto_url} alt={entregador.nome} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      {getInitials(entregador.nome) || <UserRound className="h-5 w-5" />}
                    </span>
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <div className="flex items-start justify-center gap-2">
                    <p className="max-w-full whitespace-normal break-words text-center text-sm font-semibold leading-snug text-primary-foreground drop-shadow-sm">
                      {entregador.nome}
                    </p>
                    {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-foreground drop-shadow-sm" />}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                    {getStatusBadge(entregador.status)}
                    {entregador.is_vendedor && (
                      <Badge variant="outline" className="border-primary-foreground/40 bg-primary-foreground/15 text-[10px] text-primary-foreground">
                        Vendedor
                      </Badge>
                    )}
                  </div>
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
