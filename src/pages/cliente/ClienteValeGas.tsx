import { ClienteLayout } from "@/components/cliente/ClienteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCliente } from "@/contexts/ClienteContext";
import { 
  CreditCard, 
  Calendar, 
  Building2, 
  CheckCircle,
  XCircle,
  QrCode,
  Info
} from "lucide-react";
import { format, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { ValeGasQRCode } from "@/components/valegas/ValeGasQRCode";

export default function ClienteValeGas() {
  const { valesGas } = useCliente();
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [selectedVale, setSelectedVale] = useState<{ numero: number; codigo: string; valor: number; parceiroNome?: string } | null>(null);

  const activeVales = valesGas.filter(v => !v.used && !isBefore(v.expiryDate, new Date()));
  const usedOrExpiredVales = valesGas.filter(v => v.used || isBefore(v.expiryDate, new Date()));

  const totalAvailable = activeVales.reduce((sum, v) => sum + v.value, 0);

  const handleOpenQRCode = (vale: typeof valesGas[0]) => {
    setSelectedVale({
      numero: parseInt(vale.code.split("-")[2]) || 0,
      codigo: vale.code,
      valor: vale.value,
      parceiroNome: vale.partner,
    });
    setQrCodeOpen(true);
  };

  return (
    <ClienteLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Meus Vales Gás</h1>

        {/* Summary Card */}
        <Card className="gradient-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-full">
                <CreditCard className="h-6 w-6" />
              </div>
              <p className="text-primary-foreground/80">Total disponível em vales</p>
            </div>
            <p className="text-4xl font-bold">
              R$ {totalAvailable.toFixed(2)}
            </p>
            <p className="text-sm text-primary-foreground/70 mt-2">
              {activeVales.length} vale{activeVales.length !== 1 ? 's' : ''} ativo{activeVales.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        {/* Active Vales */}
        {activeVales.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Vales Ativos
            </h2>
            
            {activeVales.map(vale => (
              <Card key={vale.id} className="border-success bg-success/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono font-semibold text-lg">{vale.code}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Building2 className="h-4 w-4" />
                        <span>{vale.partner}</span>
                      </div>
                    </div>
                    <Badge className="bg-success">Ativo</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Válido até {format(vale.expiryDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                    <p className="text-2xl font-bold text-success">
                      R$ {vale.value.toFixed(2)}
                    </p>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="w-full mt-3 gap-2"
                    onClick={() => handleOpenQRCode(vale)}
                  >
                    <QrCode className="h-4 w-4" />
                    Ver QR Code
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {activeVales.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <CreditCard className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-semibold mb-1">Nenhum vale ativo</h3>
              <p className="text-sm text-muted-foreground">
                Você não possui vales gás disponíveis no momento.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Used/Expired Vales */}
        {usedOrExpiredVales.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-lg flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-5 w-5" />
              Vales Utilizados/Expirados
            </h2>
            
            {usedOrExpiredVales.map(vale => {
              const isExpired = isBefore(vale.expiryDate, new Date());
              return (
                <Card key={vale.id} className="opacity-60">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-mono font-semibold">{vale.code}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Building2 className="h-4 w-4" />
                          <span>{vale.partner}</span>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {vale.used ? "Utilizado" : "Expirado"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {isExpired ? "Expirou em" : "Válido até"} {format(vale.expiryDate, "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xl font-bold text-muted-foreground line-through">
                        R$ {vale.value.toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">O que é Vale Gás?</p>
                <p className="text-muted-foreground">
                  O Vale Gás é um voucher que pode ser adquirido em parceiros ou 
                  diretamente na revenda. Na hora da compra, basta informar o código 
                  ou apresentar o QR Code para utilizar o crédito.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR Code Dialog */}
        {selectedVale && (
          <ValeGasQRCode
            open={qrCodeOpen}
            onClose={() => {
              setQrCodeOpen(false);
              setSelectedVale(null);
            }}
            vale={selectedVale}
          />
        )}
      </div>
    </ClienteLayout>
  );
}
