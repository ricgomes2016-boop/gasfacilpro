import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Banknote, CreditCard, Smartphone, Receipt, Plus, Trash2, Flame } from "lucide-react";
import { PixKeySelectorModal } from "@/components/pagamento/PixKeySelectorModal";
import { CardOperatorSelectorModal } from "@/components/pagamento/CardOperatorSelectorModal";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface PDVPagamento {
  id: string;
  forma: string;
  valor: number;
  operadora_id?: string;
  conta_bancaria_id?: string;
  info?: string;
  parcelas?: number;
  taxa_desconto_percentual?: number;
  /** Cobrança extra (ex.: taxa de entrega Gás do Povo) associada a este pagamento. */
  taxa_extra?: number;
}

interface PDVPaymentProps {
  open: boolean;
  onClose: () => void;
  total: number;
  onConfirm: (pagamentos: PDVPagamento[], valorRecebidoDinheiro: number) => void;
  isLoading: boolean;
  itens?: Array<{ nome: string; quantidade: number }>;
}

const formasPagamentoBase = [
  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
  { value: "pix", label: "PIX", icon: Smartphone },
  { value: "pix_maquininha", label: "PIX Maquininha", icon: Smartphone },
  { value: "credito", label: "Cartão Crédito", icon: CreditCard },
  { value: "debito", label: "Cartão Débito", icon: CreditCard },
  { value: "vale_gas", label: "Vale Gás", icon: Receipt },
  { value: "cheque", label: "Cheque", icon: Receipt },
];

const GAS_DO_POVO_OPTION = { value: "gas_do_povo", label: "Gás do Povo", icon: Flame };

