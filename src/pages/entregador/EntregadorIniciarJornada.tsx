import { useState, useEffect, useMemo, useCallback } from "react";
import { getBrasiliaDateString } from "@/lib/utils";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  Gauge,
  Package,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  PlayCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { TerminalQRScanner } from "@/components/entregador/TerminalQRScanner";
import { Checkbox } from "@/components/ui/checkbox";

interface CidadeRota {
  nome: string;
  lat: number;
  lng: number;
  km: number;
  opcional?: boolean;
}

interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  marca: string | null;
  km_atual: number | null;
}

interface RotaDefinida {
  id: string;
  nome: string;
  bairros: string[];
  distancia_km: number | null;
  tempo_estimado: string | null;
  tipo?: string;
  cidades?: CidadeRota[];
}

interface Escala {
  id: string;
  data: string;
  turno_inicio: string;
  turno_fim: string;
  status: string;
  rota_definida_id: string | null;
  rotas_definidas: RotaDefinida | null;
}

interface ProdutoEstoque {
  id: string;
  nome: string;
  estoque: number | null;
  categoria: string | null;
}

interface CargaRealItem {
  produto_id: string;
  produto_nome: string;
  quantidade_saida: number;
  quantidade_vendida: number;
  quantidade_transferida: number;
  quantidade_restante: number;
}

