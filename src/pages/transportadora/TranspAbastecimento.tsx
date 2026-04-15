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
import { calcP13Equivalente, formatCurrency, formatNumber } from "@/lib/transp-utils";
import { toast } from "sonner";
import { Plus, ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";

export default function TranspAbastecimento() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ origem_unidade_id: "", destino_unidade_id: "", veiculo_id: "", data: format(new Date(), "yyyy-MM-dd"), qtd_p13: 0, qtd_p20: 0, qtd_p45: 0, custo_logistico: 0, observacoes: "" });

  const { data: unidades = [] } = useQuery({
    queryKey: ["unidades-transp"],
    queryFn: async () => {
      const { data } = await supabase.from("unidades").select("id, nome, tipo").eq("ativo", true).order("nome");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ["transp-veiculos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transp_veiculos").select("id, placa, tipo").eq("ativo", true);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: abastecimentos = [], isLoading } = useQuery({
    queryKey: ["transp-abastecimentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("transp_abastecimentos").select("*").order("data", { ascending: false }).limit(50);
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
      const p13eq = calcP13Equivalente(form.qtd_p13, form.qtd_p20, form.qtd_p45);
      const custoUnidade = p13eq > 0 ? form.custo_logistico / p13eq : 0;
      const { error } = await (supabase as any).from("transp_abastecimentos").insert({
        empresa_id: profile?.empresa_id,
        origem_unidade_id: form.origem_unidade_id,
        destino_unidade_id: form.destino_unidade_id,
        veiculo_id: form.veiculo_id || null,
        data: form.data,
        qtd_p13: form.qtd_p13, qtd_p20: form.qtd_p20, qtd_p45: form.qtd_p45,
        p13_equivalente: p13eq,
        custo_logistico: form.custo_logistico,
        custo_por_unidade: custoUnidade,
        observacoes: form.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-abastecimentos"] });
      toast.success("Transferência registrada!");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getUnidadeNome = (id: string) => unidades.find((u: any) => u.id === id)?.nome || "—";

  return (
    <TransportadoraLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transferência entre Filiais</h1>
            <p className="text-muted-foreground text-sm">Registro de transferências de carga entre unidades</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Nova Transferência</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Registrar Transferência</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Origem</Label>
                    <Select value={form.origem_unidade_id} onValueChange={(v) => setForm({...form, origem_unidade_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{unidades.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Destino</Label>
                    <Select value={form.destino_unidade_id} onValueChange={(v) => setForm({...form, destino_unidade_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{unidades.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Veículo</Label>
                    <Select value={form.veiculo_id} onValueChange={(v) => setForm({...form, veiculo_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{veiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({...form, data: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>P13</Label><Input type="number" value={form.qtd_p13} onChange={(e) => setForm({...form, qtd_p13: +e.target.value})} /></div>
                  <div><Label>P20</Label><Input type="number" value={form.qtd_p20} onChange={(e) => setForm({...form, qtd_p20: +e.target.value})} /></div>
                  <div><Label>P45</Label><Input type="number" value={form.qtd_p45} onChange={(e) => setForm({...form, qtd_p45: +e.target.value})} /></div>
                </div>
                <p className="text-xs text-muted-foreground">P13 equiv.: <strong>{formatNumber(calcP13Equivalente(form.qtd_p13, form.qtd_p20, form.qtd_p45), 0)}</strong></p>
                <div><Label>Custo Logístico Total (R$)</Label><Input type="number" step="0.01" value={form.custo_logistico} onChange={(e) => setForm({...form, custo_logistico: +e.target.value})} /></div>
                <div><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm({...form, observacoes: e.target.value})} /></div>
                <Button type="submit" className="w-full" disabled={save.isPending}>Registrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {abastecimentos.map((a: any) => (
            <Card key={a.id} className="border-border/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{getUnidadeNome(a.origem_unidade_id)} → {getUnidadeNome(a.destino_unidade_id)}</p>
                      <p className="text-xs text-muted-foreground">{a.data} · {formatNumber(Number(a.p13_equivalente), 0)} P13 eq.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">{formatCurrency(Number(a.custo_logistico))}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(Number(a.custo_por_unidade))}/un</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && abastecimentos.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma transferência registrada</div>
          )}
        </div>
      </div>
    </TransportadoraLayout>
  );
}
