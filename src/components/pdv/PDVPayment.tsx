import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Banknote, CreditCard, Smartphone, Receipt } from "lucide-react";
import { PixKeySelectorModal } from "@/components/pagamento/PixKeySelectorModal";
import { CardOperatorSelectorModal } from "@/components/pagamento/CardOperatorSelectorModal";
import { useUnidade } from "@/contexts/UnidadeContext";

interface PDVPaymentProps {
  open: boolean;
  onClose: () => void;
  total: number;
  onConfirm: (formaPagamento: string, valorRecebido: number, extras?: { operadora_id?: string; conta_bancaria_id?: string }) => void;
  isLoading: boolean;
}

const formasPagamento = [
  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
  { value: "pix", label: "PIX", icon: Smartphone },
  { value: "pix_maquininha", label: "PIX Maquininha", icon: Smartphone },
  { value: "credito", label: "Cartão Crédito", icon: CreditCard },
  { value: "debito", label: "Cartão Débito", icon: CreditCard },
  { value: "vale_gas", label: "Vale Gás", icon: Receipt },
  
  { value: "cheque", label: "Cheque", icon: Receipt },
];

export function PDVPayment({ open, onClose, total, onConfirm, isLoading }: PDVPaymentProps) {
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [valorRecebido, setValorRecebido] = useState("");
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<{ operadora_id?: string; conta_bancaria_id?: string }>({});
  const [selectedInfo, setSelectedInfo] = useState<string | null>(null);
  const { unidadeAtual } = useUnidade();

  const valorRecebidoNum = parseFloat(valorRecebido.replace(",", ".")) || 0;
  const troco = formaPagamento === "dinheiro" ? Math.max(0, valorRecebidoNum - total) : 0;
  const canFinalize = formaPagamento !== "dinheiro" || valorRecebidoNum >= total;

  const handleSelectForma = (value: string) => {
    setFormaPagamento(value);
    setSelectedExtras({});
    setSelectedInfo(null);

    // Open selector modals for PIX / Card
    if (value === "pix") {
      setPixModalOpen(true);
    } else if (value === "credito" || value === "debito" || value === "pix_maquininha") {
      setCardModalOpen(true);
    }
  };

  const handleConfirm = () => {
    onConfirm(formaPagamento, valorRecebidoNum, selectedExtras);
  };

  const setQuickValue = (value: number) => {
    setValorRecebido(value.toFixed(2).replace(".", ","));
  };

  const cardTipo = formaPagamento === "credito" ? "credito" : formaPagamento === "pix_maquininha" ? "pix_maquininha" : "debito";

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Finalizar Venda
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Total */}
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Total a Pagar</p>
              <p className="text-4xl font-bold text-primary">
                R$ {total.toFixed(2)}
              </p>
            </div>

            {/* Forma de Pagamento */}
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                {formasPagamento.map((forma) => {
                  const Icon = forma.icon;
                  return (
                    <Button
                      key={forma.value}
                      variant={formaPagamento === forma.value ? "default" : "outline"}
                      className="h-14 flex-col gap-1"
                      onClick={() => handleSelectForma(forma.value)}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs">{forma.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Info da seleção (operadora ou chave) */}
            {selectedInfo && (
              <div className="p-3 rounded-lg bg-success/10 text-success text-sm text-center font-medium">
                {selectedInfo}
              </div>
            )}

            {/* Valor Recebido (só para dinheiro) */}
            {formaPagamento === "dinheiro" && (
              <div className="space-y-2">
                <Label>Valor Recebido</Label>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={valorRecebido}
                  onChange={(e) => setValorRecebido(e.target.value)}
                  className="text-lg text-center font-mono"
                />
                <div className="flex gap-2 w-full min-w-0">
                  {[50, 100, 150, 200].map((value) => (
                    <Button
                      key={value}
                      variant="outline"
                      className="flex-1 h-10 min-w-0 px-2"
                      onClick={() => setQuickValue(value)}
                    >
                      <span className="truncate">R$ {value}</span>
                    </Button>
                  ))}
                </div>

                {valorRecebidoNum > 0 && (
                  <div className="text-center p-3 bg-success/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Troco</p>
                    <p className="text-2xl font-bold text-success">
                      R$ {troco.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-2 w-full min-w-0">
              <Button variant="outline" className="flex-1 h-11 min-w-0" onClick={onClose}>
                <span className="truncate">Cancelar</span>
              </Button>
              <Button
                className="flex-1 h-11 min-w-0"
                disabled={!canFinalize || isLoading}
                onClick={handleConfirm}
              >
                <span className="truncate">{isLoading ? "Processando..." : "Confirmar"}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIX Key Selector */}
      <PixKeySelectorModal
        open={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        valor={total}
        beneficiario={unidadeAtual?.nome}
        onSelect={(chavePix, contaBancariaId) => {
          setSelectedExtras({ conta_bancaria_id: contaBancariaId });
          setSelectedInfo(`PIX via conta selecionada`);
        }}
      />

      {/* Card Operator Selector */}
      <CardOperatorSelectorModal
        open={cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        valor={total}
        tipoCartao={cardTipo}
        onSelect={(op) => {
          setSelectedExtras({ operadora_id: op.id });
          setSelectedInfo(`${op.nome} • Taxa ${op.taxa.toFixed(2)}% • D+${op.prazo} • Líq. R$ ${op.valorLiquido.toFixed(2)}`);
        }}
      />
    </>
  );
}