export default function EntregadorIniciarJornada() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [rotasDefinidas, setRotasDefinidas] = useState<RotaDefinida[]>([]);
  const [escalaHoje, setEscalaHoje] = useState<Escala | null>(null);
  const [_produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const [terminalFixoNome, setTerminalFixoNome] = useState<string | null>(null);
  const [terminalAtivoNome, setTerminalAtivoNome] = useState<string | null>(null);
  
  const [veiculoSelecionado, setVeiculoSelecionado] = useState("");
  const [kmInicial, setKmInicial] = useState("");
  const [rotaSelecionada, setRotaSelecionada] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isIniciando, setIsIniciando] = useState(false);
  const [isEncerrando, setIsEncerrando] = useState(false);
  const [rotaAtiva, setRotaAtiva] = useState(false);
  const [rotaAtivaId, setRotaAtivaId] = useState<string | null>(null);
  const [rotaAtivaKmInicial, setRotaAtivaKmInicial] = useState<number | null>(null);
  const [kmFinal, setKmFinal] = useState("");
  const [cargaReal, setCargaReal] = useState<CargaRealItem[]>([]);
  const [carregamentoId, setCarregamentoId] = useState<string | null>(null);
  const [isLoadingCarga, setIsLoadingCarga] = useState(false);
  const [cidadesSelecionadas, setCidadesSelecionadas] = useState<string[]>([]);

  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Get entregador with terminal info
      const { data: entregador } = await supabase
        .from("entregadores")
        .select("id, terminal_id, terminal_ativo_id, unidade_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (entregador) {
        setEntregadorId(entregador.id);

        // Fetch terminal names
        if (entregador.terminal_id) {
          const { data: tf } = await (supabase.from("terminais_cartao" as any).select("nome").eq("id", entregador.terminal_id).maybeSingle() as any);
          if (tf) setTerminalFixoNome(tf.nome);
        }
        if (entregador.terminal_ativo_id) {
          const { data: ta } = await (supabase.from("terminais_cartao" as any).select("nome").eq("id", entregador.terminal_ativo_id).maybeSingle() as any);
          if (ta) setTerminalAtivoNome(ta.nome);
        }

        // Check if already has active route today
        const { data: rotaAtual } = await supabase
          .from("rotas")
          .select("id, km_inicial")
          .eq("entregador_id", entregador.id)
          .eq("status", "em_andamento")
          .maybeSingle();

        if (rotaAtual) {
          setRotaAtiva(true);
          setRotaAtivaId(rotaAtual.id);
          setRotaAtivaKmInicial(rotaAtual.km_inicial);
        }

        // Get today's schedule
        const hoje = getBrasiliaDateString();
        const { data: escala } = await supabase
          .from("escalas_entregador")
          .select(`
            id, data, turno_inicio, turno_fim, status, rota_definida_id,
            rotas_definidas:rota_definida_id (id, nome, bairros, distancia_km, tempo_estimado, tipo, cidades)
          `)
          .eq("entregador_id", entregador.id)
          .eq("data", hoje)
          .maybeSingle();

        if (escala) {
          setEscalaHoje(escala as unknown as Escala);
          if (escala.rota_definida_id) {
            setRotaSelecionada(escala.rota_definida_id);
          }
        }
      }

      // Fetch vehicles, routes, products in parallel
      let vQ = supabase.from("veiculos").select("id, placa, modelo, marca, km_atual").eq("ativo", true);
      let rQ = supabase.from("rotas_definidas").select("id, nome, bairros, distancia_km, tempo_estimado, tipo, cidades").eq("ativo", true);
      let pQ = supabase.from("produtos").select("id, nome, estoque, categoria").eq("ativo", true).order("nome");
      if (entregador?.unidade_id) {
        vQ = vQ.eq("unidade_id", entregador.unidade_id);
        rQ = rQ.eq("unidade_id", entregador.unidade_id);
        pQ = pQ.eq("unidade_id", entregador.unidade_id);
      }
      const [veiculosRes, rotasRes, produtosRes] = await Promise.all([vQ, rQ, pQ]);

      if (veiculosRes.data) setVeiculos(veiculosRes.data);
      if (rotasRes.data) setRotasDefinidas(rotasRes.data as unknown as RotaDefinida[]);
      if (produtosRes.data) setProdutos(produtosRes.data);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch real cargo when route changes
  const fetchCargaReal = useCallback(async (rotaDefId: string) => {
    if (!entregadorId) return;
    setIsLoadingCarga(true);
    setCargaReal([]);
    setCarregamentoId(null);
    try {
      // Find active carregamento for this entregador + rota
      const { data: carreg } = await supabase
        .from("carregamentos_rota")
        .select("id")
        .eq("entregador_id", entregadorId)
        .eq("status", "em_rota")
        .eq("rota_definida_id", rotaDefId)
        .order("data_saida", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!carreg) {
        // Fallback: any active carregamento for this entregador
        const { data: carregFallback } = await supabase
          .from("carregamentos_rota")
          .select("id")
          .eq("entregador_id", entregadorId)
          .eq("status", "em_rota")
          .order("data_saida", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!carregFallback) {
          setIsLoadingCarga(false);
          return;
        }
        setCarregamentoId(carregFallback.id);
        await loadCargaItens(carregFallback.id);
      } else {
        setCarregamentoId(carreg.id);
        await loadCargaItens(carreg.id);
      }
    } catch (err) {
      console.error("Erro ao buscar carga:", err);
    } finally {
      setIsLoadingCarga(false);
    }
  }, [entregadorId]);

  const loadCargaItens = async (carregId: string) => {
    const { data: itens } = await supabase
      .from("carregamento_rota_itens")
      .select("produto_id, quantidade_saida, quantidade_vendida, quantidade_transferida, produtos:produto_id(nome)")
      .eq("carregamento_id", carregId);

    if (itens) {
      setCargaReal(
        itens.map((item: any) => ({
          produto_id: item.produto_id,
          produto_nome: item.produtos?.nome || "Produto",
          quantidade_saida: item.quantidade_saida || 0,
          quantidade_vendida: item.quantidade_vendida || 0,
          quantidade_transferida: item.quantidade_transferida || 0,
          quantidade_restante: (item.quantidade_saida || 0) - (item.quantidade_vendida || 0) - (item.quantidade_transferida || 0),
        }))
      );
    }
  };

  const veiculoInfo = veiculos.find((v) => v.id === veiculoSelecionado);
  const rotaInfo = rotasDefinidas.find((r) => r.id === rotaSelecionada);

  // When route changes, pre-select cities and fetch cargo
  useEffect(() => {
    if (rotaInfo?.tipo === "atacado" && rotaInfo.cidades) {
      const fixas = (rotaInfo.cidades as CidadeRota[])
        .filter((c) => !c.opcional)
        .map((c) => c.nome);
      setCidadesSelecionadas(fixas);
    } else {
      setCidadesSelecionadas([]);
    }
    // Fetch real cargo for this route
    if (rotaSelecionada) {
      fetchCargaReal(rotaSelecionada);
    } else {
      setCargaReal([]);
      setCarregamentoId(null);
    }
  }, [rotaSelecionada]);

  const cidadesRota = useMemo(() => {
    if (!rotaInfo?.cidades || rotaInfo.tipo !== "atacado") return [];
    return [...(rotaInfo.cidades as CidadeRota[])].sort((a, b) => a.km - b.km);
  }, [rotaInfo]);

  const toggleCidade = (nome: string) => {
    setCidadesSelecionadas((prev) =>
      prev.includes(nome) ? prev.filter((c) => c !== nome) : [...prev, nome]
    );
  };

  const handleIniciarJornada = async () => {
    if (!entregadorId) {
      toast({ title: "Erro", description: "Você não está cadastrado como entregador.", variant: "destructive" });
      return;
    }
    if (!veiculoSelecionado) {
      toast({ title: "Atenção", description: "Selecione um veículo.", variant: "destructive" });
      return;
    }
    if (!kmInicial || parseInt(kmInicial) < 0) {
      toast({ title: "Atenção", description: "Informe a quilometragem inicial.", variant: "destructive" });
      return;
    }

    setIsIniciando(true);
    try {
      // Build observacoes with route/cargo/cities info
      const obsPayload: Record<string, any> = {};
      if (rotaSelecionada) obsPayload.rota_definida_id = rotaSelecionada;
      if (carregamentoId) obsPayload.carregamento_id = carregamentoId;
      if (rotaInfo?.tipo === "atacado" && cidadesSelecionadas.length > 0) {
        obsPayload.cidades_selecionadas = cidadesSelecionadas;
      }
      const obsData = Object.keys(obsPayload).length > 0 ? JSON.stringify(obsPayload) : null;

      // Create route record
      const { error: rotaError } = await supabase.from("rotas").insert({
        entregador_id: entregadorId,
        veiculo_id: veiculoSelecionado,
        km_inicial: parseInt(kmInicial),
        status: "em_andamento",
        observacoes: obsData,
      } as any);

      if (rotaError) throw rotaError;

      // Update entregador status
      await supabase
        .from("entregadores")
        .update({ status: "em_rota" })
        .eq("id", entregadorId);

      // Update escala if exists
      if (escalaHoje) {
        await supabase
          .from("escalas_entregador")
          .update({ status: "ativo" })
          .eq("id", escalaHoje.id);
      }

      toast({
        title: "Jornada iniciada! 🚀",
        description: `Veículo ${veiculoInfo?.placa} - KM: ${parseInt(kmInicial).toLocaleString("pt-BR")}`,
      });

      navigate("/entregador/entregas");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsIniciando(false);
    }
  };

  if (isLoading) {
    return (
      <EntregadorLayout title="Iniciar Jornada">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </EntregadorLayout>
    );
  }

  if (!entregadorId) {
    return (
      <EntregadorLayout title="Iniciar Jornada">
        <div className="p-4 space-y-4">
          <Card className="border-none shadow-md bg-destructive/5 border-l-4 border-l-destructive">
            <CardContent className="p-6 text-center space-y-3">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">Cadastro não encontrado</h2>
              <p className="text-muted-foreground">
                Sua conta não está vinculada a um cadastro de entregador. Contate o administrador.
              </p>
            </CardContent>
          </Card>
        </div>
      </EntregadorLayout>
    );
  }

  const handleEncerrarJornada = async () => {
    if (!entregadorId || !rotaAtivaId) return;
    if (!kmFinal || parseInt(kmFinal) < 0) {
      toast({ title: "Atenção", description: "Informe a quilometragem final.", variant: "destructive" });
      return;
    }
    if (rotaAtivaKmInicial !== null && parseInt(kmFinal) < rotaAtivaKmInicial) {
      toast({ title: "Atenção", description: "KM final não pode ser menor que o KM inicial.", variant: "destructive" });
      return;
    }

    setIsEncerrando(true);
    try {
      await supabase.from("rotas").update({
        status: "finalizada",
        km_final: parseInt(kmFinal),
        data_fim: new Date().toISOString(),
      }).eq("id", rotaAtivaId);

      await supabase.from("entregadores").update({ status: "indisponivel" }).eq("id", entregadorId);

      if (escalaHoje) {
        await supabase.from("escalas_entregador").update({ status: "finalizado" }).eq("id", escalaHoje.id);
      }

      toast({
        title: "Jornada encerrada! 🏁",
        description: `KM Final: ${parseInt(kmFinal).toLocaleString("pt-BR")} - Status: Não Disponível`,
      });
      navigate("/entregador");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsEncerrando(false);
    }
  };

  if (rotaAtiva) {
    return (
      <EntregadorLayout title="Jornada">
        <div className="p-4 space-y-4">
          <Card className="border-none shadow-md bg-success/5 border-l-4 border-l-success">
            <CardContent className="p-6 text-center space-y-3">
              <CheckCircle className="h-12 w-12 text-success mx-auto" />
              <h2 className="text-xl font-bold">Jornada em andamento</h2>
              <p className="text-muted-foreground">Você possui uma rota ativa.</p>
              {rotaAtivaKmInicial !== null && (
                <Badge variant="outline">KM Inicial: {rotaAtivaKmInicial.toLocaleString("pt-BR")}</Badge>
              )}
          <Button onClick={() => navigate("/entregador/entregas")} className="w-full">
                Ver Entregas
              </Button>
            </CardContent>
          </Card>

          {/* Maquininha - disponível também durante jornada ativa */}
          <TerminalQRScanner
            entregadorId={entregadorId!}
            terminalFixoNome={terminalFixoNome}
            terminalAtivoNome={terminalAtivoNome}
            onTerminalVinculado={fetchData}
          />

          {/* Encerrar Jornada */}
          <Card className="border-none shadow-md border-l-4 border-l-destructive">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Encerrar Jornada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm">Quilometragem Final</Label>
                <Input
                  type="number"
                  placeholder="Ex: 45350"
                  value={kmFinal}
                  onChange={(e) => setKmFinal(e.target.value)}
                  min={rotaAtivaKmInicial ?? 0}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Informe a quilometragem atual do hodômetro
                </p>
              </div>
              <Button
                onClick={handleEncerrarJornada}
                disabled={isEncerrando || !kmFinal}
                variant="destructive"
                className="w-full h-12"
              >
                {isEncerrando ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <AlertCircle className="h-5 w-5 mr-2" />
                )}
                Encerrar Jornada - Ficar Indisponível
              </Button>
            </CardContent>
          </Card>
        </div>
      </EntregadorLayout>
    );
  }

  return (
    <EntregadorLayout title="Iniciar Jornada">
      <div className="p-4 space-y-4 pb-24">
        {/* Header */}
        <div className="gradient-primary rounded-2xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <PlayCircle className="h-8 w-8" />
            <div>
              <h2 className="text-lg font-bold">Iniciar Jornada de Trabalho</h2>
              <p className="text-sm text-white/80">Preencha os dados para começar</p>
            </div>
          </div>
        </div>

        {/* Escala de hoje */}
        {escalaHoje ? (
          <Card className="border-none shadow-md border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Sua Escala de Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {escalaHoje.turno_inicio.slice(0, 5)} - {escalaHoje.turno_fim.slice(0, 5)}
                  </span>
                </div>
                {escalaHoje.rotas_definidas && (
                  <Badge variant="secondary">
                    <MapPin className="h-3 w-3 mr-1" />
                    {escalaHoje.rotas_definidas.nome}
                  </Badge>
                )}
              </div>
              {escalaHoje.rotas_definidas?.bairros && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(escalaHoje.rotas_definidas.bairros as string[]).map((b) => (
                    <Badge key={b} variant="outline" className="text-xs">{b}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-md bg-warning/5 border-l-4 border-l-warning">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-warning" />
              <p className="text-sm text-muted-foreground">
                Nenhuma escala definida para hoje. Selecione uma rota manualmente.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Veículo */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              1. Selecionar Veículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={veiculoSelecionado} onValueChange={setVeiculoSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o veículo" />
              </SelectTrigger>
              <SelectContent>
                {veiculos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.placa} - {v.modelo} {v.marca ? `(${v.marca})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {veiculoInfo && (
              <div className="flex items-center gap-2 p-2 bg-success/5 rounded-lg">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-sm">{veiculoInfo.placa} - {veiculoInfo.modelo}</span>
                {veiculoInfo.km_atual != null && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    KM atual: {veiculoInfo.km_atual.toLocaleString("pt-BR")}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* KM Inicial */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              2. Quilometragem Inicial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              placeholder="Ex: 45230"
              value={kmInicial}
              onChange={(e) => setKmInicial(e.target.value)}
              min={0}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Informe a quilometragem atual do hodômetro
            </p>
          </CardContent>
        </Card>

        {/* Maquininha */}
        <TerminalQRScanner
          entregadorId={entregadorId!}
          terminalFixoNome={terminalFixoNome}
          terminalAtivoNome={terminalAtivoNome}
          onTerminalVinculado={fetchData}
        />

        {/* Rota */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              3. Rota de Trabalho
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={rotaSelecionada} onValueChange={setRotaSelecionada}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a rota" />
              </SelectTrigger>
              <SelectContent>
                {rotasDefinidas.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rotaInfo && (
              <div className="p-3 bg-primary/5 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{rotaInfo.nome}</p>
                  {rotaInfo.tipo === "atacado" && (
                    <Badge className="text-xs bg-warning/10 text-warning border-warning/30">Atacado</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(rotaInfo.bairros as string[]).map((b) => (
                    <Badge key={b} variant="outline" className="text-xs">{b}</Badge>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {rotaInfo.distancia_km && (
                    <span>{rotaInfo.distancia_km} km</span>
                  )}
                  {rotaInfo.tempo_estimado && (
                    <span>{rotaInfo.tempo_estimado}</span>
                  )}
                </div>
              </div>
            )}

            {/* City selection for atacado routes */}
            {rotaInfo?.tipo === "atacado" && cidadesRota.length > 0 && (
              <div className="p-3 border rounded-lg space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Cidades da rota
                </p>
                <p className="text-xs text-muted-foreground">
                  Selecione as cidades que você irá percorrer hoje
                </p>
                <div className="space-y-1.5 mt-2">
                  {cidadesRota.map((cidade) => {
                    const isFixed = !cidade.opcional;
                    const isChecked = cidadesSelecionadas.includes(cidade.nome);
                    return (
                      <div
                        key={cidade.nome}
                        className={`flex items-center gap-3 p-2 rounded-lg ${
                          isChecked ? "bg-primary/5" : "bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={isFixed}
                          onCheckedChange={() => toggleCidade(cidade.nome)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{cidade.nome}</span>
                            {cidade.opcional && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-dashed">
                                Opcional
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {cidade.km} km
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estoque / Carga - espelho real do carregamento */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              4. Estoque / Carga
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!rotaSelecionada ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Selecione uma rota para ver a carga disponível.
              </p>
            ) : isLoadingCarga ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando carga...</span>
              </div>
            ) : cargaReal.length === 0 ? (
              <div className="text-center py-4">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma carga iniciada para esta rota.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  O gestor precisa criar um carregamento no ERP.
                </p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-primary">{cargaReal.reduce((a, i) => a + i.quantidade_saida, 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Carregado</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-warning">{cargaReal.reduce((a, i) => a + i.quantidade_vendida, 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Vendido</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-info">{cargaReal.reduce((a, i) => a + i.quantidade_transferida, 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Transf.</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold text-success">{cargaReal.reduce((a, i) => a + i.quantidade_restante, 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Restante</p>
                  </div>
                </div>
                {/* Item list */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {cargaReal.map((item) => (
                    <div key={item.produto_id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.produto_nome}</p>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">Saída: {item.quantidade_saida}</span>
                          <span className="text-xs text-warning">Vend: {item.quantidade_vendida}</span>
                          {item.quantidade_transferida > 0 && (
                            <span className="text-xs text-info">Transf: {item.quantidade_transferida}</span>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={
                          item.quantidade_restante <= 0
                            ? "bg-destructive text-destructive-foreground"
                            : item.quantidade_restante <= 2
                            ? "bg-warning text-white"
                            : "bg-success text-white"
                        }
                      >
                        {item.quantidade_restante}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Botão Iniciar */}
        <Button
          onClick={handleIniciarJornada}
          disabled={isIniciando || !veiculoSelecionado || !kmInicial}
          className="w-full h-14 text-lg gradient-primary text-white shadow-lg"
          size="lg"
        >
          {isIniciando ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <PlayCircle className="h-5 w-5 mr-2" />
          )}
          Iniciar Jornada
        </Button>
      </div>
    </EntregadorLayout>
  );
}
