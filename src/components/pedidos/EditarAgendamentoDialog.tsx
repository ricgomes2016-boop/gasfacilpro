import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Minus, Calendar, Clock, XCircle, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PedidoFormatado } from "@/types/pedido";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  pedido: PedidoFormatado | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

export function EditarAgendamentoDialog({ pedido, open, onOpenChange, onSaved }: Props) {
  const { hasAnyRole } = useAuth();
  const podeEditarData = hasAnyRole(["admin", "gestor"]);

  const [data, setData] = useState("");
  const [hora, setHora] = useState("08:00");
  const [itens, setItens] = useState<Array<{ id: string; nome: string; quantidade: number; preco: number }>>([]);
  const [salvando, setSalvando] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);

  useEffect(() => {
    if (!pedido || !open) return;
    if (pedido.data_agendamento) {
      const dt = new Date(pedido.data_agendamento);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      setData(`${y}-${m}-${d}`);
      setHora(dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    } else if (pedido.data_entrega) {
      setData(pedido.data_entrega);
      setHora("08:00");
    } else {
      setData("");
      setHora("08:00");
    }
    setItens(
      (pedido.itens || []).map((it) => ({
        id: it.id,
        nome: it.produto?.nome || "Item",
        quantidade: Number(it.quantidade) || 1,
        preco: Number(it.preco_unitario) || 0,
      })),
    );
  }, [pedido, open]);

  const total = useMemo(() => itens.reduce((acc, it) => acc + it.quantidade * it.preco, 0), [itens]);

  const alterarQtd = (id: string, delta: number) =>
    setItens((prev) => prev.map((it) => (it.id === id ? { ...it, quantidade: Math.max(1, it.quantidade + delta) } : it)));

  const salvar = async () => {
    if (!pedido) return;
    if (!data) {
      toast.error("Informe a data do agendamento");
      return;
    }
    setSalvando(true);
    try {
      const iso = new Date(`${data}T${(hora || "08:00").padStart(5, "0")}:00-03:00`).toISOString();
      const updates: any = {
        agendado: true,
        valor_total: total,
      };
      if (podeEditarData) {
        updates.data_entrega = data;
        updates.data_agendamento = iso;
        updates.lembrete_enviado_em = null; // reativar lembrete
      }
      const { error } = await supabase.from("pedidos").update(updates).eq("id", pedido.id);
      if (error) throw error;

      // Atualiza quantidades item a item
      for (const it of itens) {
        const original = pedido.itens.find((o) => o.id === it.id);
        if (!original || original.quantidade === it.quantidade) continue;
        const { error: itemErr } = await supabase
          .from("pedido_itens")
          .update({ quantidade: it.quantidade })
          .eq("id", it.id);
        if (itemErr) throw itemErr;
      }

      toast.success("Agendamento atualizado");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const cancelarAgendamento = async () => {
    if (!pedido) return;
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ status: "cancelado" })
        .eq("id", pedido.id);
      if (error) throw error;
      toast.success("Agendamento cancelado");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cancelar");
    } finally {
      setSalvando(false);
      setConfirmCancelar(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Editar Agendamento
              {pedido?.numero_sequencial != null && (
                <span className="text-sm text-muted-foreground font-normal">#{pedido.numero_sequencial}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{pedido?.cliente}</div>
              <div className="text-xs text-muted-foreground truncate">{pedido?.endereco}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" />Data</Label>
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  disabled={!podeEditarData}
                  className="text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" />Hora</Label>
                <Input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  disabled={!podeEditarData}
                  className="text-base"
                />
              </div>
            </div>
            {!podeEditarData && (
              <p className="text-[11px] text-muted-foreground">
                Apenas Admin ou Gestor pode alterar data/hora. Você pode ajustar as quantidades.
              </p>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Itens</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {itens.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 rounded-lg border bg-background p-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{it.nome}</div>
                      <div className="text-[11px] text-muted-foreground">R$ {it.preco.toFixed(2)} un.</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => alterarQtd(it.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold">{it.quantidade}</span>
                      <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => alterarQtd(it.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm pt-1 border-t">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">R$ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmCancelar(true)}
              disabled={salvando}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar agendamento
            </Button>
            <Button type="button" onClick={salvar} disabled={salvando}>
              <Save className="h-4 w-4 mr-2" />
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancelar} onOpenChange={setConfirmCancelar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido será marcado como cancelado e o lembrete não será enviado. Esta ação pode ser desfeita alterando o status do pedido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={cancelarAgendamento} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
