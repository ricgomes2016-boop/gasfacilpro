import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MapPin, Plus, Pencil, Trash2, Loader2, Truck, ArrowLeftRight, CheckCircle, Printer, ArrowRightLeft, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CadastrarCarregamentoModal } from "@/components/operacional/CadastrarCarregamentoModal";
import { EditarCarregamentoModal } from "@/components/operacional/EditarCarregamentoModal";
import { atualizarEstoqueVenda } from "@/services/estoqueService";
import { format } from "date-fns";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useNavigate } from "react-router-dom";
import { haversineDistance } from "@/lib/haversine";
import { geocodeAddress } from "@/lib/geocoding";
import { RotaAtacadoMapPicker } from "@/components/operacional/RotaAtacadoMapPicker";

interface CidadeRota {
  nome: string;
  lat: number;
  lng: number;
  km: number;
  opcional?: boolean;
}

interface RotaDefinida {
  id: string;
  nome: string;
  bairros: string[];
  distancia_km: number | null;
  tempo_estimado: string | null;
  ativo: boolean;
  tipo: string;
  cidades: CidadeRota[];
}

interface Carregamento {
  id: string;
  entregador_id: string;
  entregador_nome: string;
  rota_nome: string | null;
  unidade_nome: string | null;
  unidade_id: string | null;
  data_saida: string;
  data_retorno: string | null;
  status: string;
  itens: CarregamentoItem[];
  // Financeiro
  receita: number;
  custo_produto: number;
  despesa_rota: number;
  margem: number;
  margem_pct: number;
}

interface CarregamentoItem {
  id: string;
  produto_id: string;
  produto_nome: string;
  preco_custo: number;
  quantidade_saida: number;
  quantidade_retorno: number | null;
  quantidade_vendida: number | null;
  quantidade_transferida: number | null;
}

