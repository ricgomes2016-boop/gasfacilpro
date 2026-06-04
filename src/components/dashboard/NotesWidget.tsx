import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  StickyNote,
  Plus,
  Trash2,
  Pin,
  PinOff,
  X,
  Bell,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const CORES = [
  { value: "yellow", label: "Amarelo", dot: "bg-warning", card: "border-l-warning" },
  { value: "blue", label: "Azul", dot: "bg-info", card: "border-l-info" },
  { value: "green", label: "Verde", dot: "bg-success", card: "border-l-success" },
  { value: "pink", label: "Rosa", dot: "bg-accent", card: "border-l-accent" },
  { value: "purple", label: "Roxo", dot: "bg-secondary", card: "border-l-secondary" },
];

function getCorConfig(cor: string) {
  return CORES.find((c) => c.value === cor) || CORES[0];
}

export function NotesWidget({ className }: { className?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [cor, setCor] = useState("yellow");
  const [lembreteData, setLembreteData] = useState("");

  const { data: anotacoes = [] } = useQuery({
    queryKey: ["anotacoes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anotacoes")
        .select("*")
        .order("fixado", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("anotacoes").insert({
        user_id: user!.id,
        titulo,
        conteudo: conteudo || null,
        cor,
        lembrete_data: lembreteData ? new Date(lembreteData).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anotacoes"] });
      setTitulo("");
      setConteudo("");
      setCor("yellow");
      setLembreteData("");
      setShowForm(false);
      toast.success("Anotação criada!");
    },
    onError: () => toast.error("Erro ao criar anotação"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase
        .from("anotacoes")
        .update({ [field]: value } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["anotacoes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("anotacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anotacoes"] });
      toast.success("Anotação removida");
    },
  });

  const lembretesPendentes = anotacoes.filter(
    (a: any) => a.lembrete_data && !a.concluido && (isPast(new Date(a.lembrete_data)) || isToday(new Date(a.lembrete_data)))
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-accent/10 shadow-md",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-2xl bg-accent shadow-sm shadow-accent/20">
            <StickyNote className="h-4 w-4 text-accent-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-none">
              Anotações & Lembretes
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {anotacoes.length} nota{anotacoes.length !== 1 ? "s" : ""}
              {lembretesPendentes.length > 0 && (
                <Badge variant="destructive" className="text-[10px] ml-1.5 px-1.5 py-0 h-4">
                  {lembretesPendentes.length} pendente{lembretesPendentes.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            variant={showForm ? "secondary" : "default"}
            size="sm"
            className="h-7 px-2.5 text-xs gap-1 rounded-lg"
            onClick={() => { setShowForm(!showForm); if (!expanded) setExpanded(true); }}
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? "Fechar" : "Nova"}
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && expanded && (
        <div className="mx-4 mb-3 p-3 rounded-xl border border-border/80 bg-background/80 backdrop-blur-sm space-y-2">
          <Input
            placeholder="Título da anotação..."
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="text-sm h-8 bg-background"
          />
          <Textarea
            placeholder="Conteúdo (opcional)..."
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            className="text-sm min-h-[50px] bg-background"
          />
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              type="datetime-local"
              value={lembreteData}
              onChange={(e) => setLembreteData(e.target.value)}
              className="text-sm flex-1 h-8 bg-background"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {CORES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCor(c.value)}
                  className={cn(
                    "h-5 w-5 rounded-full transition-all",
                    c.dot,
                    cor === c.value ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110" : "opacity-60 hover:opacity-100"
                  )}
                  title={c.label}
                />
              ))}
            </div>
            <Button
              size="sm"
              className="h-7 px-4 text-xs rounded-lg"
              disabled={!titulo.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {expanded && (
        <div className="px-4 pb-4">
          {anotacoes.length === 0 && !showForm ? (
            <div className="text-center py-6">
              <StickyNote className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma anotação ainda.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 text-xs"
                onClick={() => setShowForm(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Criar primeira nota
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-[280px] overflow-y-auto pr-1">
              {anotacoes.map((nota: any) => {
                const corConfig = getCorConfig(nota.cor);
                const isOverdue = nota.lembrete_data && !nota.concluido && isPast(new Date(nota.lembrete_data));

                return (
                  <div
                    key={nota.id}
                    className={cn(
                      "group relative p-3 rounded-xl border border-border/60 bg-background/70 backdrop-blur-sm transition-all hover:shadow-sm border-l-[3px]",
                      corConfig.card,
                      nota.concluido && "opacity-50"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={nota.concluido}
                        onCheckedChange={(v) =>
                          toggleMutation.mutate({ id: nota.id, field: "concluido", value: !!v })
                        }
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium leading-tight",
                            nota.concluido && "line-through text-muted-foreground"
                          )}
                        >
                          {nota.titulo}
                        </p>
                        {nota.conteudo && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap">
                            {nota.conteudo}
                          </p>
                        )}
                        {nota.lembrete_data && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Bell className="h-3 w-3 shrink-0" />
                            <span
                              className={cn(
                                "text-[11px]",
                                isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
                              )}
                            >
                              {format(new Date(nota.lembrete_data), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Hover actions */}
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {nota.fixado && (
                        <Pin className="h-3 w-3 text-primary mr-0.5" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() =>
                          toggleMutation.mutate({ id: nota.id, field: "fixado", value: !nota.fixado })
                        }
                      >
                        {nota.fixado ? (
                          <PinOff className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <Pin className="h-3 w-3 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:text-destructive"
                        onClick={() => deleteMutation.mutate(nota.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {/* Pin indicator (always visible) */}
                    {nota.fixado && (
                      <div className="absolute top-1.5 right-1.5 group-hover:hidden">
                        <Pin className="h-3 w-3 text-primary" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
