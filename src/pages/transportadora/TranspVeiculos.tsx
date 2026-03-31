import { useState } from "react";
import { TransportadoraLayout } from "@/components/transportadora/TransportadoraLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { calcCapacidadeP13Equiv, formatNumber } from "@/lib/transp-utils";
import { toast } from "sonner";
import { Plus, CarFront, Pencil, Trash2 } from "lucide-react";

export default function TranspVeiculos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ placa: "", tipo: "caminhao", capacidade_p13: 0, capacidade_p20: 0, capacidade_p45: 0, consumo_km_litro: 5 });

  const { data: veiculos = [], isLoading } = useQuery({
    queryKey: ["transp-veiculos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("transp_veiculos").select("*").eq("ativo", true).order("placa");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-empresa", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("empresa_id").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, empresa_id: profile?.empresa_id };
      if (editId) {
        const { error } = await (supabase as any).from("transp_veiculos").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("transp_veiculos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-veiculos"] });
      toast.success(editId ? "Veículo atualizado" : "Veículo cadastrado");
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("transp_veiculos").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-veiculos"] });
      toast.success("Veículo removido");
    },
  });

  const resetForm = () => {
    setForm({ placa: "", tipo: "caminhao", capacidade_p13: 0, capacidade_p20: 0, capacidade_p45: 0, consumo_km_litro: 5 });
    setEditId(null);
  };

  const startEdit = (v: any) => {
    setForm({ placa: v.placa, tipo: v.tipo, capacidade_p13: v.capacidade_p13, capacidade_p20: v.capacidade_p20, capacidade_p45: v.capacidade_p45, consumo_km_litro: v.consumo_km_litro });
    setEditId(v.id);
    setOpen(true);
  };

  return (
    <TransportadoraLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Veículos</h1>
            <p className="text-muted-foreground text-sm">Cadastro e capacidade da frota</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Novo Veículo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Veículo</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Placa</Label><Input value={form.placa} onChange={(e) => setForm({...form, placa: e.target.value.toUpperCase()})} placeholder="ABC1D23" required /></div>
                  <div><Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({...form, tipo: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="caminhao">Caminhão</SelectItem>
                        <SelectItem value="utilitario">Utilitário</SelectItem>
                        <SelectItem value="moto">Moto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Cap. P13</Label><Input type="number" value={form.capacidade_p13} onChange={(e) => setForm({...form, capacidade_p13: +e.target.value})} /></div>
                  <div><Label>Cap. P20</Label><Input type="number" value={form.capacidade_p20} onChange={(e) => setForm({...form, capacidade_p20: +e.target.value})} /></div>
                  <div><Label>Cap. P45</Label><Input type="number" value={form.capacidade_p45} onChange={(e) => setForm({...form, capacidade_p45: +e.target.value})} /></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Capacidade total: <strong>{formatNumber(calcCapacidadeP13Equiv(form.capacidade_p13, form.capacidade_p20, form.capacidade_p45), 0)} P13 equiv.</strong>
                </p>
                <div><Label>Consumo (km/l)</Label><Input type="number" step="0.1" value={form.consumo_km_litro} onChange={(e) => setForm({...form, consumo_km_litro: +e.target.value})} /></div>
                <Button type="submit" className="w-full" disabled={save.isPending}>{editId ? "Salvar" : "Cadastrar"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {veiculos.map((v: any) => (
            <Card key={v.id} className="border-border/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <CarFront className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{v.placa}</p>
                    <p className="text-xs text-muted-foreground capitalize">{v.tipo} · {formatNumber(calcCapacidadeP13Equiv(v.capacidade_p13, v.capacidade_p20, v.capacidade_p45), 0)} P13 eq. · {v.consumo_km_litro} km/l</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(v)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && veiculos.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum veículo cadastrado</div>
          )}
        </div>
      </div>
    </TransportadoraLayout>
  );
}
