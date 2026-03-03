import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, MapPin, Loader2, Navigation, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { haversineDistance } from "@/lib/haversine";
import { toast } from "sonner";

interface Entregador {
  id: string;
  nome: string;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
  unidade_id: string | null;
  distancia?: number | null;
}

interface Unidade {
  id: string;
  nome: string;
  tipo: string;
}

interface RepassarEntregadorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidoId: string | null;
  onSuccess: () => void;
}

export function RepassarEntregadorDialog({
  open,
  onOpenChange,
  pedidoId,
  onSuccess,
}: RepassarEntregadorDialogProps) {
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>("todas");
  const [pedidoCoords, setPedidoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();

  // Load units + drivers + order coords when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedUnidadeId("todas");

    const load = async () => {
      // Fetch all active units of the empresa
      if (empresa?.id) {
        const { data: unidadesData } = await supabase
          .from("unidades")
          .select("id, nome, tipo")
          .eq("empresa_id", empresa.id)
          .eq("ativo", true)
          .order("nome");
        setUnidades(unidadesData || []);
      }

      // Fetch order coordinates (from client address)
      let coords: { lat: number; lng: number } | null = null;
      if (pedidoId) {
        const { data: pedido } = await supabase
          .from("pedidos")
          .select("cliente_id")
          .eq("id", pedidoId)
          .maybeSingle();

        if (pedido?.cliente_id) {
          const { data: cliente } = await supabase
            .from("clientes")
            .select("latitude, longitude")
            .eq("id", pedido.cliente_id)
            .maybeSingle();
          if (cliente?.latitude && cliente?.longitude) {
            coords = { lat: cliente.latitude, lng: cliente.longitude };
          }
        }
      }
      setPedidoCoords(coords);

      // Fetch all active drivers across all units of the empresa
      const { data: allDrivers } = await supabase
        .from("entregadores")
        .select("id, nome, status, latitude, longitude, unidade_id")
        .eq("ativo", true)
        .order("nome");

      // Filter drivers to only those belonging to empresa units
      const empresaUnidadeIds = new Set((unidades.length > 0 ? unidades : []).map(u => u.id));
      let drivers = (allDrivers || []) as Entregador[];

      // Calculate distance if we have order coordinates
      if (coords) {
        drivers = drivers.map(d => ({
          ...d,
          distancia: d.latitude && d.longitude
            ? haversineDistance(coords!.lat, coords!.lng, d.latitude, d.longitude)
            : null,
        }));
        // Sort: drivers with distance first (ascending), then without distance
        drivers.sort((a, b) => {
          if (a.distancia != null && b.distancia != null) return a.distancia - b.distancia;
          if (a.distancia != null) return -1;
          if (b.distancia != null) return 1;
          return a.nome.localeCompare(b.nome);
        });
      }

      setEntregadores(drivers);
      setLoading(false);
    };

    load();
  }, [open, pedidoId, empresa?.id]);

  // Re-fetch drivers when unidades are loaded (for filtering)
  useEffect(() => {
    if (!open || loading || unidades.length === 0) return;
    // Already loaded, just re-calc filter
  }, [unidades]);

  const filteredEntregadores = useMemo(() => {
    if (selectedUnidadeId === "todas") return entregadores;
    return entregadores.filter(e => e.unidade_id === selectedUnidadeId);
  }, [entregadores, selectedUnidadeId]);

  const suggestedDriver = useMemo(() => {
    if (!pedidoCoords) return null;
    const withDist = entregadores.filter(e => e.distancia != null && e.status === "disponivel");
    return withDist.length > 0 ? withDist[0] : null;
  }, [entregadores, pedidoCoords]);

  const handleAssign = async (entregador: Entregador) => {
    if (!pedidoId) return;
    setAssigning(entregador.id);
    try {
      const updateData: Record<string, any> = {
        entregador_id: entregador.id,
        entregador_nome: entregador.nome,
        status: "confirmado",
      };

      // If driver belongs to a different unit, update the order's unit too
      if (entregador.unidade_id && entregador.unidade_id !== unidadeAtual?.id) {
        updateData.unidade_id = entregador.unidade_id;
      }

      const { error } = await supabase
        .from("pedidos")
        .update(updateData)
        .eq("id", pedidoId);

      if (error) throw error;

      const unidadeNome = unidades.find(u => u.id === entregador.unidade_id)?.nome;
      toast.success(
        `Pedido repassado para ${entregador.nome}${unidadeNome && unidadeNome !== unidadeAtual?.nome ? ` (${unidadeNome})` : ""}`
      );
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao repassar pedido");
    } finally {
      setAssigning(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "disponivel":
        return <Badge variant="default" className="text-[10px]">Disponível</Badge>;
      case "em_rota":
        return <Badge variant="secondary" className="text-[10px]">Em Rota</Badge>;
      case "indisponivel":
        return <Badge variant="destructive" className="text-[10px]">Indisponível</Badge>;
      default:
        return null;
    }
  };

  const getUnidadeLabel = (unidadeId: string | null) => {
    if (!unidadeId) return null;
    const u = unidades.find(un => un.id === unidadeId);
    return u ? u.nome : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Repassar para Entregador
          </DialogTitle>
        </DialogHeader>

        {/* Suggestion banner */}
        {suggestedDriver && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
              <Navigation className="h-3 w-3" /> Sugestão: entregador mais próximo
            </p>
            <button
              disabled={assigning !== null}
              onClick={() => handleAssign(suggestedDriver)}
              className="w-full flex items-center justify-between p-2 rounded-md bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{suggestedDriver.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {suggestedDriver.distancia != null
                      ? `${suggestedDriver.distancia.toFixed(1)} km de distância`
                      : ""}
                    {getUnidadeLabel(suggestedDriver.unidade_id) && ` · ${getUnidadeLabel(suggestedDriver.unidade_id)}`}
                  </p>
                </div>
              </div>
              {assigning === suggestedDriver.id && <Loader2 className="h-4 w-4 animate-spin" />}
            </button>
          </div>
        )}

        {/* Unit filter */}
        {unidades.length > 1 && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedUnidadeId} onValueChange={setSelectedUnidadeId}>
              <SelectTrigger className="flex-1 h-8 text-sm">
                <SelectValue placeholder="Filtrar por unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as unidades</SelectItem>
                {unidades.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEntregadores.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhum entregador ativo encontrado.
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {filteredEntregadores.map((e) => (
              <button
                key={e.id}
                disabled={assigning !== null}
                onClick={() => handleAssign(e)}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Truck className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{e.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.distancia != null && `${e.distancia.toFixed(1)} km`}
                      {e.distancia != null && getUnidadeLabel(e.unidade_id) && " · "}
                      {getUnidadeLabel(e.unidade_id)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(e.status)}
                  {assigning === e.id && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
