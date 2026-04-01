import { useState } from "react";
import { TransportadoraLayout } from "@/components/transportadora/TransportadoraLayout";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Package, Route } from "lucide-react";
import { RouteMapDialog } from "@/components/transportadora/RouteMapDialog";
import { format } from "date-fns";

export default function TranspEntregas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tipo: "transporte", veiculo_id: "", motorista_id: "", destino_unidade_id: "",
    data: format(new Date(), "yyyy-MM-dd"),
    qtd_p13: 0, qtd_p20: 0, qtd_p45: 0, km: 0,
    custo_total: 0, valor_venda: 0, observacoes: "",
  });

  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ["transp-entregas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("transp_entregas").select("*").order("data", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: veiculos = [] } = useQuery({ queryKey: ["transp-veiculos"], queryFn: async () => { const { data } = await (supabase as any).from("transp_veiculos").select("id, placa").eq("ativo", true); return data || []; }, enabled: !!user });
  const { data: funcionarios = [] } = useQuery({ queryKey: ["transp-funcionarios"], queryFn: async () => { const { data } = await (supabase as any).from("transp_funcionarios").select("id, nome, cargo").eq("ativo", true); return data || []; }, enabled: !!user });
  const { data: unidades = [] } = useQuery({ queryKey: ["unidades-transp"], queryFn: async () => { const { data } = await supabase.from("unidades").select("id, nome").eq("ativo", true); return data || []; }, enabled: !!user });
  const { data: profile } = useQuery({ queryKey: ["profile-empresa", user?.id], queryFn: async () => { const { data } = await supabase.from("profiles").select("empresa_id").eq("user_id", user!.id).single(); return data; }, enabled: !!user });

  const save = useMutation({
    mutationFn: async () => {
      const p13eq = calcP13Equivalente(form.qtd_p13, form.qtd_p20, form.qtd_p45);
      const margem = form.valor_venda - form.custo_total;
      const { error } = await (supabase as any).from("transp_entregas").insert({
        empresa_id: profile?.empresa_id,
        tipo: form.tipo, veiculo_id: form.veiculo_id || null, motorista_id: form.motorista_id || null,
        destino_unidade_id: form.destino_unidade_id || null,
        data: form.data, qtd_p13: form.qtd_p13, qtd_p20: form.qtd_p20, qtd_p45: form.qtd_p45,
        p13_equivalente: p13eq, km: form.km,
        custo_total: form.custo_total, valor_venda: form.valor_venda, margem,
        observacoes: form.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transp-entregas"] }); toast.success("Entrega registrada!"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <TransportadoraLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Entregas & Vendas</h1>
            <p className="text-muted-foreground text-sm">Controle de transporte e vendas diretas</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Nova Entrega</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Registrar Entrega/Venda</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({...form, tipo: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transporte">Transporte</SelectItem>
                        <SelectItem value="venda">Venda Direta</SelectItem>
                        <SelectItem value="filial">Transporte Filial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({...form, data: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Veículo</Label>
                    <Select value={form.veiculo_id} onValueChange={(v) => setForm({...form, veiculo_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{veiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Motorista</Label>
                    <Select value={form.motorista_id} onValueChange={(v) => setForm({...form, motorista_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{funcionarios.filter((f: any) => f.cargo === "motorista").map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {form.tipo === "filial" && (
                  <div><Label>Destino (Filial)</Label>
                    <Select value={form.destino_unidade_id} onValueChange={(v) => setForm({...form, destino_unidade_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{unidades.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-3">
                  <div><Label>P13</Label><Input type="number" value={form.qtd_p13} onChange={(e) => setForm({...form, qtd_p13: +e.target.value})} /></div>
                  <div><Label>P20</Label><Input type="number" value={form.qtd_p20} onChange={(e) => setForm({...form, qtd_p20: +e.target.value})} /></div>
                  <div><Label>P45</Label><Input type="number" value={form.qtd_p45} onChange={(e) => setForm({...form, qtd_p45: +e.target.value})} /></div>
                  <div><Label>KM</Label><Input type="number" value={form.km} onChange={(e) => setForm({...form, km: +e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Custo Total</Label><Input type="number" step="0.01" value={form.custo_total} onChange={(e) => setForm({...form, custo_total: +e.target.value})} /></div>
                  <div><Label>Valor Venda</Label><Input type="number" step="0.01" value={form.valor_venda} onChange={(e) => setForm({...form, valor_venda: +e.target.value})} /></div>
                </div>
                <div><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => setForm({...form, observacoes: e.target.value})} /></div>
                <Button type="submit" className="w-full" disabled={save.isPending}>Registrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {entregas.map((e: any) => (
            <Card key={e.id} className="border-border/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground capitalize">{e.tipo === "filial" ? "Transporte Filial" : e.tipo}</p>
                    <p className="text-xs text-muted-foreground">{e.data} · {formatNumber(Number(e.p13_equivalente), 0)} P13 eq. · {e.km} km</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">{formatCurrency(Number(e.custo_total))}</p>
                  {Number(e.valor_venda) > 0 && <p className="text-xs text-muted-foreground">Margem: {formatCurrency(Number(e.margem))}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && entregas.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma entrega registrada</div>
          )}
        </div>
      </div>
    </TransportadoraLayout>
  );
}
