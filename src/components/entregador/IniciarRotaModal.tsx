import { useState, useEffect } from "react";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogDescription as DialogDescription,
} from "@/components/ui/responsive-dialog";
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
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Gauge, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  status: string | null;
}

interface IniciarRotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (veiculoId: number, veiculoPlaca: string, kmInicial: number) => void;
  entregaNome?: string;
}

export function IniciarRotaModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  entregaNome 
}: IniciarRotaModalProps) {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<string>("");
  const [kmInicial, setKmInicial] = useState<string>("");
  const [erro, setErro] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      fetchVeiculos();
    }
  }, [isOpen]);

  const fetchVeiculos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("veiculos")
      .select("id, placa, modelo, status")
      .or("status.eq.ativo,status.is.null")
      .order("placa");
    setVeiculos((data || []) as Veiculo[]);
    setLoading(false);
  };

  const veiculoInfo = veiculos.find(
    v => v.id === veiculoSelecionado
  );

  const handleConfirmar = () => {
    if (!veiculoSelecionado) {
      setErro("Selecione um veículo para continuar");
      return;
    }

    if (!kmInicial || parseInt(kmInicial) < 0) {
      setErro("Informe a quilometragem inicial válida");
      return;
    }

    setErro("");
    onConfirm(
      parseInt(veiculoSelecionado),
      veiculoInfo?.placa || "",
      parseInt(kmInicial)
    );
    
    setVeiculoSelecionado("");
    setKmInicial("");
  };

  const handleClose = () => {
    setErro("");
    setVeiculoSelecionado("");
    setKmInicial("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Iniciar Rota
          </DialogTitle>
          <DialogDescription>
            Para iniciar a rota, informe o veículo e a quilometragem inicial.
            {entregaNome && (
              <span className="block mt-1 text-primary font-medium">
                Entrega: {entregaNome}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Seleção de Veículo */}
          <div className="space-y-2">
            <Label htmlFor="veiculo" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Veículo *
            </Label>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando veículos...
              </div>
            ) : (
              <Select 
                value={veiculoSelecionado} 
                onValueChange={(value) => {
                  setVeiculoSelecionado(value);
                  setErro("");
                }}
              >
                <SelectTrigger id="veiculo">
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {veiculos.map((veiculo) => (
                    <SelectItem key={veiculo.id} value={veiculo.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{veiculo.placa}</span>
                        <span className="text-muted-foreground">- {veiculo.modelo}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Veículo Selecionado Info */}
          {veiculoInfo && (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-3 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-success" />
                <div>
                  <p className="font-medium text-sm">{veiculoInfo.placa}</p>
                  <p className="text-xs text-muted-foreground">{veiculoInfo.modelo}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quilometragem Inicial */}
          <div className="space-y-2">
            <Label htmlFor="km" className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Quilometragem Inicial *
            </Label>
            <Input
              id="km"
              type="number"
              placeholder="Ex: 45230"
              value={kmInicial}
              onChange={(e) => {
                setKmInicial(e.target.value);
                setErro("");
              }}
              min={0}
            />
            <p className="text-xs text-muted-foreground">
              Informe a quilometragem atual do hodômetro do veículo
            </p>
          </div>

          {/* Mensagem de Erro */}
          {erro && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <AlertCircle className="h-4 w-4" />
              {erro}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmar} 
              className="flex-1"
              disabled={!veiculoSelecionado || !kmInicial}
            >
              <Truck className="h-4 w-4 mr-2" />
              Iniciar Rota
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
