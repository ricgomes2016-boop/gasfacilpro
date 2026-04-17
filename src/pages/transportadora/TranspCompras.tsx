import { useState, useMemo } from "react";
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
import { P45_TO_P13, P20_TO_P13, formatCurrency, formatNumber } from "@/lib/transp-utils";
import { toast } from "sonner";
import { Plus, ShoppingCart, Download, RefreshCw, BarChart3, Package } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComprasAnaliseGLP } from "@/components/transportadora/compras/ComprasAnaliseGLP";
import { ComprasProdutos } from "@/components/transportadora/compras/ComprasProdutos";
import { ComprasKpiToneladas } from "@/components/transportadora/compras/CompraisKpiToneladas";
import { ComparativoFornecedoresUnit } from "@/components/transportadora/compras/ComparativoFornecedoresUnit";
import { ComprasListaTable } from "@/components/transportadora/compras/ComprasListaTable";
import { ResumoPorLoja } from "@/components/transportadora/compras/ResumoPorLoja";

const AGUA_TO_P13 = 1;

interface CompraForm {
  data: string;
  fornecedor: string;
  cidade_fornecedor: string;
  distancia_ida_km: number;
  veiculo_id: string;
  qtd_p13: number;
  qtd_p20: number;
  qtd_p45: number;
  qtd_agua: number;
  valor_compra: number;
  preco_litro: number;
  consumo_km_l: number;
  custo_pedagio: number;
  custo_refeicao: number;
  custo_outros: number;
  observacoes: string;
}

const defaultForm: CompraForm = {
  data: format(new Date(), "yyyy-MM-dd"),
  fornecedor: "",
  cidade_fornecedor: "",
  distancia_ida_km: 0,
  veiculo_id: "",
  qtd_p13: 0,
  qtd_p20: 0,
  qtd_p45: 0,
  qtd_agua: 0,
  valor_compra: 0,
  preco_litro: 7.50,
  consumo_km_l: 2.8,
  custo_pedagio: 0,
  custo_refeicao: 0,
  custo_outros: 0,
  observacoes: "",
};

function calcCustos(form: CompraForm) {
  const distTotal = form.distancia_ida_km * 2;
  const combustivel = form.consumo_km_l > 0 ? (distTotal / form.consumo_km_l) * form.preco_litro : 0;
  const logisticoTotal = combustivel + form.custo_pedagio + form.custo_refeicao + form.custo_outros;
  const p13Equiv = form.qtd_p13 + form.qtd_p20 * P20_TO_P13 + form.qtd_p45 * P45_TO_P13 + form.qtd_agua * AGUA_TO_P13;
  const custoTotal = form.valor_compra + logisticoTotal;
  const custoPorP13Eq = p13Equiv > 0 ? custoTotal / p13Equiv : 0;

  return {
    combustivel,
    logisticoTotal,
    custoTotal,
    p13Equiv,
    custo_unit_p13: custoPorP13Eq,
    custo_unit_p20: custoPorP13Eq * P20_TO_P13,
    custo_unit_p45: custoPorP13Eq * P45_TO_P13,
    custo_unit_agua: custoPorP13Eq * AGUA_TO_P13,
  };
}

