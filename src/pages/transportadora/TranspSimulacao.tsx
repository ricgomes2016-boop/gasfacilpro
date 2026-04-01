import { useState, useMemo } from "react";
import { TransportadoraLayout } from "@/components/transportadora/TransportadoraLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { calcP13Equivalente, calcCustoCombustivel, calcSalarioDiario, calcCustoTotal, calcCustoPorP13Equiv, formatCurrency, formatNumber } from "@/lib/transp-utils";
import { toast } from "sonner";
import { Calculator, Save, Route } from "lucide-react";
import { RouteMapDialog } from "@/components/transportadora/RouteMapDialog";

export default function TranspSimulacao() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: veiculos = [] } = useQuery({
    queryKey: ["transp-veiculos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transp_veiculos").select("*").eq("ativo", true).order("placa");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["transp-funcionarios"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transp_funcionarios").select("*").eq("ativo", true).order("nome");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["unidades-transp"],
    queryFn: async () => {
      const { data } = await supabase.from("unidades").select("id, nome, tipo").eq("ativo", true).order("nome");
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

  const [form, setForm] = useState({
    origem: "", destino: "", tipo: "abastecimento", km: 0, veiculo_id: "", motorista_id: "", ajudante_id: "",
    qtd_p13: 0, qtd_p20: 0, qtd_p45: 0, ida_volta: false,
    preco_combustivel_litro: 6.50, custo_pedagio: 0, custo_refeicao: 0,
    origem_unidade_id: "", destino_unidade_id: "",
  });

  const veiculo = veiculos.find((v: any) => v.id === form.veiculo_id);
  const motorista = funcionarios.find((f: any) => f.id === form.motorista_id);
  const ajudante = form.ajudante_id && form.ajudante_id !== "nenhum" ? funcionarios.find((f: any) => f.id === form.ajudante_id) : null;

  const result = useMemo(() => {
    const p13Equiv = calcP13Equivalente(form.qtd_p13, form.qtd_p20, form.qtd_p45);
    const custoComb = veiculo ? calcCustoCombustivel(form.km, veiculo.consumo_km_litro, form.preco_combustivel_litro, form.ida_volta) : 0;
    const custoMot = motorista ? calcSalarioDiario(motorista.salario_mensal) : 0;
    const custoAjud = ajudante ? calcSalarioDiario(ajudante.salario_mensal) : 0;
    const total = calcCustoTotal({ combustivel: custoComb, pedagio: form.custo_pedagio, refeicao: form.custo_refeicao, motorista: custoMot, ajudante: custoAjud });
    const custoPorP13 = calcCustoPorP13Equiv(total, p13Equiv);
    return { p13Equiv, custoComb, custoMot, custoAjud, total, custoPorP13 };
  }, [form, veiculo, motorista, ajudante]);

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("transp_simulacoes").insert({
        empresa_id: profile?.empresa_id,
        origem: form.origem || unidades.find((u: any) => u.id === form.origem_unidade_id)?.nome || "N/D",
        destino: form.destino || unidades.find((u: any) => u.id === form.destino_unidade_id)?.nome || "N/D",
        tipo: form.tipo, km: form.km, veiculo_id: form.veiculo_id || null,
        motorista_id: form.motorista_id || null, ajudante_id: form.ajudante_id && form.ajudante_id !== "nenhum" ? form.ajudante_id : null,
        qtd_p13: form.qtd_p13, qtd_p20: form.qtd_p20, qtd_p45: form.qtd_p45,
        ida_volta: form.ida_volta,
        custo_combustivel: result.custoComb, custo_pedagio: form.custo_pedagio,
        custo_refeicao: form.custo_refeicao, custo_motorista: result.custoMot, custo_ajudante: result.custoAjud,
        custo_total: result.total, custo_p13_equiv: result.custoPorP13,
        preco_combustivel_litro: form.preco_combustivel_litro,
        origem_unidade_id: form.origem_unidade_id || null, destino_unidade_id: form.destino_unidade_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Simulação salva!"); qc.invalidateQueries({ queryKey: ["transp-simulacoes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <TransportadoraLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Simulação de Viagem</h1>
          <p className="text-muted-foreground text-sm">Previsão de custos por rota</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form */}
          <Card className="border-border/40">
            <CardHeader><CardTitle className="text-base">Dados da Viagem</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({...form, tipo: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="abastecimento">Abastecimento</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="venda">Venda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1"><Label>KM</Label><Input type="number" value={form.km} onChange={(e) => setForm({...form, km: +e.target.value})} /></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Origem (Unidade)</Label>
                  <Select value={form.origem_unidade_id} onValueChange={(v) => setForm({...form, origem_unidade_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {unidades.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Destino (Unidade)</Label>
                  <Select value={form.destino_unidade_id} onValueChange={(v) => setForm({...form, destino_unidade_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {unidades.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Origem (texto)</Label><Input value={form.origem} onChange={(e) => setForm({...form, origem: e.target.value})} placeholder="Endereço livre" /></div>
                <div><Label>Destino (texto)</Label><Input value={form.destino} onChange={(e) => setForm({...form, destino: e.target.value})} placeholder="Endereço livre" /></div>
              </div>

              <div><Label>Veículo</Label>
                <Select value={form.veiculo_id} onValueChange={(v) => setForm({...form, veiculo_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {veiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa} ({v.tipo})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Motorista</Label>
                  <Select value={form.motorista_id} onValueChange={(v) => setForm({...form, motorista_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {funcionarios.filter((f: any) => f.cargo === "motorista").map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Ajudante</Label>
                  <Select value={form.ajudante_id} onValueChange={(v) => setForm({...form, ajudante_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      {funcionarios.filter((f: any) => f.cargo === "ajudante").map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div><Label>Qtd P13</Label><Input type="number" value={form.qtd_p13} onChange={(e) => setForm({...form, qtd_p13: +e.target.value})} /></div>
                <div><Label>Qtd P20</Label><Input type="number" value={form.qtd_p20} onChange={(e) => setForm({...form, qtd_p20: +e.target.value})} /></div>
                <div><Label>Qtd P45</Label><Input type="number" value={form.qtd_p45} onChange={(e) => setForm({...form, qtd_p45: +e.target.value})} /></div>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={form.ida_volta} onCheckedChange={(v) => setForm({...form, ida_volta: v})} />
                <Label>Ida + Volta</Label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div><Label>R$/litro</Label><Input type="number" step="0.01" value={form.preco_combustivel_litro} onChange={(e) => setForm({...form, preco_combustivel_litro: +e.target.value})} /></div>
                <div><Label>Pedágio</Label><Input type="number" step="0.01" value={form.custo_pedagio} onChange={(e) => setForm({...form, custo_pedagio: +e.target.value})} /></div>
                <div><Label>Refeição</Label><Input type="number" step="0.01" value={form.custo_refeicao} onChange={(e) => setForm({...form, custo_refeicao: +e.target.value})} /></div>
              </div>
            </CardContent>
          </Card>

          {/* Result */}
          <Card className="border-border/40">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" />Resultado</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-muted/40 rounded-lg"><p className="text-muted-foreground text-xs">Combustível</p><p className="font-bold text-foreground">{formatCurrency(result.custoComb)}</p></div>
                <div className="p-3 bg-muted/40 rounded-lg"><p className="text-muted-foreground text-xs">Pedágio</p><p className="font-bold text-foreground">{formatCurrency(form.custo_pedagio)}</p></div>
                <div className="p-3 bg-muted/40 rounded-lg"><p className="text-muted-foreground text-xs">Refeição</p><p className="font-bold text-foreground">{formatCurrency(form.custo_refeicao)}</p></div>
                <div className="p-3 bg-muted/40 rounded-lg"><p className="text-muted-foreground text-xs">Motorista</p><p className="font-bold text-foreground">{formatCurrency(result.custoMot)}</p></div>
                <div className="p-3 bg-muted/40 rounded-lg"><p className="text-muted-foreground text-xs">Ajudante</p><p className="font-bold text-foreground">{formatCurrency(result.custoAjud)}</p></div>
                <div className="p-3 bg-muted/40 rounded-lg"><p className="text-muted-foreground text-xs">P13 Equivalente</p><p className="font-bold text-foreground">{formatNumber(result.p13Equiv, 0)} un</p></div>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Custo Total</span>
                  <span className="text-xl font-bold text-foreground">{formatCurrency(result.total)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Custo / P13 equiv.</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(result.custoPorP13)}</span>
                </div>
              </div>

              <Button onClick={() => salvar.mutate()} className="w-full gap-2" disabled={salvar.isPending}>
                <Save className="h-4 w-4" />Salvar Simulação
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </TransportadoraLayout>
  );
}
