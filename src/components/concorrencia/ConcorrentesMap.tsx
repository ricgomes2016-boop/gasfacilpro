import { useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MapPin, Plus, Search, Trash2, Store, GripVertical, Handshake, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { geocodeAddress, reverseGeocode } from "@/lib/geocoding";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import "leaflet/dist/leaflet.css";

interface Concorrente {
  id: string;
  nome: string;
  endereco: string | null;
  latitude: number;
  longitude: number;
  nivel_ameaca: string;
  produtos_precos: any[];
  observacoes: string | null;
  telefone: string | null;
}

interface Parceiro {
  id: string;
  nome: string;
  telefone: string | null;
  tipo: string;
  latitude: number | null;
  longitude: number | null;
}


interface ClienteRevenda {
  id: string;
  nome: string;
  telefone: string | null;
  latitude: number | null;
  longitude: number | null;
  tipo: string | null;
}

const ameacaCores: Record<string, string> = {
  alto: "#ef4444",
  moderado: "#8b5cf6",
  baixo: "#22c55e",
};

const ameacaLabels: Record<string, string> = {
  alto: "Alto",
  moderado: "Moderado",
  baixo: "Baixo",
};

const PARCEIRO_COR = "#0ea5e9";
const REVENDA_COR = "#8b5cf6";

function createIcon(color: string, isOwn = false) {
  const svg = isOwn
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15" r="7" fill="#fff"/><text x="16" y="19" text-anchor="middle" font-size="12" font-weight="bold" fill="${color}">★</text></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="13" r="5" fill="#fff" opacity="0.9"/></svg>`;
  return L.divIcon({
    html: svg,
    iconSize: isOwn ? [32, 40] : [28, 36],
    iconAnchor: isOwn ? [16, 40] : [14, 36],
    popupAnchor: [0, isOwn ? -42 : -38],
    className: "",
  });
}

function createParceiroIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38"><path d="M15 0C6.7 0 0 6.7 0 15c0 11.3 15 23 15 23s15-11.7 15-23C30 6.7 23.3 0 15 0z" fill="${PARCEIRO_COR}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14" r="6" fill="#fff" opacity="0.95"/><text x="15" y="18" text-anchor="middle" font-size="11" font-weight="bold" fill="${PARCEIRO_COR}">R</text></svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -40],
    className: "",
  });
}

function createRevendaClienteIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.3 21.7 0 14 0z" fill="${REVENDA_COR}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="13" r="5" fill="#fff" opacity="0.95"/><text x="14" y="17" text-anchor="middle" font-size="9" font-weight="bold" fill="${REVENDA_COR}">C</text></svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
    className: "",
  });
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function ConcorrentesMap() {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const empresaId = empresa?.id;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [parceiroDialogOpen, setParceiroDialogOpen] = useState(false);
  const [clickedLat, setClickedLat] = useState<number | null>(null);
  const [clickedLng, setClickedLng] = useState<number | null>(null);
  const [searchAddress, setSearchAddress] = useState("");
  const [searching, setSearching] = useState(false);
  const [mostrarParceiros, setMostrarParceiros] = useState(true);
  const [mostrarRevendas, setMostrarRevendas] = useState(true);
  const [modoParceiro, setModoParceiro] = useState(false);
  const [parceiroSelecionadoId, setParceiroSelecionadoId] = useState<string>("");

  // Form fields
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [nivelAmeaca, setNivelAmeaca] = useState("moderado");
  const [observacoes, setObservacoes] = useState("");
  const [telefone, setTelefone] = useState("");

  // Unidade location for center
  const unidadeLat = unidadeAtual?.latitude || -23.31;
  const unidadeLng = unidadeAtual?.longitude || -51.16;
  const unidadeId = unidadeAtual?.id;
  const unidadeCidade = unidadeAtual?.cidade;

  // Query sibling units (same city, same empresa)
  const { data: siblingUnidades = [] } = useQuery({
    queryKey: ["sibling-unidades", empresaId, unidadeCidade, unidadeId],
    queryFn: async () => {
      if (!unidadeCidade) return [];
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome, latitude, longitude, tipo, cidade")
        .eq("empresa_id", empresaId!)
        .eq("cidade", unidadeCidade)
        .eq("ativo", true)
        .neq("id", unidadeId!);
      if (error) throw error;
      return (data || []).filter((u) => u.latitude && u.longitude);
    },
    enabled: !!empresaId && !!unidadeCidade && !!unidadeId,
  });

  // Mutation to update unit coordinates
  const updateUnitCoords = useMutation({
    mutationFn: async ({ id, lat, lng }: { id: string; lat: number; lng: number }) => {
      const { error } = await supabase
        .from("unidades")
        .update({ latitude: lat, longitude: lng })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sibling-unidades"] });
      toast.success("Localização da unidade atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar localização"),
  });

  const { data: concorrentes = [] } = useQuery({
    queryKey: ["concorrentes", empresaId, unidadeId],
    queryFn: async () => {
      let query = supabase
        .from("concorrentes")
        .select("*")
        .order("nome");
      if (unidadeId) {
        query = query.eq("unidade_id", unidadeId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Concorrente[];
    },
    enabled: !!empresaId,
  });

  // Query parceiros (filter by unidade_id, include those without unidade)
  const { data: parceiros = [] } = useQuery({
    queryKey: ["parceiros-mapa", unidadeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vale_gas_parceiros")
        .select("id, nome, telefone, tipo, latitude, longitude")
        .or(`unidade_id.eq.${unidadeId},unidade_id.is.null`)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as Parceiro[];
    },
    enabled: !!unidadeId,
  });

  const parceirosNoMapa = parceiros.filter((p) => p.latitude && p.longitude);
  const parceirosSemLocal = parceiros.filter((p) => !p.latitude || !p.longitude);

  // Query clientes tipo revenda/revendedor
  const { data: clientesRevenda = [] } = useQuery({
    queryKey: ["clientes-revenda-mapa", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone, latitude, longitude, tipo")
        .eq("empresa_id", empresaId!)
        .in("tipo", ["revenda", "revendedor"])
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as ClienteRevenda[];
    },
    enabled: !!empresaId,
  });

  const revendasNoMapa = clientesRevenda.filter((c) => c.latitude && c.longitude);

  const addMutation = useMutation({
    mutationFn: async (concorrente: Partial<Concorrente>) => {
      const { error } = await supabase.from("concorrentes").insert({
        ...concorrente,
        empresa_id: empresaId,
        unidade_id: unidadeAtual?.id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concorrentes"] });
      toast.success("Concorrente adicionado!");
      resetForm();
    },
    onError: () => toast.error("Erro ao salvar concorrente"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("concorrentes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["concorrentes"] });
      toast.success("Concorrente removido");
    },
  });

  const updateParceiroCoords = useMutation({
    mutationFn: async ({ id, lat, lng }: { id: string; lat: number; lng: number }) => {
      const { error } = await (supabase as any)
        .from("vale_gas_parceiros")
        .update({ latitude: lat, longitude: lng })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parceiros-mapa"] });
      toast.success("Localização do parceiro salva!");
      setParceiroDialogOpen(false);
      setModoParceiro(false);
      setParceiroSelecionadoId("");
      setClickedLat(null);
      setClickedLng(null);
    },
    onError: () => toast.error("Erro ao salvar localização do parceiro"),
  });

  const resetForm = () => {
    setDialogOpen(false);
    setClickedLat(null);
    setClickedLng(null);
    setNome("");
    setEndereco("");
    setNivelAmeaca("moderado");
    setObservacoes("");
    setTelefone("");
    setSearchAddress("");
  };

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setClickedLat(lat);
    setClickedLng(lng);

    if (modoParceiro) {
      setParceiroDialogOpen(true);
      return;
    }

    setDialogOpen(true);
    const result = await reverseGeocode(lat, lng);
    if (result?.displayName) {
      setEndereco(result.displayName.split(",").slice(0, 3).join(",").trim());
    }
  }, [modoParceiro]);

  const handleSearchAddress = async () => {
    if (!searchAddress.trim()) return;
    setSearching(true);
    const result = await geocodeAddress(searchAddress);
    setSearching(false);
    if (result) {
      setClickedLat(result.latitude);
      setClickedLng(result.longitude);
      setEndereco(result.displayName.split(",").slice(0, 3).join(",").trim());
      if (modoParceiro) {
        setParceiroDialogOpen(true);
      } else {
        setDialogOpen(true);
      }
    } else {
      toast.error("Endereço não encontrado. Tente ser mais específico.");
    }
  };

  const handleSave = () => {
    if (!nome.trim()) { toast.error("Informe o nome do concorrente"); return; }
    if (clickedLat === null || clickedLng === null) { toast.error("Selecione a localização"); return; }
    addMutation.mutate({
      nome,
      endereco,
      latitude: clickedLat,
      longitude: clickedLng,
      nivel_ameaca: nivelAmeaca,
      observacoes: observacoes || null,
      telefone: telefone || null,
      produtos_precos: [],
    });
  };

  const handleSalvarParceiro = () => {
    if (!parceiroSelecionadoId) { toast.error("Selecione um parceiro"); return; }
    if (clickedLat === null || clickedLng === null) { toast.error("Selecione a localização"); return; }
    updateParceiroCoords.mutate({ id: parceiroSelecionadoId, lat: clickedLat, lng: clickedLng });
  };

  const parceiroIcon = createParceiroIcon();
  const revendaIcon = createRevendaClienteIcon();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-5 w-5 text-primary" />
            Mapa de Concorrentes
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {Object.entries(ameacaLabels).map(([key, label]) => (
                <Badge key={key} variant="outline" className="text-[10px] gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: ameacaCores[key] }} />
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        {/* Search bar */}
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Buscar endereço..."
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchAddress()}
            className="flex-1"
          />
          <Button variant="outline" size="icon" onClick={handleSearchAddress} disabled={searching}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        {/* Mode toggle and partner positioning */}
        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          <p className="text-xs text-muted-foreground">
            {modoParceiro
              ? "🟢 Modo Parceiro: clique no mapa para posicionar"
              : "Clique no mapa ou busque para adicionar concorrentes"}
          </p>
          <Button
            variant={modoParceiro ? "default" : "outline"}
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => {
              setModoParceiro(!modoParceiro);
              if (modoParceiro) {
                setParceiroDialogOpen(false);
                setClickedLat(null);
                setClickedLng(null);
              }
            }}
          >
            <Handshake className="h-3.5 w-3.5" />
            {modoParceiro ? "Cancelar" : "Posicionar Parceiro"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[450px] rounded-b-lg overflow-hidden relative" style={{ zIndex: 0 }}>
          <MapContainer
            center={[unidadeLat, unidadeLng]}
            zoom={14}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onMapClick={handleMapClick} />

            {/* Our unit - draggable */}
            <Marker
              position={[unidadeLat, unidadeLng]}
              icon={createIcon("#3b82f6", true)}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const pos = marker.getLatLng();
                  if (unidadeId) {
                    updateUnitCoords.mutate({ id: unidadeId, lat: pos.lat, lng: pos.lng });
                  }
                },
              }}
            >
              <Popup>
                <div className="text-center">
                  <strong className="text-sm">{unidadeAtual?.nome || "Nossa Unidade"}</strong>
                  <p className="text-xs text-muted-foreground mt-1">📍 Sua localização</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                    <GripVertical className="h-3 w-3" /> Arraste para corrigir
                  </p>
                </div>
              </Popup>
            </Marker>

            {/* Sibling units in same city */}
            {siblingUnidades.map((u) => (
              <Marker
                key={u.id}
                position={[u.latitude!, u.longitude!]}
                icon={createIcon("#6366f1", true)}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    const pos = marker.getLatLng();
                    updateUnitCoords.mutate({ id: u.id, lat: pos.lat, lng: pos.lng });
                  },
                }}
              >
                <Popup>
                  <div className="text-center">
                    <strong className="text-sm">{u.nome}</strong>
                    <Badge variant="outline" className="text-[10px] mt-1 block">{u.tipo}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                      <GripVertical className="h-3 w-3" /> Arraste para corrigir
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Radius circle */}
            <Circle
              center={[unidadeLat, unidadeLng]}
              radius={2000}
              pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.05, weight: 1, dashArray: "5,5" }}
            />

            {/* Partners */}
            {mostrarParceiros && parceirosNoMapa.map((p) => (
              <Marker
                key={`parceiro-${p.id}`}
                position={[p.latitude!, p.longitude!]}
                icon={parceiroIcon}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    const pos = marker.getLatLng();
                    updateParceiroCoords.mutate({ id: p.id, lat: pos.lat, lng: pos.lng });
                  },
                }}
              >
                <Popup>
                  <div className="min-w-[160px]">
                    <div className="flex items-center gap-1.5">
                      <Handshake className="h-3.5 w-3.5" style={{ color: PARCEIRO_COR }} />
                      <strong className="text-sm">{p.nome}</strong>
                    </div>
                    <Badge variant="outline" className="text-[10px] mt-1">{p.tipo}</Badge>
                    {p.telefone && <p className="text-xs mt-1">📞 {p.telefone}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <GripVertical className="h-3 w-3" /> Arraste para corrigir
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Clientes Revenda */}
            {mostrarRevendas && revendasNoMapa.map((c) => (
              <Marker
                key={`revenda-${c.id}`}
                position={[c.latitude!, c.longitude!]}
                icon={revendaIcon}
                draggable={true}
                eventHandlers={{
                  dragend: async (e) => {
                    const marker = e.target;
                    const pos = marker.getLatLng();
                    const { error } = await supabase.from("clientes").update({ latitude: pos.lat, longitude: pos.lng }).eq("id", c.id);
                    if (error) { toast.error("Erro ao atualizar"); return; }
                    queryClient.invalidateQueries({ queryKey: ["clientes-revenda-mapa"] });
                    toast.success("Localização da revenda atualizada!");
                  },
                }}
              >
                <Popup>
                  <div className="min-w-[160px]">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" style={{ color: REVENDA_COR }} />
                      <strong className="text-sm">{c.nome}</strong>
                    </div>
                    <Badge variant="outline" className="text-[10px] mt-1">Cliente Revenda</Badge>
                    {c.telefone && <p className="text-xs mt-1">📞 {c.telefone}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <GripVertical className="h-3 w-3" /> Arraste para corrigir
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Competitors */}
            {concorrentes.map((c) => (
              <Marker
                key={c.id}
                position={[c.latitude, c.longitude]}
                icon={createIcon(ameacaCores[c.nivel_ameaca] || ameacaCores.moderado)}
              >
                <Popup>
                  <div className="min-w-[180px]">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm">{c.nome}</strong>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                        style={{ background: ameacaCores[c.nivel_ameaca] }}
                      >
                        {ameacaLabels[c.nivel_ameaca]}
                      </span>
                    </div>
                    {c.endereco && <p className="text-xs text-gray-500 mt-1">{c.endereco}</p>}
                    {c.telefone && <p className="text-xs mt-1">📞 {c.telefone}</p>}
                    {c.observacoes && <p className="text-xs mt-1 italic">{c.observacoes}</p>}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-destructive hover:text-destructive text-xs h-7"
                      onClick={() => deleteMutation.mutate(c.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Remover
                    </Button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Clicked position preview */}
            {clickedLat !== null && clickedLng !== null && (
              <Marker
                position={[clickedLat, clickedLng]}
                icon={modoParceiro ? parceiroIcon : createIcon("#8b5cf6")}
              >
                <Popup>
                  <p className="text-xs font-medium">
                    {modoParceiro ? "Posicionar parceiro aqui" : "Nova localização selecionada"}
                  </p>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Legend overlay */}
          <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg p-2 z-[1000] text-xs space-y-1 border">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-info border border-white" />
              <span>Sua unidade</span>
            </div>
            {siblingUnidades.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-white" style={{ background: "#6366f1" }} />
                <span>Outras unidades</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border border-white" style={{ background: ameacaCores.alto }} />
              <span>Ameaça alta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border border-white" style={{ background: ameacaCores.moderado }} />
              <span>Moderado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border border-white" style={{ background: ameacaCores.baixo }} />
              <span>Baixo</span>
            </div>
            {/* Parceiros toggle */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-white" style={{ background: PARCEIRO_COR }} />
                <span>Parceiros ({parceirosNoMapa.length})</span>
              </div>
              <Switch checked={mostrarParceiros} onCheckedChange={setMostrarParceiros} className="scale-75" />
            </div>
            {/* Clientes Revenda toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-white" style={{ background: REVENDA_COR }} />
                <span>Clientes Revenda ({revendasNoMapa.length})</span>
              </div>
              <Switch checked={mostrarRevendas} onCheckedChange={setMostrarRevendas} className="scale-75" />
            </div>
          </div>

          {/* Counter */}
          <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1.5 z-[1000] text-xs font-medium border space-y-0.5">
            <div>
              <Store className="h-3.5 w-3.5 inline mr-1" />
              {concorrentes.length} concorrente{concorrentes.length !== 1 ? "s" : ""}
            </div>
            <div>
              <Handshake className="h-3.5 w-3.5 inline mr-1" />
              {parceirosNoMapa.length} parceiro{parceirosNoMapa.length !== 1 ? "s" : ""}
            </div>
            <div>
              <Users className="h-3.5 w-3.5 inline mr-1" />
              {revendasNoMapa.length} revenda{revendasNoMapa.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </CardContent>

      {/* Add concorrente dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); else setDialogOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Adicionar Concorrente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do concorrente *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Depósito do João" />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude</Label>
                <Input value={clickedLat?.toFixed(6) || ""} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input value={clickedLng?.toFixed(6) || ""} readOnly className="bg-muted" />
              </div>
            </div>
            <div>
              <Label>Nível de ameaça</Label>
              <Select value={nivelAmeaca} onValueChange={setNivelAmeaca}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alto">🔴 Alto</SelectItem>
                  <SelectItem value="moderado">🟡 Moderado</SelectItem>
                  <SelectItem value="baixo">🟢 Baixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Preços, horários, diferenciais..." rows={2} />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={addMutation.isPending}>
              {addMutation.isPending ? "Salvando..." : "Salvar Concorrente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Position parceiro dialog */}
      <Dialog open={parceiroDialogOpen} onOpenChange={(o) => { if (!o) { setParceiroDialogOpen(false); setClickedLat(null); setClickedLng(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5" style={{ color: PARCEIRO_COR }} />
              Posicionar Parceiro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Selecione o parceiro</Label>
              <Select value={parceiroSelecionadoId} onValueChange={setParceiroSelecionadoId}>
                <SelectTrigger><SelectValue placeholder="Escolha um parceiro..." /></SelectTrigger>
                <SelectContent>
                  {parceirosSemLocal.length > 0 && (
                    <>
                      <SelectItem value="__divider_sem" disabled className="text-[10px] text-muted-foreground">
                        Sem localização
                      </SelectItem>
                      {parceirosSemLocal.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          📍 {p.nome} ({p.tipo})
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {parceirosNoMapa.length > 0 && (
                    <>
                      <SelectItem value="__divider_com" disabled className="text-[10px] text-muted-foreground">
                        Já posicionados (reposicionar)
                      </SelectItem>
                      {parceirosNoMapa.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          ✅ {p.nome} ({p.tipo})
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {parceiros.length === 0 && (
                    <SelectItem value="__none" disabled>Nenhum parceiro cadastrado</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude</Label>
                <Input value={clickedLat?.toFixed(6) || ""} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input value={clickedLng?.toFixed(6) || ""} readOnly className="bg-muted" />
              </div>
            </div>
            <Button onClick={handleSalvarParceiro} className="w-full" disabled={updateParceiroCoords.isPending || !parceiroSelecionadoId}>
              {updateParceiroCoords.isPending ? "Salvando..." : "Salvar Localização"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
