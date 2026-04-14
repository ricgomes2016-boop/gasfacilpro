import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Loader2, Trash2, List } from "lucide-react";
import { RotaAtacadoMap, getDefaultsByTipo, type Parada, type TipoParada } from "@/components/transportadora/rota-atacado/RotaAtacadoMap";
import { ParadaForm } from "@/components/transportadora/rota-atacado/ParadaForm";
import { CargaTimeline } from "@/components/transportadora/rota-atacado/CargaTimeline";
import { RotaOptimizer } from "@/components/transportadora/rota-atacado/RotaOptimizer";
import { RotaSummaryCard } from "@/components/transportadora/rota-atacado/RotaSummaryCard";
import { haversineDistance } from "@/lib/haversine";
import { formatCurrency } from "@/lib/transp-utils";

const ROAD_FACTOR = 1.3;

interface RotaAtacadoDinamicaProps {
  empresaId: string;
}

export function RotaAtacadoDinamica({ empresaId }: RotaAtacadoDinamicaProps) {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("criar");
  const [nome, setNome] = useState("Nova Rota Atacado");
  const [veiculoId, setVeiculoId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [ajudanteId, setAjudanteId] = useState("");
  const [cargaP13, setCargaP13] = useState(0);
  const [cargaP20, setCargaP20] = useState(0);
  const [cargaP45, setCargaP45] = useState(0);
  const [consumo, setConsumo] = useState(5);
  const [precoComb, setPrecoComb] = useState(6.5);
  const [pedagio, setPedagio] = useState(0);
  const [refeicao, setRefeicao] = useState(0);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: veiculos = [] } = useQuery({
    queryKey: ["transp-veiculos", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("transp_veiculos").select("*").eq("empresa_id", empresaId).eq("ativo", true);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["transp-funcionarios", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("transp_funcionarios").select("*").eq("empresa_id", empresaId).eq("ativo", true);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: rotasSalvas = [], isLoading: loadingRotas } = useQuery({
    queryKey: ["transp-rotas-atacado", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("transp_rotas_atacado").select("*").eq("empresa_id", empresaId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-distribuidoras", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("fornecedores").select("id, nome").eq("empresa_id", empresaId).eq("ativo", true);
      return (data || []).map((f: any) => ({ id: f.id, nome: f.nome }));
    },
    enabled: !!empresaId,
  });

  const { data: unidadesList = [] } = useQuery({
    queryKey: ["unidades-filiais", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("unidades").select("id, nome").eq("empresa_id", empresaId).eq("ativo", true);
      return (data || []).map((u: any) => ({ id: u.id, nome: u.nome }));
    },
    enabled: !!empresaId,
  });

  const { data: clientesList = [] } = useQuery({
    queryKey: ["clientes-rota-atacado", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome").eq("empresa_id", empresaId).eq("ativo", true).limit(500);
      return (data || []).map((c: any) => ({ id: c.id, nome: c.nome }));
    },
    enabled: !!empresaId,
  });

  const veiculoSel = veiculos.find((v: any) => v.id === veiculoId);
  const motoristaSel = funcionarios.find((f: any) => f.id === motoristaId);
  const ajudanteSel = funcionarios.find((f: any) => f.id === ajudanteId);

  const capacidade = {
    p13: veiculoSel?.capacidade_p13 || 0,
    p20: veiculoSel?.capacidade_p20 || 0,
    p45: veiculoSel?.capacidade_p45 || 0,
  };

  const addParada = useCallback((lat: number, lng: number, endereco: string, cidade: string) => {
    const isFirst = paradas.length === 0;
    const tipo: TipoParada = isFirst ? "saida" : "venda";
    const defaults = getDefaultsByTipo(tipo);
    const newParada: Parada = {
      id: crypto.randomUUID(),
      ordem: paradas.length,
      tipo_parada: tipo,
      cidade,
      endereco,
      lat,
      lng,
      qtd_p13: 0,
      qtd_p20: 0,
      qtd_p45: 0,
      impacto_estoque: defaults.impacto_estoque,
      impacto_financeiro: defaults.impacto_financeiro,
      entidade_id: "",
      entidade_tipo: "",
      entidade_nome: "",
      observacoes: "",
    };
    setParadas((prev) => [...prev, newParada]);
  }, [paradas.length]);

  const updateParada = useCallback((id: string, field: string, value: any) => {
    setParadas((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }, []);

  const removeParada = useCallback((id: string) => {
    setParadas((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, ordem: i })));
  }, []);

  const moveParada = useCallback((fromIdx: number, toIdx: number) => {
    setParadas((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr.map((p, i) => ({ ...p, ordem: i }));
    });
  }, []);

  const handleSave = async () => {
    if (!empresaId || !nome.trim() || paradas.length < 2) {
      toast.error("Preencha o nome e adicione ao menos 2 paradas.");
      return;
    }

    setSaving(true);
    try {
      let kmTotal = 0;
      for (let i = 1; i < paradas.length; i++) {
        kmTotal += haversineDistance(paradas[i - 1].lat, paradas[i - 1].lng, paradas[i].lat, paradas[i].lng);
      }
      kmTotal *= ROAD_FACTOR;
      const tempoMin = Math.round((kmTotal / 60) * 60);
      const custoComb = consumo > 0 ? (kmTotal / consumo) * precoComb : 0;
      const motDiario = motoristaSel?.salario_mensal ? Number(motoristaSel.salario_mensal) / 30 : 0;
      const ajDiario = ajudanteSel?.salario_mensal ? Number(ajudanteSel.salario_mensal) / 30 : 0;
      const custoTotal = custoComb + pedagio + refeicao + motDiario + ajDiario;

      const { data: rota, error } = await supabase
        .from("transp_rotas_atacado")
        .insert({
          empresa_id: empresaId,
          nome,
          tipo: "atacado",
          veiculo_id: veiculoId || null,
          motorista_id: motoristaId || null,
          ajudante_id: ajudanteId || null,
          km_total: kmTotal,
          tempo_total_min: tempoMin,
          custo_total: custoTotal,
          carga_inicial_p13: cargaP13,
          carga_inicial_p20: cargaP20,
          carga_inicial_p45: cargaP45,
          consumo_km_litro: consumo,
          preco_combustivel: precoComb,
          custo_pedagio: pedagio,
          custo_refeicao: refeicao,
        })
        .select("id")
        .single();

      if (error) throw error;

      const paradasInsert = paradas.map((p, i) => ({
        rota_id: rota.id,
        ordem: i,
        tipo_parada: p.tipo_parada,
        cidade: p.cidade,
        endereco: p.endereco,
        lat: p.lat,
        lng: p.lng,
        qtd_p13: p.qtd_p13,
        qtd_p20: p.qtd_p20,
        qtd_p45: p.qtd_p45,
        operacao: p.impacto_estoque === "entrada" ? "entrada" : "saida",
        impacto_estoque: p.impacto_estoque,
        impacto_financeiro: p.impacto_financeiro,
        entidade_id: p.entidade_id || null,
        entidade_tipo: p.entidade_tipo || null,
        entidade_nome: p.entidade_nome || null,
        observacoes: p.observacoes,
      }));

      const { error: errParadas } = await supabase.from("transp_rota_paradas").insert(paradasInsert);
      if (errParadas) throw errParadas;

      toast.success("Rota salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["transp-rotas-atacado"] });
      setActiveTab("salvas");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transp_rotas_atacado").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rota excluída.");
      queryClient.invalidateQueries({ queryKey: ["transp-rotas-atacado"] });
    },
  });

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="criar">Criar Rota</TabsTrigger>
          <TabsTrigger value="salvas">Rotas Salvas ({rotasSalvas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="criar" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Coluna 1: Config + Paradas */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Configuração</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Nome da Rota</Label>
                    <Input className="h-8 text-xs" value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>

                  <div>
                    <Label className="text-xs">Veículo</Label>
                    <Select value={veiculoId} onValueChange={(v) => {
                      setVeiculoId(v);
                      const veh = veiculos.find((x: any) => x.id === v);
                      if (veh) setConsumo(Number(veh.consumo_km_litro) || 5);
                    }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {veiculos.map((v: any) => (
                          <SelectItem key={v.id} value={v.id}>{v.placa} — {v.tipo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Motorista</Label>
                      <Select value={motoristaId} onValueChange={setMotoristaId}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sel." /></SelectTrigger>
                        <SelectContent>
                          {funcionarios.filter((f: any) => f.cargo === "motorista").map((f: any) => (
                            <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Ajudante</Label>
                      <Select value={ajudanteId} onValueChange={setAjudanteId}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sel." /></SelectTrigger>
                        <SelectContent>
                          {funcionarios.filter((f: any) => f.cargo === "ajudante").map((f: any) => (
                            <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">P13 Inicial</Label>
                      <Input type="number" className="h-8 text-xs" value={cargaP13}
                        onChange={(e) => setCargaP13(parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">P20 Inicial</Label>
                      <Input type="number" className="h-8 text-xs" value={cargaP20}
                        onChange={(e) => setCargaP20(parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">P45 Inicial</Label>
                      <Input type="number" className="h-8 text-xs" value={cargaP45}
                        onChange={(e) => setCargaP45(parseInt(e.target.value) || 0)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Consumo (km/L)</Label>
                      <Input type="number" step="0.1" className="h-8 text-xs" value={consumo}
                        onChange={(e) => setConsumo(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">Preço Comb (R$)</Label>
                      <Input type="number" step="0.01" className="h-8 text-xs" value={precoComb}
                        onChange={(e) => setPrecoComb(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Pedágio (R$)</Label>
                      <Input type="number" step="0.01" className="h-8 text-xs" value={pedagio}
                        onChange={(e) => setPedagio(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">Refeição (R$)</Label>
                      <Input type="number" step="0.01" className="h-8 text-xs" value={refeicao}
                        onChange={(e) => setRefeicao(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Paradas ({paradas.length})</CardTitle>
                  <RotaOptimizer paradas={paradas} onOptimize={setParadas} />
                </CardHeader>
                <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                  {paradas.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Clique no mapa ou busque um endereço para adicionar paradas.
                    </p>
                  )}
                  {paradas.map((p, i) => (
                    <ParadaForm
                      key={p.id}
                      parada={p}
                      index={i}
                      onChange={updateParada}
                      onRemove={removeParada}
                      onMoveUp={(idx) => moveParada(idx, idx - 1)}
                      onMoveDown={(idx) => moveParada(idx, idx + 1)}
                      isFirst={i === 0}
                      isLast={i === paradas.length - 1}
                      distribuidoras={fornecedores}
                      unidades={unidadesList}
                      clientes={clientesList}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Coluna 2: Mapa */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Mapa da Rota</CardTitle>
                </CardHeader>
                <CardContent>
                  <RotaAtacadoMap paradas={paradas} onAddParada={addParada} />
                </CardContent>
              </Card>
            </div>

            {/* Coluna 3: Timeline + Resumo */}
            <div className="space-y-4">
              <RotaSummaryCard
                paradas={paradas}
                consumoKmLitro={consumo}
                precoCombustivel={precoComb}
                custoPedagio={pedagio}
                custoRefeicao={refeicao}
                salarioMotorista={motoristaSel?.salario_mensal ? Number(motoristaSel.salario_mensal) : 0}
                salarioAjudante={ajudanteSel?.salario_mensal ? Number(ajudanteSel.salario_mensal) : 0}
                cargaInicial={{ p13: cargaP13, p20: cargaP20, p45: cargaP45 }}
              />

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Timeline de Carga</CardTitle>
                </CardHeader>
                <CardContent>
                  <CargaTimeline
                    paradas={paradas}
                    cargaInicial={{ p13: cargaP13, p20: cargaP20, p45: cargaP45 }}
                    capacidade={capacidade}
                  />
                </CardContent>
              </Card>

              <Button className="w-full gap-2" onClick={handleSave} disabled={saving || paradas.length < 2}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Rota
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="salvas">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <List className="h-4 w-4" /> Rotas Salvas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRotas && <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
              {!loadingRotas && rotasSalvas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma rota salva ainda.</p>
              )}
              <div className="space-y-2">
                {rotasSalvas.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{r.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {Number(r.km_total).toFixed(1)} km · {r.tempo_total_min}min · {formatCurrency(Number(r.custo_total))}
                        <span className="ml-2 capitalize">{r.status}</span>
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8"
                      onClick={() => deleteMut.mutate(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