export default function GestaoRotas() {
  const [rotas, setRotas] = useState<RotaDefinida[]>([]);
  const [carregamentos, setCarregamentos] = useState<Carregamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCarreg, setIsLoadingCarreg] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [carregModalOpen, setCarregModalOpen] = useState(false);
  const [retornoModalOpen, setRetornoModalOpen] = useState(false);
  const [editingRota, setEditingRota] = useState<RotaDefinida | null>(null);
  const [selectedCarreg, setSelectedCarreg] = useState<Carregamento | null>(null);
  const [editingCarreg, setEditingCarreg] = useState<Carregamento | null>(null);
  const [editCarregModalOpen, setEditCarregModalOpen] = useState(false);
  const [retornoItens, setRetornoItens] = useState<{ id: string; qtd_retorno: number }[]>([]);

  // Form fields
  const [nome, setNome] = useState("");
  const [bairrosText, setBairrosText] = useState("");
  const [distanciaKm, setDistanciaKm] = useState("");
  const [tempoEstimado, setTempoEstimado] = useState("");
  const [tipoRota, setTipoRota] = useState<"cidade" | "atacado">("cidade");
  const [cidadesRota, setCidadesRota] = useState<CidadeRota[]>([]);
  const [cidadeInput, setCidadeInput] = useState("");
  const [isGeocodingCidade, setIsGeocodingCidade] = useState(false);

  // Filters
  const [filtroEntregador, setFiltroEntregador] = useState("all");
  const [filtroProduto, setFiltroProduto] = useState("all");
  const [filtroDataInicio, setFiltroDataInicio] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [filtroDataFim, setFiltroDataFim] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [entregadoresList, setEntregadoresList] = useState<{ id: string; nome: string }[]>([]);
  const [produtosList, setProdutosList] = useState<{ id: string; nome: string }[]>([]);

  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRotas();
    fetchCarregamentos();
    fetchFilters();
  }, [unidadeAtual?.id]);


  const fetchFilters = async () => {
    let entQuery = supabase.from("entregadores").select("id, nome").eq("ativo", true).order("nome");
    let prodQuery = supabase.from("produtos").select("id, nome").eq("ativo", true).order("nome");
    if (unidadeAtual?.id) {
      entQuery = entQuery.eq("unidade_id", unidadeAtual.id);
      prodQuery = prodQuery.eq("unidade_id", unidadeAtual.id);
    }
    const [entRes, prodRes] = await Promise.all([entQuery, prodQuery]);
    if (entRes.data) setEntregadoresList(entRes.data);
    if (prodRes.data) setProdutosList(prodRes.data);
  };

  const fetchRotas = async () => {
    setIsLoading(true);
    const { data } = await supabase.from("rotas_definidas").select("*").order("nome");
    if (data) setRotas(data as unknown as RotaDefinida[]);
    setIsLoading(false);
  };

  const fetchCarregamentos = async () => {
    setIsLoadingCarreg(true);
    const { data } = await supabase
      .from("carregamentos_rota")
      .select("*, entregadores(nome), rotas_definidas(nome), unidades(nome)")
      .gte("data_saida", `${filtroDataInicio}T00:00:00-03:00`)
      .lte("data_saida", `${filtroDataFim}T23:59:59-03:00`)
      .order("data_saida", { ascending: false }) as any;

    if (data) {
      const carregs: Carregamento[] = [];
      for (const c of data) {
        const { data: itensData } = await supabase
          .from("carregamento_rota_itens")
          .select("*, produtos(nome, preco_custo)")
          .eq("carregamento_id", c.id) as any;

        const itens: CarregamentoItem[] = (itensData || []).map((i: any) => ({
          id: i.id,
          produto_id: i.produto_id,
          produto_nome: i.produtos?.nome || "—",
          preco_custo: Number(i.produtos?.preco_custo || 0),
          quantidade_saida: i.quantidade_saida,
          quantidade_retorno: i.quantidade_retorno,
          quantidade_vendida: i.quantidade_vendida,
          quantidade_transferida: i.quantidade_transferida,
        }));

        // Financeiro por carregamento
        const dtIni = c.data_saida;
        const dtFim = c.data_retorno || new Date().toISOString();
        const [{ data: pedidosEnt }, { data: abast }, { data: cpEnt }] = await Promise.all([
          supabase.from("pedidos")
            .select("valor_total")
            .eq("entregador_id", c.entregador_id)
            .eq("status", "entregue")
            .gte("created_at", dtIni)
            .lte("created_at", dtFim),
          supabase.from("abastecimentos")
            .select("valor")
            .eq("entregador_id", c.entregador_id)
            .gte("data", dtIni.slice(0, 10))
            .lte("data", dtFim.slice(0, 10)),
          supabase.from("contas_pagar")
            .select("valor, categoria")
            .ilike("categoria", "%rota%")
            .gte("vencimento", dtIni.slice(0, 10))
            .lte("vencimento", dtFim.slice(0, 10)),
        ]);

        const receita = (pedidosEnt || []).reduce((s: number, p: any) => s + Number(p.valor_total || 0), 0);
        const custo_produto = itens.reduce((s, i) => s + (Number(i.quantidade_vendida || 0) * i.preco_custo), 0);
        const despesa_rota = (abast || []).reduce((s: number, a: any) => s + Number(a.valor || 0), 0)
          + (cpEnt || []).reduce((s: number, x: any) => s + Number(x.valor || 0), 0);
        const margem = receita - custo_produto - despesa_rota;
        const margem_pct = receita > 0 ? (margem / receita) * 100 : 0;

        carregs.push({
          id: c.id,
          entregador_id: c.entregador_id,
          entregador_nome: c.entregadores?.nome || "—",
          rota_nome: c.rotas_definidas?.nome || null,
          unidade_nome: c.unidades?.nome || null,
          unidade_id: c.unidade_id || null,
          data_saida: c.data_saida,
          data_retorno: c.data_retorno,
          status: c.status,
          itens,
          receita,
          custo_produto,
          despesa_rota,
          margem,
          margem_pct,
        });
      }
      setCarregamentos(carregs);
    }
    setIsLoadingCarreg(false);
  };

  const openNew = () => {
    setEditingRota(null);
    setNome(""); setBairrosText(""); setDistanciaKm(""); setTempoEstimado("");
    setTipoRota("cidade");
    setCidadesRota([]);
    setCidadeInput("");
    setModalOpen(true);
  };

  const openEdit = (rota: RotaDefinida) => {
    setEditingRota(rota);
    setNome(rota.nome);
    setBairrosText((rota.bairros || []).join(", "));
    setDistanciaKm(rota.distancia_km?.toString() || "");
    setTempoEstimado(rota.tempo_estimado || "");
    setTipoRota((rota.tipo as "cidade" | "atacado") || "cidade");
    setCidadesRota(rota.cidades || []);
    setCidadeInput("");
    setModalOpen(true);
  };

  const handleAddCidade = useCallback(async () => {
    const cidadeNome = cidadeInput.trim();
    if (!cidadeNome) return;
    setIsGeocodingCidade(true);
    try {
      const result = await geocodeAddress(cidadeNome + ", Brasil");
      if (!result) {
        toast({ title: "Cidade não encontrada", description: "Tente outro nome ou mais detalhes.", variant: "destructive" });
        setIsGeocodingCidade(false);
        return;
      }
      const newCidade: CidadeRota = {
        nome: result.cidade || cidadeNome,
        lat: result.latitude,
        lng: result.longitude,
        km: 0,
      };
      setCidadesRota((prev) => {
        const updated = [...prev, newCidade];
        // Recalculate KMs
        return recalcKm(updated);
      });
      setCidadeInput("");
    } catch {
      toast({ title: "Erro ao geocodificar", variant: "destructive" });
    }
    setIsGeocodingCidade(false);
  }, [cidadeInput, toast]);

  const recalcKm = (cidades: CidadeRota[]): CidadeRota[] => {
    return cidades.map((c, i) => {
      if (i === 0) return { ...c, km: 0 };
      const prev = cidades[i - 1];
      const dist = haversineDistance(prev.lat, prev.lng, c.lat, c.lng) * 1.3;
      return { ...c, km: Math.round(dist * 10) / 10 };
    });
  };

  const removeCidade = (index: number) => {
    setCidadesRota((prev) => recalcKm(prev.filter((_, i) => i !== index)));
  };

  const totalKmAtacado = cidadesRota.length > 0 ? Math.max(...cidadesRota.map(c => c.km)) : 0;

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: "Informe o nome da rota", variant: "destructive" });
      return;
    }
    const bairros = tipoRota === "cidade"
      ? bairrosText.split(",").map((b) => b.trim()).filter(Boolean)
      : [];
    const payload: any = {
      nome: nome.trim(),
      bairros,
      distancia_km: tipoRota === "atacado" ? Math.round(totalKmAtacado * 10) / 10 : (distanciaKm ? parseFloat(distanciaKm) : null),
      tempo_estimado: tempoEstimado || null,
      tipo: tipoRota,
      cidades: tipoRota === "atacado" ? cidadesRota : [],
      ...(editingRota ? {} : { unidade_id: unidadeAtual?.id || null }),
    };

    if (editingRota) {
      const { error } = await supabase.from("rotas_definidas").update(payload).eq("id", editingRota.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Rota atualizada!" });
    } else {
      const { error } = await supabase.from("rotas_definidas").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Rota criada!" });
    }
    setModalOpen(false);
    fetchRotas();
  };

  const toggleAtivo = async (rota: RotaDefinida) => {
    await supabase.from("rotas_definidas").update({ ativo: !rota.ativo }).eq("id", rota.id);
    fetchRotas();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("rotas_definidas").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rota excluída!" });
      fetchRotas();
    }
  };

  const openRetorno = (carreg: Carregamento) => {
    setSelectedCarreg(carreg);
    setRetornoItens(carreg.itens.map((i) => ({ id: i.id, qtd_retorno: 0 })));
    setRetornoModalOpen(true);
  };

  const handleRetorno = async () => {
    if (!selectedCarreg) return;
    try {
      const itensVendidos: { produto_id: string; quantidade: number }[] = [];

      for (const ri of retornoItens) {
        const item = selectedCarreg.itens.find((i) => i.id === ri.id);
        const vendido = (item?.quantidade_saida || 0) - ri.qtd_retorno;

        const { data: itemData } = await supabase
          .from("carregamento_rota_itens")
          .select("produto_id")
          .eq("id", ri.id)
          .single();

        await supabase
          .from("carregamento_rota_itens")
          .update({
            quantidade_retorno: ri.qtd_retorno,
            quantidade_vendida: vendido,
          } as any)
          .eq("id", ri.id);

        if (vendido > 0 && itemData) {
          itensVendidos.push({ produto_id: itemData.produto_id, quantidade: vendido });
        }
      }

      const { data: carregData } = await supabase
        .from("carregamentos_rota")
        .select("unidade_id")
        .eq("id", selectedCarreg.id)
        .single();

      if (itensVendidos.length > 0) {
        await atualizarEstoqueVenda(itensVendidos, carregData?.unidade_id);
      }

      await supabase
        .from("carregamentos_rota")
        .update({ status: "finalizado", data_retorno: new Date().toISOString() } as any)
        .eq("id", selectedCarreg.id);

      toast({ title: "Retorno registrado e estoque atualizado!" });
      setRetornoModalOpen(false);
      fetchCarregamentos();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const filteredCarregamentos = carregamentos.filter((c) => {
    if (filtroEntregador !== "all" && c.entregador_id !== filtroEntregador) return false;
    if (filtroProduto !== "all" && !c.itens.some((i) => i.produto_nome.toLowerCase().includes(filtroProduto.toLowerCase()))) return false;
    return true;
  });

  const resumo = filteredCarregamentos.reduce(
    (acc, c) => {
      c.itens.forEach((i) => {
        acc.totalSaida += i.quantidade_saida;
        acc.totalVendido += i.quantidade_vendida || 0;
        acc.totalRetorno += i.quantidade_retorno || 0;
        acc.totalTransferido += i.quantidade_transferida || 0;
      });
      if (c.status === "em_rota") acc.emRota++;
      if (c.status === "finalizado") acc.finalizados++;
      return acc;
    },
    { totalSaida: 0, totalVendido: 0, totalRetorno: 0, totalTransferido: 0, emRota: 0, finalizados: 0 }
  );

  const handlePrintManifesto = (carreg: Carregamento) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const _esc = (v: unknown) => v === null || v === undefined ? "" : String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const html = `
      <html><head><title>Manifesto - ${_esc(carreg.entregador_nome)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h2 { margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; }
        th { background: #f0f0f0; }
        .info { margin: 4px 0; font-size: 14px; }
        .signature { margin-top: 60px; display: flex; gap: 60px; }
        .signature div { border-top: 1px solid #333; padding-top: 5px; width: 200px; text-align: center; font-size: 13px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h2>Manifesto de Carregamento</h2>
      <p class="info"><strong>Entregador:</strong> ${_esc(carreg.entregador_nome)}</p>
      <p class="info"><strong>Loja:</strong> ${_esc(carreg.unidade_nome || "—")}</p>
      <p class="info"><strong>Rota:</strong> ${_esc(carreg.rota_nome || "—")}</p>
      <p class="info"><strong>Data Saída:</strong> ${_esc(format(new Date(carreg.data_saida), "dd/MM/yyyy HH:mm"))}</p>
      <table>
        <thead><tr><th>#</th><th>Produto</th><th>Qtd. Saída</th><th>Qtd. Retorno</th><th>Qtd. Vendida</th></tr></thead>
        <tbody>
          ${carreg.itens.map((i, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${_esc(i.produto_nome)}</td>
              <td>${i.quantidade_saida}</td>
              <td>${i.quantidade_retorno ?? "—"}</td>
              <td>${i.quantidade_vendida ?? "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="signature">
        <div>Responsável</div>
        <div>Entregador</div>
      </div>
      <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <MainLayout>
      <Header title="Gestão de Rotas" subtitle="Rotas de entrega e carregamentos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <Tabs defaultValue="rotas">
          <TabsList>
            <TabsTrigger value="rotas">
              <MapPin className="h-4 w-4 mr-2" />
              Rotas de Entrega
            </TabsTrigger>
            <TabsTrigger value="carregamentos">
              <Truck className="h-4 w-4 mr-2" />
              Carregamentos
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB: ROTAS DE ENTREGA ===== */}
          <TabsContent value="rotas" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Rota
              </Button>
            </div>

            <Card className="modern-panel">
              <CardContent className="p-0 md:p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Bairros / Cidades</TableHead>
                        <TableHead>Distância</TableHead>
                        <TableHead>Tempo Est.</TableHead>
                        <TableHead>Ativa</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rotas.map((rota) => (
                        <TableRow key={rota.id}>
                          <TableCell className="font-medium">{rota.nome}</TableCell>
                          <TableCell>
                            <Badge variant={rota.tipo === "atacado" ? "warning" : "default"}>
                              {rota.tipo === "atacado" ? "Atacado" : "Cidade"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {rota.tipo === "atacado" && rota.cidades?.length > 0
                                ? rota.cidades.map((c, i) => (
                                    <Badge key={i} variant="outline" className="border-primary/25 bg-primary/10 text-xs text-primary">
                                      <span className="mr-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{i + 1}</span>
                                      {c.nome} {c.km > 0 && `(${c.km} km)`}
                                    </Badge>
                                  ))
                                : (rota.bairros || []).map((b) => (
                                    <Badge key={b} variant="outline" className="border-secondary/25 bg-secondary/10 text-xs text-secondary">{b}</Badge>
                                  ))
                              }
                            </div>
                          </TableCell>
                          <TableCell>{rota.distancia_km ? `${rota.distancia_km} km` : "—"}</TableCell>
                          <TableCell>{rota.tempo_estimado || "—"}</TableCell>
                          <TableCell>
                            <Switch checked={rota.ativo} onCheckedChange={() => toggleAtivo(rota)} />
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(rota)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(rota.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {rotas.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Nenhuma rota cadastrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TAB: CARREGAMENTOS ===== */}
          <TabsContent value="carregamentos" className="space-y-4 mt-4">
            {/* Filtros */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Data (Início)</Label>
                    <Input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className="w-36" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data (Fim)</Label>
                    <Input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} className="w-36" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Entregador</Label>
                    <Select value={filtroEntregador} onValueChange={setFiltroEntregador}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {entregadoresList.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Produto</Label>
                    <Select value={filtroProduto} onValueChange={setFiltroProduto}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {produtosList.map((p) => (
                          <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => setCarregModalOpen(true)}>
                    <Truck className="h-4 w-4 mr-2" />
                    Cadastrar Carregamento
                  </Button>
                  <Button variant="secondary" onClick={() => navigate("/estoque/transferencia")}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Transferência
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Saída</p>
                  <p className="text-2xl font-bold text-primary">{resumo.totalSaida}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Transferido</p>
                  <p className="text-2xl font-bold text-warning">{resumo.totalTransferido}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground font-medium">Saldo Líquido</p>
                  <p className="text-2xl font-bold text-primary">{resumo.totalSaida - resumo.totalTransferido}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Vendido</p>
                  <p className="text-2xl font-bold text-success">{resumo.totalVendido}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Retorno</p>
                  <p className="text-2xl font-bold text-warning">{resumo.totalRetorno}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Em Rota</p>
                  <p className="text-2xl font-bold">{resumo.emRota}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Finalizados</p>
                  <p className="text-2xl font-bold">{resumo.finalizados}</p>
                </CardContent>
              </Card>
            </div>

            {/* Lista de carregamentos */}
            <Card>
              <CardContent className="p-0">
                {isLoadingCarreg ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Loja</TableHead>
                          <TableHead>Entregador</TableHead>
                          <TableHead>Rota</TableHead>
                          <TableHead>Saída</TableHead>
                          <TableHead>Produtos</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                          <TableHead className="text-right">Custo</TableHead>
                          <TableHead className="text-right">Despesas</TableHead>
                          <TableHead className="text-right">Margem</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCarregamentos.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{c.unidade_nome || "—"}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{c.entregador_nome}</TableCell>
                            <TableCell>{c.rota_nome || "—"}</TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(c.data_saida), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {c.itens.map((i) => {
                                  const saldo = (i.quantidade_saida || 0) - (i.quantidade_vendida || 0) - (i.quantidade_transferida || 0);
                                  return (
                                    <Badge key={i.id} variant="outline" className="text-xs">
                                      {i.produto_nome}: <span className="font-bold ml-0.5">{saldo}</span>
                                      <span className="ml-1 text-muted-foreground">({i.quantidade_saida} saída</span>
                                      {(i.quantidade_vendida != null && i.quantidade_vendida > 0) && (
                                        <span className="text-success"> - {i.quantidade_vendida} vend.</span>
                                      )}
                                      {(i.quantidade_transferida != null && i.quantidade_transferida > 0) && (
                                        <span className="text-warning"> - {i.quantidade_transferida} transf.</span>
                                      )}
                                      <span>)</span>
                                    </Badge>
                                  );
                                })}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">R$ {c.receita.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-orange-600">R$ {c.custo_produto.toFixed(2)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-red-600">R$ {c.despesa_rota.toFixed(2)}</TableCell>
                            <TableCell className={`text-right text-sm tabular-nums font-semibold ${c.margem >= 0 ? "text-green-600" : "text-red-600"}`}>
                              R$ {c.margem.toFixed(2)}
                              <div className="text-[10px] text-muted-foreground">{c.margem_pct.toFixed(1)}%</div>
                            </TableCell>
                              {c.status === "em_rota" ? (
                                <Badge variant="default">Em Rota</Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Finalizado
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button size="sm" variant="ghost" onClick={() => handlePrintManifesto(c)} title="Imprimir manifesto">
                                <Printer className="h-4 w-4" />
                              </Button>
                              {c.status === "em_rota" && (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => { setEditingCarreg(c); setEditCarregModalOpen(true); }} title="Editar carregamento">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openRetorno(c)}>
                                    <ArrowLeftRight className="h-4 w-4 mr-1" />
                                    Retorno
                                  </Button>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredCarregamentos.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              Nenhum carregamento encontrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      {/* Modal Nova/Editar Rota */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {editingRota ? "Editar Rota" : "Nova Rota"}
            </DialogTitle>
            <DialogDescription>Defina as informações da rota.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo de Rota *</Label>
              <Select value={tipoRota} onValueChange={(v) => setTipoRota(v as "cidade" | "atacado")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cidade">🏘️ Cidade (bairros)</SelectItem>
                  <SelectItem value="atacado">🚛 Atacado (cidades)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome da Rota *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Rota Centro" />
            </div>

            {tipoRota === "cidade" ? (
              <>
                <div className="space-y-2">
                  <Label>Bairros (separados por vírgula)</Label>
                  <Input value={bairrosText} onChange={(e) => setBairrosText(e.target.value)} placeholder="Centro, Vila Nova, Jardim Europa" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Distância (km)</Label>
                    <Input type="number" value={distanciaKm} onChange={(e) => setDistanciaKm(e.target.value)} placeholder="12" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo estimado</Label>
                    <Input value={tempoEstimado} onChange={(e) => setTempoEstimado(e.target.value)} placeholder="4h" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <RotaAtacadoMapPicker
                  cidades={cidadesRota}
                  onCidadesChange={setCidadesRota}
                  totalKm={totalKmAtacado}
                  origem={unidadeAtual?.latitude && unidadeAtual?.longitude ? {
                    nome: unidadeAtual.cidade || unidadeAtual.nome,
                    lat: unidadeAtual.latitude,
                    lng: unidadeAtual.longitude,
                  } : null}
                  onTempoEstimadoChange={setTempoEstimado}
                />
                <div className="space-y-2">
                  <Label>Tempo estimado</Label>
                  <Input value={tempoEstimado} readOnly className="bg-muted" placeholder="Calculado automaticamente" />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} className="flex-1">Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Carregamento */}
      <EditarCarregamentoModal
        open={editCarregModalOpen}
        onOpenChange={setEditCarregModalOpen}
        carregamento={editingCarreg}
        onSaved={fetchCarregamentos}
      />

      {/* Modal Cadastrar Carregamento */}
      <CadastrarCarregamentoModal
        open={carregModalOpen}
        onOpenChange={setCarregModalOpen}
        onSaved={fetchCarregamentos}
      />

      {/* Modal Retorno */}
      <Dialog open={retornoModalOpen} onOpenChange={setRetornoModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              Registrar Retorno
            </DialogTitle>
            <DialogDescription>
              Informe a quantidade que retornou para calcular a diferença (vendido).
            </DialogDescription>
          </DialogHeader>
          {selectedCarreg && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                Entregador: <strong>{selectedCarreg.entregador_nome}</strong>
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Saiu</TableHead>
                    <TableHead>Retornou</TableHead>
                    <TableHead>Vendido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedCarreg.itens.map((item) => {
                    const ri = retornoItens.find((r) => r.id === item.id);
                    const vendido = item.quantidade_saida - (ri?.qtd_retorno || 0);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">{item.produto_nome}</TableCell>
                        <TableCell>{item.quantidade_saida}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={item.quantidade_saida}
                            value={ri?.qtd_retorno || 0}
                            onChange={(e) => {
                              const val = Math.min(item.quantidade_saida, Math.max(0, parseInt(e.target.value) || 0));
                              setRetornoItens((prev) =>
                                prev.map((r) => (r.id === item.id ? { ...r, qtd_retorno: val } : r))
                              );
                            }}
                            className="w-16 h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={vendido > 0 ? "success" : "outline"}>{vendido}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setRetornoModalOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleRetorno} className="flex-1">Confirmar Retorno</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
