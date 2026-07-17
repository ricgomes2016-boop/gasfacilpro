import { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard, Loader2, CheckCircle, XCircle, RefreshCw, Smartphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CardPaymentModalProps {
  open: boolean;
  onClose: () => void;
  pedidoId: string;
  entregadorId: string | null;
  valor: number;
  onSuccess: () => void;
}

type PaymentStep = "config" | "aguardando" | "aprovado" | "negado";

export function CardPaymentModal({
  open, onClose, pedidoId, entregadorId, valor, onSuccess,
}: CardPaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>("config");
  const [tipo, setTipo] = useState<"debito" | "credito">("debito");
  const [parcelas, setParcelas] = useState(1);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when opened
  useEffect(() => {
    if (open) {
      setStep("config");
      setTipo("debito");
      setParcelas(1);
      setTransactionId(null);
    }
    return () => stopPolling();
  }, [open]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const iniciarPagamento = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pagamento-iniciar", {
        body: {
          pedido_id: pedidoId,
          entregador_id: entregadorId,
          valor,
          forma_pagamento: tipo,
          parcelas: tipo === "credito" ? parcelas : 1,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTransactionId(data.transaction_id);
      setStep("aguardando");
      startPolling(data.transaction_id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (txnId: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("pagamentos_cartao")
          .select("status")
          .eq("transaction_id", txnId)
          .maybeSingle();

        if (data?.status === "aprovado") {
          stopPolling();
          setStep("aprovado");
        } else if (data?.status === "negado") {
          stopPolling();
          setStep("negado");
        }
      } catch {
        // silently retry
      }
    }, 3000);
  };

  const handleNovaTentativa = () => {
    setStep("config");
    setTransactionId(null);
  };

  const handleConcluir = () => {
    onSuccess();
    onClose();
  };

  const fmtBRL = (v: number) => `R$ ${v.toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { stopPolling(); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pagamento Maquininha
          </DialogTitle>
        </DialogHeader>

        {step === "config" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground">Valor da cobrança</p>
              <p className="text-3xl font-bold text-primary">{fmtBRL(valor)}</p>
            </div>

            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v as any); if (v === "debito") setParcelas(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipo === "credito" && (
              <div>
                <Label>Parcelas</Label>
                <Select value={String(parcelas)} onValueChange={(v) => setParcelas(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x de {fmtBRL(valor / n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={iniciarPagamento}
              disabled={loading}
              className="w-full h-12 gradient-primary text-white"
            >
              {loading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Smartphone className="h-5 w-5 mr-2" />}
              {loading ? "Iniciando..." : "Cobrar na Maquininha"}
            </Button>
          </div>
        )}

        {step === "aguardando" && (
          <div className="space-y-4 text-center py-4">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <Smartphone className="absolute inset-0 m-auto h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">Aguardando pagamento</p>
              <p className="text-sm text-muted-foreground mt-1">
                Passe o cartão na maquininha PagBank
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="text-2xl font-bold">{fmtBRL(valor)}</p>
              <Badge variant="outline" className="mt-1">
                {tipo === "debito" ? "Débito" : `Crédito ${parcelas}x`}
              </Badge>
            </div>
            {transactionId && (
              <p className="text-xs text-muted-foreground font-mono">
                ID: {transactionId.slice(-12)}
              </p>
            )}
          </div>
        )}

        {step === "aprovado" && (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <div>
              <p className="font-semibold text-lg text-success">Pagamento Aprovado!</p>
              <p className="text-sm text-muted-foreground mt-1">{fmtBRL(valor)}</p>
            </div>
            <Button onClick={handleConcluir} className="w-full gradient-primary text-white">
              <CheckCircle className="h-4 w-4 mr-2" />
              Continuar
            </Button>
          </div>
        )}

        {step === "negado" && (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-lg text-destructive">Pagamento Negado</p>
              <p className="text-sm text-muted-foreground mt-1">
                A operadora recusou a transação.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { stopPolling(); onClose(); }} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleNovaTentativa} className="flex-1 gradient-primary text-white">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
