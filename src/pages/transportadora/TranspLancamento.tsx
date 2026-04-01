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
import { formatCurrency } from "@/lib/transp-utils";
import { toast } from "sonner";
import { Plus, Receipt, Upload } from "lucide-react";
import { format } from "date-fns";

const TIPOS_DESPESA = [
  { value: "combustivel", label: "Combustível" },
  { value: "manutencao", label: "Manutenção" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "salario", label: "Salários" },
  { value: "pedagio", label: "Pedágio" },
  { value: "outros", label: "Outros" },
];

export default function TranspLancamento() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "combustivel", descricao: "", valor: 0, data: format(new Date(), "yyyy-MM-dd"), veiculo_id: "", comprovante: null as File | null });

  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ["transp-despesas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("transp_despesas").select("*").order("data", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ["transp-veiculos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transp_veiculos").select("id, placa").eq("ativo", true);
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
      let comprovante_url = null;
      if (form.comprovante) {
        const ext = form.comprovante.name.split(".").pop();
        const path = `${profile?.empresa_id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("transp-comprovantes").upload(path, form.comprovante);
        if (upErr) throw upErr;
        comprovante_url = path;
      }
      const { error } = await (supabase as any).from("transp_despesas").insert({
        empresa_id: profile?.empresa_id,
        tipo: form.tipo, descricao: form.descricao || null, valor: form.valor,
        data: form.data, veiculo_id: form.veiculo_id && form.veiculo_id !== "nenhum" ? form.veiculo_id : null,
        mes_referencia: form.data.slice(0, 7), comprovante_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-despesas"] });
      toast.success("Despesa registrada!");
      setOpen(false);
      setForm({ tipo: "combustivel", descricao: "", valor: 0, data: format(new Date(), "yyyy-MM-dd"), veiculo_id: "", comprovante: null });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mesAtual = new Date().toISOString().slice(0, 7);
  const totalMes = despesas.filter((d: any) => d.data?.startsWith(mesAtual)).reduce((acc: number, d: any) => acc + Number(d.valor), 0);

  return (
    <TransportadoraLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Despesas</h1>
            <p className="text-muted-foreground text-sm">Despesas reais do mês · Total: <strong>{formatCurrency(totalMes)}</strong></p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Nova Despesa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar Despesa</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({...form, tipo: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS_DESPESA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({...form, data: e.target.value})} /></div>
                </div>
                <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({...form, valor: +e.target.value})} /></div>
                  <div><Label>Veículo</Label>
                    <Select value={form.veiculo_id} onValueChange={(v) => setForm({...form, veiculo_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        {veiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Comprovante (foto/nota)</Label>
                  <Input type="file" accept="image/*,application/pdf" onChange={(e) => setForm({...form, comprovante: e.target.files?.[0] || null})} />
                </div>
                <Button type="submit" className="w-full" disabled={save.isPending}>Registrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {despesas.map((d: any) => (
            <Card key={d.id} className="border-border/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground capitalize">{TIPOS_DESPESA.find(t => t.value === d.tipo)?.label || d.tipo}</p>
                    <p className="text-xs text-muted-foreground">{d.data} {d.descricao && `· ${d.descricao}`}</p>
                  </div>
                </div>
                <p className="font-bold text-foreground">{formatCurrency(Number(d.valor))}</p>
              </CardContent>
            </Card>
          ))}
          {!isLoading && despesas.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma despesa registrada</div>
          )}
        </div>
      </div>
    </TransportadoraLayout>
  );
}
