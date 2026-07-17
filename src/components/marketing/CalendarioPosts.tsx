import { useState, useMemo } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format,
  isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  agendamentos: any[];
  onSelectPost?: (ag: any) => void;
}

const plataformaEmoji: Record<string, string> = {
  instagram: "📸", facebook: "📘", tiktok: "🎵", youtube: "▶️", whatsapp: "💬",
};

const statusColor: Record<string, string> = {
  agendado: "bg-info/15 text-info dark:text-info border-info/30",
  publicado: "bg-success/15 text-success dark:text-success border-success/30",
  falhou: "bg-destructive/15 text-destructive dark:text-destructive border-destructive/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

export function CalendarioPosts({ agendamentos, onSelectPost }: Props) {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(new Date());
  const [dragId, setDragId] = useState<string | null>(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = useMemo(() => {
    const arr: Date[] = [];
    let d = calStart;
    while (d <= calEnd) { arr.push(d); d = addDays(d, 1); }
    return arr;
  }, [calStart, calEnd]);

  const postsPorDia = useMemo(() => {
    const m = new Map<string, any[]>();
    agendamentos.forEach((a) => {
      const dt = parseISO(a.data_agendamento);
      const key = format(dt, "yyyy-MM-dd");
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    });
    return m;
  }, [agendamentos]);

  const moveMut = useMutation({
    mutationFn: async ({ id, novaData }: { id: string; novaData: Date }) => {
      const original = agendamentos.find((a) => a.id === id);
      if (!original) return;
      const orig = parseISO(original.data_agendamento);
      const nova = new Date(novaData);
      nova.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
      const { error } = await supabase
        .from("marketing_agendamentos")
        .update({ data_agendamento: nova.toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-agendamentos"] });
      toast({ title: "Post reagendado!" });
    },
    onError: () => toast({ title: "Erro ao mover", variant: "destructive" }),
  });

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold capitalize">
          {format(cursor, "MMMM yyyy", { locale: ptBR })}
        </h3>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(subMonths(cursor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setCursor(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {weekDays.map((d) => (
          <div key={d} className="bg-muted/50 px-2 py-1.5 text-[10px] font-semibold text-center uppercase tracking-wide text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const posts = postsPorDia.get(key) || [];
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          return (
            <div
              key={key}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) { moveMut.mutate({ id: dragId, novaData: day }); setDragId(null); }
              }}
              className={cn(
                "bg-background min-h-[88px] p-1.5 text-xs flex flex-col gap-0.5 transition",
                !inMonth && "opacity-40",
                today && "bg-primary/5",
              )}
            >
              <div className={cn(
                "text-[11px] font-semibold",
                today && "text-primary",
              )}>
                {format(day, "d")}
              </div>
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {posts.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    draggable={p.status === "agendado"}
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => onSelectPost?.(p)}
                    className={cn(
                      "w-full text-left px-1 py-0.5 rounded border text-[10px] truncate flex items-center gap-1",
                      statusColor[p.status] || statusColor.agendado,
                      p.status === "agendado" && "cursor-grab active:cursor-grabbing",
                    )}
                    title={`${format(parseISO(p.data_agendamento), "HH:mm")} · ${p.texto || ""}`}
                  >
                    <span>{plataformaEmoji[p.plataforma] || "📝"}</span>
                    <span className="truncate">{format(parseISO(p.data_agendamento), "HH:mm")}</span>
                  </button>
                ))}
                {posts.length > 3 && (
                  <div className="text-[9px] text-muted-foreground px-1">+ {posts.length - 3} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        💡 Arraste posts agendados para outro dia para reagendar
      </p>
    </div>
  );
}
