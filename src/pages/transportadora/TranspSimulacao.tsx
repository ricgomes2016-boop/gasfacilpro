import { useState, useMemo, useCallback, useEffect } from "react";
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
import { Calculator, Save, Search, Undo2, Trash2, Loader2, MapPin } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { haversineDistance } from "@/lib/haversine";
import { reverseGeocode, geocodeAddress } from "@/lib/geocoding";
import "leaflet/dist/leaflet.css";

const ROAD_FACTOR = 1.3;
const DEFAULT_CENTER: [number, number] = [-23.1811, -50.6477];

interface Waypoint { lat: number; lng: number; label: string; }

const originIcon = L.divIcon({
  className: "",
  html: `<div style="background:hsl(142 71% 45%);color:#fff;width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25);">A</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
});

function stopIcon(index: number) {
  return L.divIcon({
    className: "",
    html: `<div style="background:hsl(221 83% 53%);color:#fff;width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25);">${index}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  });
}

function calcTotalKm(wps: Waypoint[]) {
  let t = 0;
  for (let i = 1; i < wps.length; i++) t += haversineDistance(wps[i - 1].lat, wps[i - 1].lng, wps[i].lat, wps[i].lng);
  return t * ROAD_FACTOR;
}

function MapClickHandler({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onAdd(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function MapAutoFit({ waypoints }: { waypoints: Waypoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (waypoints.length === 0) return;
    if (waypoints.length === 1) {
      map.flyTo([waypoints[0].lat, waypoints[0].lng], 14, { duration: 0.6 });
    } else {
      const bounds = L.latLngBounds(waypoints.map(w => [w.lat, w.lng] as [number, number]));
      map.flyToBounds(bounds.pad(0.15), { duration: 0.6 });
    }
  }, [map, waypoints.length]);
  return null;
}

export default function TranspSimulacao() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: veiculos = [] } = useQuery({
    queryKey: ["transp-veiculos"],
    queryFn: async () => { const { data } = await (supabase as any).from("transp_veiculos").select("*").eq("ativo", true).order("placa"); return data || []; },
    enabled: !!user,
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["transp-funcionarios"],
    queryFn: async () => { const { data } = await (supabase as any).from("transp_funcionarios").select("*").eq("ativo", true).order("nome"); return data || []; },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-empresa", user?.id],
    queryFn: async () => { const { data } = await supabase.from("profiles").select("empresa_id").eq("user_id", user!.id).single(); return data; },
    enabled: !!user,
  });

  // Route state
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [searchOrigin, setSearchOrigin] = useState("");
  const [searchDest, setSearchDest] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const routeKm = useMemo(() => calcTotalKm(waypoints), [waypoints]);

  const addWaypoint = useCallback(async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const r = await reverseGeocode(lat, lng);
      const label = r?.endereco ? `${r.endereco}${r.bairro ? `, ${r.bairro}` : ""}${r.cidade ? ` - ${r.cidade}` : ""}` : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setWaypoints(prev => [...prev, { lat, lng, label }]);
    } finally { setIsGeocoding(false); }
  }, []);

  const searchAndAdd = useCallback(async (query: string, clearFn: (v: string) => void) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const r = await geocodeAddress(query);
      if (r) {
        const label = r.endereco ? `${r.endereco}${r.bairro ? `, ${r.bairro}` : ""}${r.cidade ? ` - ${r.cidade}` : ""}` : r.displayName;
        setWaypoints(prev => [...prev, { lat: r.latitude, lng: r.longitude, label }]);
        clearFn("");
      } else { toast.error("Endereço não encontrado"); }
    } finally { setIsSearching(false); }
  }, []);

  // Form state
  const [form, setForm] = useState({
    tipo: "abastecimento", veiculo_id: "", motorista_id: "", ajudante_id: "",
    qtd_p13: 0, qtd_p20: 0, qtd_p45: 0, ida_volta: false,
    consumo_km_litro: 5, preco_combustivel_litro: 6.50, custo_pedagio: 0, custo_refeicao: 0,
  });

  const veiculo = veiculos.find((v: any) => v.id === form.veiculo_id);
  const motorista = funcionarios.find((f: any) => f.id === form.motorista_id);
  const ajudante = form.ajudante_id && form.ajudante_id !== "nenhum" ? funcionarios.find((f: any) => f.id === form.ajudante_id) : null;

  const result = useMemo(() => {
    const km = routeKm;
    const p13Equiv = calcP13Equivalente(form.qtd_p13, form.qtd_p20, form.qtd_p45);
    const consumo = form.consumo_km_litro > 0 ? form.consumo_km_litro : 1;
    const custoComb = calcCustoCombustivel(km, consumo, form.preco_combustivel_litro, form.ida_volta);
    const custoMot = motorista ? calcSalarioDiario(motorista.salario_mensal) : 0;
    const custoAjud = ajudante ? calcSalarioDiario(ajudante.salario_mensal) : 0;
    const total = calcCustoTotal({ combustivel: custoComb, pedagio: form.custo_pedagio, refeicao: form.custo_refeicao, motorista: custoMot, ajudante: custoAjud });
    const custoPorP13 = calcCustoPorP13Equiv(total, p13Equiv);
    // Custo por P20 = custoPorP13 * (24/7), por P45 = custoPorP13 * (24/6)
    const custoPorP20 = custoPorP13 * (24 / 7);
    const custoPorP45 = custoPorP13 * 4;
    return { km, p13Equiv, custoComb, custoMot, custoAjud, total, custoPorP13, custoPorP20, custoPorP45 };
  }, [form, motorista, ajudante, routeKm]);

  const salvar = useMutation({
    mutationFn: async () => {
      const origem = waypoints[0]?.label || "N/D";
      const destino = waypoints.length > 1 ? waypoints[waypoints.length - 1].label : "N/D";
      const { error } = await (supabase as any).from("transp_simulacoes").insert({
        empresa_id: profile?.empresa_id, origem, destino,
        tipo: form.tipo, km: result.km, veiculo_id: form.veiculo_id || null,
        motorista_id: form.motorista_id || null,
        ajudante_id: form.ajudante_id && form.ajudante_id !== "nenhum" ? form.ajudante_id : null,
        qtd_p13: form.qtd_p13, qtd_p20: form.qtd_p20, qtd_p45: form.qtd_p45,
        ida_volta: form.ida_volta,
        custo_combustivel: result.custoComb, custo_pedagio: form.custo_pedagio,
        custo_refeicao: form.custo_refeicao, custo_motorista: result.custoMot, custo_ajudante: result.custoAjud,
        custo_total: result.total, custo_p13_equiv: result.custoPorP13,
        preco_combustivel_litro: form.preco_combustivel_litro,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Simulação salva!"); qc.invalidateQueries({ queryKey: ["transp-simulacoes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <TransportadoraLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Simulação de Viagem</h1>
          <p className="text-muted-foreground text-sm">Previsão de custos por rota — clique no mapa ou busque endereços</p>
        </div>

        {/* Search bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex gap-1">
            <Input placeholder="Buscar origem..." value={searchOrigin} onChange={e => setSearchOrigin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchAndAdd(searchOrigin, setSearchOrigin)} className="flex-1" />
            <Button variant="outline" size="icon" onClick={() => searchAndAdd(searchOrigin, setSearchOrigin)} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-1">
            <Input placeholder="Buscar destino / parada..." value={searchDest} onChange={e => setSearchDest(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchAndAdd(searchDest, setSearchDest)} className="flex-1" />
            <Button variant="outline" size="icon" onClick={() => searchAndAdd(searchDest, setSearchDest)} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Route info bar */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>{waypoints.length === 0 ? "Clique no mapa para definir a origem" : `${waypoints.length} ponto(s)`}</span>
          {waypoints.length > 0 && <span className="font-bold text-foreground">{routeKm.toFixed(1)} km</span>}
          {isGeocoding && <Loader2 className="h-3 w-3 animate-spin" />}
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setWaypoints(p => p.slice(0, -1))} disabled={waypoints.length === 0}>
              <Undo2 className="mr-1 h-4 w-4" /> Desfazer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWaypoints([])} disabled={waypoints.length === 0}>
              <Trash2 className="mr-1 h-4 w-4" /> Limpar
            </Button>
          </div>
        </div>

        {/* MAP - directly in page, no dialog */}
        <div className="h-[300px] sm:h-[350px] rounded-lg overflow-hidden border border-border">
          <MapContainer center={DEFAULT_CENTER} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapClickHandler onAdd={(lat, lng) => { void addWaypoint(lat, lng); }} />
            <MapAutoFit waypoints={waypoints} />
            {waypoints.map((w, i) => (
              <Marker key={`${w.lat}-${w.lng}-${i}`} position={[w.lat, w.lng]} icon={i === 0 ? originIcon : stopIcon(i)} />
            ))}
            {waypoints.length >= 2 && (
              <Polyline positions={waypoints.map(w => [w.lat, w.lng] as [number, number])} pathOptions={{ color: "hsl(221, 83%, 53%)", weight: 4, dashArray: "8 6" }} />
            )}
          </MapContainer>
        </div>

        {/* Waypoint list */}
        {waypoints.length > 0 && (
          <div className="max-h-[100px] space-y-1 overflow-y-auto rounded-lg bg-muted/50 p-2 text-xs">
            {waypoints.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`font-bold ${i === 0 ? "text-success" : "text-primary"}`}>{i === 0 ? "A" : i}</span>
                <span className="truncate text-muted-foreground">{w.label}</span>
                {i > 0 && (
                  <span className="ml-auto whitespace-nowrap font-medium text-foreground">
                    +{(haversineDistance(waypoints[i - 1].lat, waypoints[i - 1].lng, w.lat, w.lng) * ROAD_FACTOR).toFixed(1)} km
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Form + Result */}
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="border-border/40">
            <CardHeader className="pb-3"><CardTitle className="text-base">Dados da Viagem</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="abastecimento">Abastecimento</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="venda">Venda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Veículo</Label>
                  <Select value={form.veiculo_id} onValueChange={v => {
                    const vec = veiculos.find((x: any) => x.id === v);
                    setForm(f => ({ ...f, veiculo_id: v, consumo_km_litro: vec?.consumo_km_litro || f.consumo_km_litro }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {veiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa} ({v.tipo})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Motorista</Label>
                  <Select value={form.motorista_id} onValueChange={v => setForm({ ...form, motorista_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {funcionarios.filter((f: any) => f.cargo === "motorista").map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Ajudante</Label>
                  <Select value={form.ajudante_id} onValueChange={v => setForm({ ...form, ajudante_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      {funcionarios.filter((f: any) => f.cargo === "ajudante").map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div><Label>Qtd P13</Label><Input type="number" value={form.qtd_p13} onChange={e => setForm({ ...form, qtd_p13: +e.target.value })} /></div>
                <div><Label>Qtd P20</Label><Input type="number" value={form.qtd_p20} onChange={e => setForm({ ...form, qtd_p20: +e.target.value })} /></div>
                <div><Label>Qtd P45</Label><Input type="number" value={form.qtd_p45} onChange={e => setForm({ ...form, qtd_p45: +e.target.value })} /></div>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={form.ida_volta} onCheckedChange={v => setForm({ ...form, ida_volta: v })} />
                <Label>Ida + Volta</Label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Consumo (km/l)</Label><Input type="number" step="0.1" value={form.consumo_km_litro} onChange={e => setForm({ ...form, consumo_km_litro: +e.target.value })} /></div>
                <div><Label>R$/litro</Label><Input type="number" step="0.01" value={form.preco_combustivel_litro} onChange={e => setForm({ ...form, preco_combustivel_litro: +e.target.value })} /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Pedágio</Label><Input type="number" step="0.01" value={form.custo_pedagio} onChange={e => setForm({ ...form, custo_pedagio: +e.target.value })} /></div>
                <div><Label>Refeição</Label><Input type="number" step="0.01" value={form.custo_refeicao} onChange={e => setForm({ ...form, custo_refeicao: +e.target.value })} /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" />Resultado</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-muted/40 rounded-lg"><p className="text-muted-foreground text-xs">Distância</p><p className="font-bold text-foreground">{result.km.toFixed(1)} km</p></div>
                <div className="p-3 bg-muted/40 rounded-lg"><p className="text-muted-foreground text-xs">Combustível</p><p className="font-bold text-foreground">{formatCurrency(result.custoComb)}</p></div>
                <div className="p-3 bg-muted/40 rounded-lg"><p className="text-muted-foreground text-xs">Pedágio</p><p className="font-bold text-foreground">{formatCurrency(form.custo_pedagio)}</p></div>
                <div className="p-3 bg-muted/40 rounded-lg"><p className="text-muted-foreground text-xs">Refeição</p><p className="font-bold text-foreground">{formatCurrency(form.custo_refeicao)}</p></div>
                <div className="p-3 bg-muted/40 rounded-lg"><p className="text-muted-foreground text-xs">Motorista</p><p className="font-bold text-foreground">{formatCurrency(result.custoMot)}</p></div>
                <div className="p-3 bg-muted/40 rounded-lg"><p className="text-muted-foreground text-xs">Ajudante</p><p className="font-bold text-foreground">{formatCurrency(result.custoAjud)}</p></div>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">P13 Equivalente</span>
                  <span className="font-bold text-foreground">{formatNumber(result.p13Equiv, 0)} un</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Custo Total</span>
                  <span className="text-xl font-bold text-foreground">{formatCurrency(result.total)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Custo / P13</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(result.custoPorP13)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Custo / P20</span>
                  <span className="font-bold text-foreground">{formatCurrency(result.custoPorP20)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Custo / P45</span>
                  <span className="font-bold text-foreground">{formatCurrency(result.custoPorP45)}</span>
                </div>
              </div>

              <Button onClick={() => salvar.mutate()} className="w-full gap-2" disabled={salvar.isPending || waypoints.length < 2}>
                <Save className="h-4 w-4" />Salvar Simulação
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </TransportadoraLayout>
  );
}