export function PDVPayment({ open, onClose, total, onConfirm, isLoading, itens = [] }: PDVPaymentProps) {
  const [pagamentos, setPagamentos] = useState<PDVPagamento[]>([]);
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [valorParcial, setValorParcial] = useState("");
  const [taxaEntregaGasPovo, setTaxaEntregaGasPovo] = useState("");
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [pendingExtras, setPendingExtras] = useState<{ operadora_id?: string; conta_bancaria_id?: string; info?: string; parcelas?: number; taxa_extra?: number; taxa_desconto_percentual?: number } | null>(null);
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();

  const gasDoPovoHabilitado = !!(unidadeAtual as any)?.gas_do_povo_habilitado;
  const gasDoPovoValor = Number((unidadeAtual as any)?.gas_do_povo_valor ?? 101.08);
  const formasPagamento = gasDoPovoHabilitado
    ? [...formasPagamentoBase, GAS_DO_POVO_OPTION]
    : formasPagamentoBase;

  // Carrinho elegível: exatamente 1× Gás P13 (e somente esse item)
  const cartoElegivelGasDoPovo = (() => {
    if (itens.length !== 1) return false;
    const it = itens[0];
    if (it.quantidade !== 1) return false;
    return /g[áa]s\s*p13/i.test(it.nome);
  })();

  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  // Total efetivo = total do carrinho + taxas extras (ex.: taxa Gás do Povo).
  const totalTaxasExtras = pagamentos.reduce((acc, p) => acc + (Number(p.taxa_extra) || 0), 0);
  const totalEfetivo = total + totalTaxasExtras;
  const restante = Math.max(0, totalEfetivo - totalPago);
  const valorParcialNum = parseFloat(valorParcial.replace(",", ".")) || 0;


  // Reset on open
  useEffect(() => {
    if (open) {
      setPagamentos([]);
      setFormaPagamento("dinheiro");
      setValorParcial("");
      setTaxaEntregaGasPovo("");
      setPendingExtras(null);
    }
  }, [open]);

  // Pré-preenche valor parcial com restante quando muda forma ou restante
  useEffect(() => {
    if (restante > 0) {
      setValorParcial(restante.toFixed(2).replace(".", ","));
    } else {
      setValorParcial("");
    }
  }, [restante, formaPagamento]);

  const dinheiroPagamentos = pagamentos.filter((p) => p.forma === "dinheiro");
  const totalDinheiro = dinheiroPagamentos.reduce((acc, p) => acc + p.valor, 0);
  // troco: se total de dinheiro lançado cobre o que falta dos outros, sobra é troco
  const totalOutros = totalPago - totalDinheiro;
  const faltaAposOutros = Math.max(0, totalEfetivo - totalOutros);
  const troco = Math.max(0, totalDinheiro - faltaAposOutros);

  const podeFinalizar = totalPago >= totalEfetivo && pagamentos.length > 0;

  const preselectPreferredOperator = async (preferredOperator: string, fallbackInfo?: string) => {
    const resolvedUnidadeId = unidadeAtual?.id;
    if (!resolvedUnidadeId) {
      if (fallbackInfo) setPendingExtras({ info: fallbackInfo });
      return;
    }

    const { data } = await supabase
      .from("operadoras_cartao")
      .select("id, nome, conta_bancaria_id, prazo_credito")
      .eq("unidade_id", resolvedUnidadeId)
      .eq("ativo", true);

    const normalize = (text: string) =>
      text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const op = ((data || []) as any[]).find((item) => normalize(item.nome || "").includes(normalize(preferredOperator)));
    if (op) {
      setPendingExtras({
        operadora_id: op.id,
        conta_bancaria_id: op.conta_bancaria_id || undefined,
        info: `${op.nome} • Gás do Povo • D+${Number(op.prazo_credito) || 2}`,
      });
    } else if (fallbackInfo) {
      setPendingExtras({ info: fallbackInfo });
    }
  };

  const handleSelectForma = async (value: string) => {
    if (value === "gas_do_povo") {
      if (!cartoElegivelGasDoPovo) {
        toast({
          title: "Gás do Povo indisponível",
          description: "Aceito apenas para venda de exatamente 1× Gás P13.",
          variant: "destructive",
        });
        return;
      }
      setFormaPagamento(value);
      setPendingExtras({ info: `Programa Gás do Povo — R$ ${gasDoPovoValor.toFixed(2)} (D+2)` });
      await preselectPreferredOperator("azulzinha", `Programa Gás do Povo — R$ ${gasDoPovoValor.toFixed(2)} (D+2)`);
      setValorParcial(gasDoPovoValor.toFixed(2).replace(".", ","));
      return;
    }
    setFormaPagamento(value);
    setPendingExtras(null);
    if (value === "pix") {
      setPixModalOpen(true);
    } else if (value === "credito" || value === "debito" || value === "pix_maquininha") {
      setCardModalOpen(true);
    }
  };

  const addPagamento = () => {
    if (valorParcialNum <= 0) return;
    const needsCard = ["credito", "debito", "pix_maquininha"].includes(formaPagamento);
    const needsPix = formaPagamento === "pix";
    if (needsCard && !pendingExtras?.operadora_id) {
      setCardModalOpen(true);
      return;
    }
    if (needsPix && !pendingExtras?.conta_bancaria_id) {
      setPixModalOpen(true);
      return;
    }
    if (formaPagamento === "gas_do_povo") {
      if (!cartoElegivelGasDoPovo) {
        toast({
          title: "Carrinho inválido",
          description: "Gás do Povo aceito apenas para 1× Gás P13.",
          variant: "destructive",
        });
        return;
      }
      if (Math.abs(valorParcialNum - gasDoPovoValor) > 0.01) {
        toast({
          title: "Valor incorreto",
          description: `O valor do Gás do Povo é fixo em R$ ${gasDoPovoValor.toFixed(2)}.`,
          variant: "destructive",
        });
        return;
      }
      const taxaNum = parseFloat(taxaEntregaGasPovo.replace(",", ".")) || 0;
      const infoTaxa = taxaNum > 0 ? ` + Taxa entrega R$ ${taxaNum.toFixed(2)}` : "";
      setPagamentos((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          forma: formaPagamento,
          valor: valorParcialNum,
          operadora_id: pendingExtras?.operadora_id,
          conta_bancaria_id: pendingExtras?.conta_bancaria_id,
          info: `Programa Gás do Povo — R$ ${gasDoPovoValor.toFixed(2)} (D+2)${infoTaxa}`,
          taxa_extra: taxaNum > 0 ? taxaNum : undefined,
        },
      ]);

      setPendingExtras(null);
      if (taxaNum > 0) {
        // Prepara próxima entrada para a forma escolher onde a taxa foi recebida
        setFormaPagamento("dinheiro");
        setValorParcial(taxaNum.toFixed(2).replace(".", ","));
      } else {
        setFormaPagamento("dinheiro");
      }
      setTaxaEntregaGasPovo("");
      return;
    }
    setPagamentos((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        forma: formaPagamento,
        valor: valorParcialNum,
        operadora_id: pendingExtras?.operadora_id,
        conta_bancaria_id: pendingExtras?.conta_bancaria_id,
        info: pendingExtras?.info,
        parcelas: formaPagamento === "credito" ? pendingExtras?.parcelas || 1 : undefined,
        taxa_desconto_percentual: formaPagamento === "credito" ? pendingExtras?.taxa_desconto_percentual : undefined,
      },
    ]);
    setPendingExtras(null);
    setFormaPagamento("dinheiro");
  };

  const removePagamento = (id: string) => {
    setPagamentos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleConfirm = () => {
    onConfirm(pagamentos, totalDinheiro);
  };

  const cardTipo = formaPagamento === "credito" ? "credito" : formaPagamento === "pix_maquininha" ? "pix_maquininha" : "debito";
  const formaLabel = (f: string) => formasPagamento.find((x) => x.value === f)?.label || f;

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

          <div className="space-y-4">
            {/* Total / Restante */}
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary">R$ {total.toFixed(2)}</p>
              </div>
              <div className={`text-center p-3 rounded-lg ${restante > 0 ? "bg-destructive/10" : "bg-success/10"}`}>
                <p className="text-xs text-muted-foreground">Restante</p>
                <p className={`text-2xl font-bold ${restante > 0 ? "text-destructive" : "text-success"}`}>
                  R$ {restante.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Lista de pagamentos adicionados */}
            {pagamentos.length > 0 && (
              <div className="space-y-1 border rounded-lg p-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide px-1">Pagamentos</p>
                {pagamentos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-sm p-2 rounded bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{formaLabel(p.forma)}</p>
                      {p.info && <p className="text-xs text-muted-foreground truncate">{p.info}</p>}
                    </div>
                    <span className="font-semibold shrink-0">R$ {p.valor.toFixed(2)}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removePagamento(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Seletor forma + valor (só se ainda há restante) */}
            {restante > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {formasPagamento.map((forma) => {
                      const Icon = forma.icon;
                      return (
                        <Button
                          key={forma.value}
                          type="button"
                          variant={formaPagamento === forma.value ? "default" : "outline"}
                          className="h-12 flex-col gap-0.5"
                          onClick={() => handleSelectForma(forma.value)}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-[11px]">{forma.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {pendingExtras?.info && (
                  <div className="p-2 rounded-lg bg-success/10 text-success text-xs text-center font-medium">
                    {pendingExtras.info}
                  </div>
                )}

                {formaPagamento === "gas_do_povo" && (
                  <div className="space-y-2 p-2 rounded-lg border border-dashed">
                    <Label className="text-xs">Taxa de entrega (opcional)</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={taxaEntregaGasPovo}
                      onChange={(e) => setTaxaEntregaGasPovo(e.target.value)}
                      className="text-base text-center font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Cobrada à parte do Gás do Povo. Após adicionar, escolha a forma de recebimento da taxa.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Valor</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={valorParcial}
                      onChange={(e) => setValorParcial(e.target.value)}
                      className="text-lg text-center font-mono"
                    />
                    <Button type="button" onClick={addPagamento} disabled={valorParcialNum <= 0} className="shrink-0">
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Troco */}
            {troco > 0 && (
              <div className="text-center p-3 bg-success/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Troco</p>
                <p className="text-2xl font-bold text-success">R$ {troco.toFixed(2)}</p>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-2 w-full min-w-0">
              <Button variant="outline" className="flex-1 h-11 min-w-0" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1 h-11 min-w-0"
                disabled={!podeFinalizar || isLoading}
                onClick={handleConfirm}
              >
                {isLoading ? "Processando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIX Key Selector */}
      <PixKeySelectorModal
        open={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        valor={valorParcialNum > 0 ? valorParcialNum : restante}
        beneficiario={unidadeAtual?.nome}
        preferredBank="itau"
        onSelect={(_chavePix, contaBancariaId) => {
          setPendingExtras({ conta_bancaria_id: contaBancariaId, info: "PIX via conta selecionada" });
        }}
      />

      {/* Card Operator Selector */}
      <CardOperatorSelectorModal
        open={cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        valor={valorParcialNum > 0 ? valorParcialNum : restante}
        tipoCartao={cardTipo}
        parcelasInicial={pendingExtras?.parcelas || 1}
        preferredOperator={formaPagamento === "pix_maquininha" ? "pagbank" : undefined}
        applyInstallmentSurcharge
        onSelect={(op) => {
          const parcelasInfo = formaPagamento === "credito" ? ` • Crédito ${op.parcelas || 1}x` : "";
          const descontoInfo = op.taxaParcelamentoPercentual && op.taxaParcelamentoPercentual > 0 ? ` • Desc. parc. ${op.taxaParcelamentoPercentual.toFixed(2)}%` : "";
          const taxaInfo = op.taxaTotal && op.taxaTotal > op.taxa ? op.taxaTotal : op.taxa;
          setPendingExtras({
            operadora_id: op.id,
            conta_bancaria_id: op.conta_bancaria_id || undefined,
            parcelas: formaPagamento === "credito" ? op.parcelas || 1 : undefined,
            taxa_desconto_percentual: formaPagamento === "credito" ? op.taxaParcelamentoPercentual || undefined : undefined,
            info: `${op.nome}${parcelasInfo}${descontoInfo} • Taxa total ${taxaInfo.toFixed(2)}% • D+${op.prazo}`,
          });
        }}
      />
    </>
  );
}
