import { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PenLine, RotateCcw, CheckCircle2, MapPin } from "lucide-react";

export interface AssinaturaPayload {
  assinatura_data_url: string | null;
  nome_recebedor: string;
  documento_recebedor?: string;
  recusou_assinar: boolean;
  observacao?: string;
  latitude?: number | null;
  longitude?: number | null;
  assinado_em: string;
}

interface Props {
  onChange: (payload: AssinaturaPayload | null) => void;
}

export function AssinaturaCanhotoCard({ onChange }: Props) {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [confirmada, setConfirmada] = useState(false);
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [recusou, setRecusou] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [preview, setPreview] = useState<string | null>(null);

  // Capturar geolocalização ao montar
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Notificar parent
  useEffect(() => {
    if (recusou) {
      if (nome.trim() && observacao.trim()) {
        onChange({
          assinatura_data_url: null,
          nome_recebedor: nome.trim(),
          documento_recebedor: documento.trim() || undefined,
          recusou_assinar: true,
          observacao: observacao.trim(),
          latitude: coords.lat,
          longitude: coords.lng,
          assinado_em: new Date().toISOString(),
        });
      } else {
        onChange(null);
      }
      return;
    }
    if (confirmada && preview && nome.trim()) {
      onChange({
        assinatura_data_url: preview,
        nome_recebedor: nome.trim(),
        documento_recebedor: documento.trim() || undefined,
        recusou_assinar: false,
        observacao: observacao.trim() || undefined,
        latitude: coords.lat,
        longitude: coords.lng,
        assinado_em: new Date().toISOString(),
      });
    } else {
      onChange(null);
    }
  }, [confirmada, preview, nome, documento, recusou, observacao, coords, onChange]);

  const limpar = () => {
    sigRef.current?.clear();
    setConfirmada(false);
    setPreview(null);
  };

  const confirmar = () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const dataUrl = sigRef.current.getCanvas().toDataURL("image/png");
    setPreview(dataUrl);
    setConfirmada(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PenLine className="h-5 w-5 text-primary" />
          Assinatura do Recebedor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="nome-recebedor">Nome de quem recebeu *</Label>
          <Input
            id="nome-recebedor"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Maria Silva"
            className="text-base"
          />
        </div>

        <div>
          <Label htmlFor="doc-recebedor">CPF / RG (opcional)</Label>
          <Input
            id="doc-recebedor"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            placeholder="000.000.000-00"
            className="text-base"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Cliente recusou assinar</p>
            <p className="text-xs text-muted-foreground">Será necessário descrever o motivo</p>
          </div>
          <Switch checked={recusou} onCheckedChange={(v) => { setRecusou(v); if (v) limpar(); }} />
        </div>

        {recusou ? (
          <div>
            <Label htmlFor="motivo">Motivo da recusa *</Label>
            <Textarea
              id="motivo"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: cliente estava com pressa..."
              rows={2}
            />
          </div>
        ) : (
          <div>
            <Label>Assine no quadro abaixo *</Label>
            <div className="mt-1 rounded-lg border bg-white overflow-hidden touch-none">
              {confirmada && preview ? (
                <div className="relative">
                  <img src={preview} alt="Assinatura" className="w-full h-40 object-contain bg-white" />
                  <div className="absolute top-2 right-2 bg-success text-white rounded-full p-1">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                <SignatureCanvas
                  ref={sigRef}
                  penColor="#0f172a"
                  canvasProps={{
                    className: "w-full h-40 bg-white",
                    style: { touchAction: "none" },
                  }}
                />
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={limpar}>
                <RotateCcw className="h-4 w-4 mr-1" /> {confirmada ? "Refazer" : "Limpar"}
              </Button>
              {!confirmada && (
                <Button type="button" size="sm" className="flex-1" onClick={confirmar}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar
                </Button>
              )}
            </div>
          </div>
        )}

        {coords.lat !== null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            Localização capturada: {coords.lat.toFixed(5)}, {coords.lng?.toFixed(5)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
