import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package, Clock, CheckCircle, MapPin, Phone, Navigation, User, Truck, Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ProximityCheckinBanner } from "./ProximityCheckinBanner";
import { useProximityCheckin } from "@/hooks/useProximityCheckin";
import { WaitingTimer } from "./WaitingTimer";
import { SwipeToAccept } from "./SwipeToAccept";
import { useFormaPagamentoLabel } from "@/hooks/useFormasPagamentoCustom";

export interface EntregaDB {
  id: string;
  created_at: string;
  valor_total: number | null;
  status: string | null;
  forma_pagamento: string | null;
  endereco_entrega: string | null;
  observacoes: string | null;
  cliente_id: string | null;
  clientes: {
    nome: string;
    telefone: string | null;
    bairro: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  pedido_itens: {
    id: string;
    quantidade: number;
    preco_unitario: number;
    produtos: {
      nome: string;
    } | null;
  }[];
}

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-muted text-muted-foreground", icon: Clock },
  em_rota: { label: "Em Rota", color: "bg-warning/10 text-warning", icon: Truck },
  entregue: { label: "Entregue", color: "bg-success/10 text-success", icon: CheckCircle },
  cancelado: { label: "Cancelado", color: "bg-destructive/10 text-destructive", icon: Package },
};

interface EntregaCardProps {
  entrega: EntregaDB;
  onAceitar: (id: string) => void;
  sameBairroCount?: number;
}

export function EntregaCard({ entrega, onAceitar, sameBairroCount }: EntregaCardProps) {
  const status = statusConfig[entrega.status as keyof typeof statusConfig] || statusConfig.pendente;
  const formaLabel = useFormaPagamentoLabel();
  const StatusIcon = status.icon;
  const clienteNome = entrega.clientes?.nome || "Cliente";
  const clienteTelefone = entrega.clientes?.telefone || "";
  const bairro = entrega.clientes?.bairro || "";

  const proximity = useProximityCheckin(
    entrega.status === "em_rota" ? entrega.endereco_entrega : null,
    entrega.status === "em_rota" ? entrega.clientes?.latitude : null,
    entrega.status === "em_rota" ? entrega.clientes?.longitude : null
  );

  const productsSummary = entrega.pedido_itens
    .map(i => `${i.quantidade}x ${i.produtos?.nome || "Produto"}`)
    .join(", ");

  const abrirMapa = (endereco: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`, "_blank");
  };

  const ligar = (telefone: string) => {
    window.open(`tel:${telefone}`, "_self");
  };

  const abrirWhatsApp = (telefone: string) => {
    const num = telefone.replace(/\D/g, "");
    const formatted = num.startsWith("55") ? num : `55${num}`;
    window.open(`https://wa.me/${formatted}`, "_blank");
  };

  return (
    <Card className="border-none shadow-md overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm sm:text-base truncate">{clienteNome}</p>
              <p className="text-xs text-muted-foreground">Pedido #{entrega.id.slice(-6).toUpperCase()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sameBairroCount && sameBairroCount >= 2 && (
              <Badge className="bg-accent text-accent-foreground text-xs">
                <Users className="h-3 w-3 mr-1" />
                {sameBairroCount}x {bairro}
              </Badge>
            )}
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 sm:p-4 space-y-2.5">
          {/* Waiting timer for pending deliveries */}
          {entrega.status === "pendente" && (
            <WaitingTimer createdAt={entrega.created_at} />
          )}

          {entrega.endereco_entrega && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm truncate">{entrega.endereco_entrega}</p>
                {bairro && <Badge variant="secondary" className="mt-1 text-xs">{bairro}</Badge>}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{productsSummary}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground truncate max-w-[60%]" title={formaLabel(entrega.forma_pagamento)}>{formaLabel(entrega.forma_pagamento)}</p>
            <p className="font-bold text-lg text-primary">
              R$ {(entrega.valor_total || 0).toFixed(2)}
            </p>
          </div>

          {/* Proximity Check-in */}
          {entrega.status === "em_rota" && proximity.distanceMeters !== null && (
            <ProximityCheckinBanner
              isNearby={proximity.isNearby}
              distanceMeters={proximity.distanceMeters}
              onCheckin={() => {
                window.location.href = `/entregador/entregas/${entrega.id}/finalizar`;
              }}
            />
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-border">
          {entrega.status === "pendente" && (
            <div className="p-3">
              <SwipeToAccept
                onAccept={() => onAceitar(entrega.id)}
                label="Deslize para aceitar"
              />
            </div>
          )}

          {entrega.status === "em_rota" && (
            <div className="flex">
              {entrega.endereco_entrega && (
                <Button
                  variant="ghost"
                  onClick={() => abrirMapa(entrega.endereco_entrega!)}
                  className="flex-1 rounded-none h-11 sm:h-12 text-sm"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Mapa
                </Button>
              )}
              {clienteTelefone && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => ligar(clienteTelefone)}
                    className="flex-1 rounded-none h-11 sm:h-12 border-l border-border text-sm"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Ligar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => abrirWhatsApp(clienteTelefone)}
                    className="flex-1 rounded-none h-11 sm:h-12 border-l border-border text-sm text-success"
                  >
                    💬 Zap
                  </Button>
                </>
              )}
              <Link to={`/entregador/entregas/${entrega.id}/finalizar`} className="flex-1">
                <Button className="w-full rounded-none gradient-primary text-white h-11 sm:h-12 text-sm">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Finalizar
                </Button>
              </Link>
            </div>
          )}

          {entrega.status === "entregue" && (
            <div className="flex-1 flex items-center justify-center h-11 sm:h-12 text-success text-sm font-medium">
              <CheckCircle className="h-4 w-4 mr-2" />
              Entrega concluída
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
