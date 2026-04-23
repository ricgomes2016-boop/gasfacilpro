import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Coffee, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getBrasiliaDate } from "@/lib/utils";
import { addDays, format, startOfWeek, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DIAS_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface Escala {
  id: string;
  data: string;
  turno_inicio: string | null;
  turno_fim: string | null;
  almoco_inicio: string | null;
  almoco_fim: string | null;
}

function fmtHora(h: string | null): string {
  if (!h) return "";
  // "HH:MM:SS" -> "HH:MM"
  return h.slice(0, 5);
}

export function MeuHorarioSemana() {
  const { user } = useAuth();
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(true);

  const hoje = getBrasiliaDate();
  const inicioSemana = startOfWeek(hoje, { weekStartsOn: 1 });
  const fimSemana = addDays(inicioSemana, 6);
  const dowHoje = (hoje.getDay() + 6) % 7;

  useEffect(() => {
    const carregar = async () => {
      if (!user) return;
      setLoading(true);
      const { data: ent } = await supabase
        .from("entregadores")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!ent) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("escalas_entregador")
        .select("id, data, turno_inicio, turno_fim, almoco_inicio, almoco_fim")
        .eq("entregador_id", ent.id)
        .gte("data", format(inicioSemana, "yyyy-MM-dd"))
        .lte("data", format(fimSemana, "yyyy-MM-dd"))
        .order("data", { ascending: true });
      setEscalas((data || []) as Escala[]);
      setLoading(false);
    };
    carregar();
  }, [user]);

  // Mapa por dia da semana (0=seg .. 6=dom)
  const porDia: Record<number, Escala | null> = {};
  for (let d = 0; d < 7; d++) porDia[d] = null;
  for (const e of escalas) {
    const dow = (parseISO(e.data).getDay() + 6) % 7;
    porDia[dow] = e;
  }

  return (
    <Card className="border-none shadow-md rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-foreground/90">
          <CalendarDays className="h-5 w-5 text-primary" />
          Meu Horário da Semana
          <span className="ml-auto text-[11px] font-normal text-muted-foreground">
            {format(inicioSemana, "dd/MM")} – {format(fimSemana, "dd/MM")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-4">Carregando...</div>
        ) : escalas.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            Nenhuma escala cadastrada para esta semana.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {Array.from({ length: 7 }, (_, d) => d).map((d) => {
              const esc = porDia[d];
              const dataDia = addDays(inicioSemana, d);
              const isHoje = d === dowHoje;
              const temAlmoco = esc?.almoco_inicio && esc?.almoco_fim;
              return (
                <li
                  key={d}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 border transition-colors",
                    isHoje
                      ? "bg-primary/10 border-primary/40"
                      : "bg-muted/30 border-transparent"
                  )}
                >
                  <div className="w-12 shrink-0 text-center">
                    <div
                      className={cn(
                        "text-xs font-bold uppercase",
                        isHoje ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {DIAS_LABEL[d]}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {format(dataDia, "dd/MM")}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    {esc && esc.turno_inicio && esc.turno_fim ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="font-mono text-[11px] gap-1 px-2 py-0.5"
                        >
                          <Clock className="h-3 w-3" />
                          {fmtHora(esc.turno_inicio)} – {fmtHora(esc.turno_fim)}
                        </Badge>
                        {temAlmoco && (
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px] gap-1 px-2 py-0.5 border-warning/40 text-warning"
                          >
                            <Coffee className="h-3 w-3" />
                            {fmtHora(esc.almoco_inicio)}–{fmtHora(esc.almoco_fim)}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Folga</span>
                    )}
                  </div>
                  {isHoje && (
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wide shrink-0">
                      Hoje
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