export default function TranspCompras() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState<CompraForm>({ ...defaultForm });
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [filtroRemetente, setFiltroRemetente] = useState(localStorage.getItem("transp_xml_remetente") || "");
  const [diasBusca, setDiasBusca] = useState(Number(localStorage.getItem("transp_xml_dias") || "30"));
  const [ultimaImportacao, setUltimaImportacao] = useState<string | null>(localStorage.getItem("transp_xml_ultima"));
  const [ultimoResultado, setUltimoResultado] = useState<any>(null);

  async function importarXmlOutlook() {
    setImporting(true);
    setUltimoResultado(null);
    try {
      localStorage.setItem("transp_xml_remetente", filtroRemetente);
      localStorage.setItem("transp_xml_dias", String(diasBusca));
      const { data, error } = await supabase.functions.invoke("importar_xml_outlook", {
        body: { filtro_remetente: filtroRemetente || null, dias: diasBusca },
      });
      if (error) throw error;
      const agora = new Date().toISOString();
      localStorage.setItem("transp_xml_ultima", agora);
      setUltimaImportacao(agora);
      setUltimoResultado(data);
      toast.success("Importação concluída", {
        description: `${data?.total_importados ?? 0} XMLs novos · ${data?.ja_existentes ?? 0} já existentes · ${data?.erros ?? 0} erros`,
      });
      qc.invalidateQueries({ queryKey: ["transp-compras"] });
    } catch (err: any) {
      toast.error("Erro ao importar", { description: err.message });
    } finally {
      setImporting(false);
    }
  }

  const { data: veiculos = [] } = useQuery({
    queryKey: ["transp-veiculos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transp_veiculos").select("id, placa, tipo, consumo_km_litro").eq("ativo", true);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: compras = [], isLoading } = useQuery({
    queryKey: ["transp-compras"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transp_compras").select("*").order("data", { ascending: false }).limit(100);
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

  const custos = useMemo(() => calcCustos(form), [form]);

  const comprasPeriodo = useMemo(() => compras.filter((c: any) => c.mes_referencia === periodo), [compras, periodo]);

  const resumoMensal = useMemo(() => {
    if (comprasPeriodo.length === 0) return null;
    let totalP13 = 0, totalP20 = 0, totalP45 = 0, totalAgua = 0;
    let somaCustoP13 = 0, somaCustoP20 = 0, somaCustoP45 = 0, somaCustoAgua = 0;
    let totalGasto = 0;

    comprasPeriodo.forEach((c: any) => {
      const qp13 = Number(c.qtd_p13) || 0;
      const qp20 = Number(c.qtd_p20) || 0;
      const qp45 = Number(c.qtd_p45) || 0;
      const qagua = Number(c.qtd_agua) || 0;
      totalP13 += qp13;
      totalP20 += qp20;
      totalP45 += qp45;
      totalAgua += qagua;
      somaCustoP13 += Number(c.custo_unit_p13) * qp13;
      somaCustoP20 += Number(c.custo_unit_p20) * qp20;
      somaCustoP45 += Number(c.custo_unit_p45) * qp45;
      somaCustoAgua += Number(c.custo_unit_agua) * qagua;
      totalGasto += Number(c.custo_total);
    });

    return {
      mediaP13: totalP13 > 0 ? somaCustoP13 / totalP13 : 0,
      mediaP20: totalP20 > 0 ? somaCustoP20 / totalP20 : 0,
      mediaP45: totalP45 > 0 ? somaCustoP45 / totalP45 : 0,
      mediaAgua: totalAgua > 0 ? somaCustoAgua / totalAgua : 0,
      totalP13, totalP20, totalP45, totalAgua, totalGasto,
    };
  }, [comprasPeriodo]);

  const save = useMutation({
    mutationFn: async () => {
      const c = calcCustos(form);
      const { error } = await (supabase as any).from("transp_compras").insert({
        empresa_id: profile?.empresa_id,
        data: form.data,
        fornecedor: form.fornecedor,
        cidade_fornecedor: form.cidade_fornecedor || null,
        distancia_ida_km: form.distancia_ida_km,
        veiculo_id: form.veiculo_id || null,
        qtd_p13: form.qtd_p13,
        qtd_p20: form.qtd_p20,
        qtd_p45: form.qtd_p45,
        qtd_agua: form.qtd_agua,
        valor_compra: form.valor_compra,
        custo_combustivel: c.combustivel,
        custo_pedagio: form.custo_pedagio,
        custo_refeicao: form.custo_refeicao,
        custo_outros: form.custo_outros,
        custo_logistico_total: c.logisticoTotal,
        custo_total: c.custoTotal,
        custo_unit_p13: c.custo_unit_p13,
        custo_unit_p20: c.custo_unit_p20,
        custo_unit_p45: c.custo_unit_p45,
        custo_unit_agua: c.custo_unit_agua,
        mes_referencia: form.data.slice(0, 7),
        observacoes: form.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-compras"] });
      toast.success("Compra registrada!");
      setForm({ ...defaultForm });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleVeiculoChange = (id: string) => {
    const v = veiculos.find((ve: any) => ve.id === id);
    setForm({
      ...form,
      veiculo_id: id,
      consumo_km_l: v?.consumo_km_litro ? Number(v.consumo_km_litro) : form.consumo_km_l,
    });
  };

  const set = (key: keyof CompraForm, val: any) => setForm({ ...form, [key]: val });

  return (
    <TransportadoraLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Compras</h1>
            <p className="text-muted-foreground text-sm">Registro de compras em distribuidoras · Origem: Cornélio Procópio</p>
          </div>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <Label className="text-xs">Período</Label>
              <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-40" />
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" />Nova Compra</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Registrar Compra</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} /></div>
                    <div><Label>Fornecedor</Label><Input value={form.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} placeholder="Ex: Nacional Gás" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Cidade Fornecedor</Label><Input value={form.cidade_fornecedor} onChange={(e) => set("cidade_fornecedor", e.target.value)} placeholder="Ex: Apucarana" /></div>
                    <div><Label>Distância ida (km)</Label><Input type="number" value={form.distancia_ida_km} onChange={(e) => set("distancia_ida_km", +e.target.value)} /></div>
                  </div>
                  <div>
                    <Label>Veículo</Label>
                    <Select value={form.veiculo_id} onValueChange={handleVeiculoChange}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{veiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa} ({v.tipo})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div className="border-t border-border/40 pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">QUANTIDADES</p>
                    <div className="grid grid-cols-4 gap-2">
                      <div><Label className="text-xs">P13</Label><Input type="number" value={form.qtd_p13} onChange={(e) => set("qtd_p13", +e.target.value)} /></div>
                      <div><Label className="text-xs">P20</Label><Input type="number" value={form.qtd_p20} onChange={(e) => set("qtd_p20", +e.target.value)} /></div>
                      <div><Label className="text-xs">P45</Label><Input type="number" value={form.qtd_p45} onChange={(e) => set("qtd_p45", +e.target.value)} /></div>
                      <div><Label className="text-xs">Água</Label><Input type="number" value={form.qtd_agua} onChange={(e) => set("qtd_agua", +e.target.value)} /></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">P13 equiv.: <strong>{formatNumber(custos.p13Equiv, 0)}</strong></p>
                  </div>

                  <div className="border-t border-border/40 pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">VALOR DA COMPRA</p>
                    <div><Label>Total pago ao fornecedor (R$)</Label><Input type="number" step="0.01" value={form.valor_compra} onChange={(e) => set("valor_compra", +e.target.value)} /></div>
                  </div>

                  <div className="border-t border-border/40 pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">CUSTOS LOGÍSTICOS</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">Consumo (km/l)</Label><Input type="number" step="0.1" value={form.consumo_km_l} onChange={(e) => set("consumo_km_l", +e.target.value)} /></div>
                      <div><Label className="text-xs">Preço Diesel (R$/l)</Label><Input type="number" step="0.01" value={form.preco_litro} onChange={(e) => set("preco_litro", +e.target.value)} /></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Combustível (ida+volta {formatNumber(form.distancia_ida_km * 2, 0)} km): <strong>{formatCurrency(custos.combustivel)}</strong>
                    </p>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div><Label className="text-xs">Pedágio</Label><Input type="number" step="0.01" value={form.custo_pedagio} onChange={(e) => set("custo_pedagio", +e.target.value)} /></div>
                      <div><Label className="text-xs">Refeição</Label><Input type="number" step="0.01" value={form.custo_refeicao} onChange={(e) => set("custo_refeicao", +e.target.value)} /></div>
                      <div><Label className="text-xs">Outros</Label><Input type="number" step="0.01" value={form.custo_outros} onChange={(e) => set("custo_outros", +e.target.value)} /></div>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-3 bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">RESUMO DO CUSTO</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span className="text-muted-foreground">Logístico total:</span><span className="font-bold text-foreground">{formatCurrency(custos.logisticoTotal)}</span>
                      <span className="text-muted-foreground">Custo total:</span><span className="font-bold text-foreground">{formatCurrency(custos.custoTotal)}</span>
                    </div>
                    {custos.p13Equiv > 0 && (
                      <div className="grid grid-cols-2 gap-1 text-xs mt-2 pt-2 border-t border-border/30">
                        <span className="text-muted-foreground">Custo unit. P13:</span><span className="font-bold text-primary">{formatCurrency(custos.custo_unit_p13)}</span>
                        {form.qtd_p20 > 0 && <><span className="text-muted-foreground">Custo unit. P20:</span><span className="font-bold text-foreground">{formatCurrency(custos.custo_unit_p20)}</span></>}
                        {form.qtd_p45 > 0 && <><span className="text-muted-foreground">Custo unit. P45:</span><span className="font-bold text-foreground">{formatCurrency(custos.custo_unit_p45)}</span></>}
                        {form.qtd_agua > 0 && <><span className="text-muted-foreground">Custo unit. Água:</span><span className="font-bold text-foreground">{formatCurrency(custos.custo_unit_agua)}</span></>}
                      </div>
                    )}
                  </div>

                  <div><Label>Observações</Label><Input value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></div>
                  <Button type="submit" className="w-full" disabled={save.isPending || !form.fornecedor}>Registrar Compra</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Painel Importação Outlook */}
          <div className="w-full mt-2 p-3 rounded-lg border border-border/40 bg-muted/20">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Importação automática de XML (NF-e) do Outlook</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto_auto] gap-2 items-end">
              <div>
                <Label className="text-xs">Filtrar remetente (opcional)</Label>
                <Input
                  type="email"
                  placeholder="ex: nfe@fornecedor.com.br (vazio = todos)"
                  value={filtroRemetente}
                  onChange={(e) => setFiltroRemetente(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Últimos (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={diasBusca}
                  onChange={(e) => setDiasBusca(Math.min(180, Math.max(1, +e.target.value || 30)))}
                  className="h-9"
                />
              </div>
              <Button onClick={importarXmlOutlook} disabled={importing} className="gap-2 h-9">
                <Download className="h-4 w-4" />Importar XML
              </Button>
              <Button onClick={importarXmlOutlook} disabled={importing} variant="outline" className="gap-2 h-9">
                <RefreshCw className={`h-4 w-4 ${importing ? "animate-spin" : ""}`} />Buscar agora
              </Button>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              <span>📧 Outlook conectado</span>
              <span>·</span>
              <span>Última importação: {ultimaImportacao ? format(new Date(ultimaImportacao), "dd/MM/yyyy HH:mm") : "—"}</span>
              {ultimoResultado && (
                <>
                  <span>·</span>
                  <span className="text-foreground font-medium">
                    {ultimoResultado.total_importados ?? 0} novos · {ultimoResultado.ja_existentes ?? 0} já existentes · {ultimoResultado.erros ?? 0} erros
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="compras" className="w-full">
          <TabsList>
            <TabsTrigger value="compras" className="gap-1.5"><ShoppingCart className="h-4 w-4" />Compras</TabsTrigger>
            <TabsTrigger value="analise" className="gap-1.5"><BarChart3 className="h-4 w-4" />Análise GLP</TabsTrigger>
            <TabsTrigger value="produtos" className="gap-1.5"><Package className="h-4 w-4" />Produtos</TabsTrigger>
          </TabsList>

          <TabsContent value="compras" className="space-y-4 mt-4">
            {/* Resumo Mensal */}
            {resumoMensal && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Card className="border-border/40"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Custo Médio P13</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(resumoMensal.mediaP13)}</p>
                  <p className="text-xs text-muted-foreground">{resumoMensal.totalP13} un</p>
                </CardContent></Card>
                <Card className="border-border/40"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Custo Médio P20</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(resumoMensal.mediaP20)}</p>
                  <p className="text-xs text-muted-foreground">{resumoMensal.totalP20} un</p>
                </CardContent></Card>
                <Card className="border-border/40"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Custo Médio P45</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(resumoMensal.mediaP45)}</p>
                  <p className="text-xs text-muted-foreground">{resumoMensal.totalP45} un</p>
                </CardContent></Card>
                <Card className="border-border/40"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Custo Médio Água</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(resumoMensal.mediaAgua)}</p>
                  <p className="text-xs text-muted-foreground">{resumoMensal.totalAgua} un</p>
                </CardContent></Card>
                <Card className="border-border/40"><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Total Gasto</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(resumoMensal.totalGasto)}</p>
                  <p className="text-xs text-muted-foreground">{comprasPeriodo.length} compras</p>
                </CardContent></Card>
              </div>
            )}

            {/* Tabela de compras (com busca, alerta de duplicatas, vencimento e pago) */}
            <ComprasListaTable compras={comprasPeriodo} />
          </TabsContent>

          <TabsContent value="analise" className="mt-4 space-y-4">
            <ComprasKpiToneladas compras={compras} />
            <ComparativoFornecedores compras={compras} />
            <ComprasAnaliseGLP compras={compras} />
          </TabsContent>

          <TabsContent value="produtos" className="mt-4">
            <ComprasProdutos compras={compras} />
          </TabsContent>
        </Tabs>

      </div>
    </TransportadoraLayout>
  );
}
