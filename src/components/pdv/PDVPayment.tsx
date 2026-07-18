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

export interface PDVPagamento {
  id: string;
  forma: string;
  valor: number;
  operadora_id?: string;
  conta_bancaria_id?: string;
  info?: string;
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
  const [pendingExtras, setPendingExtras] = useState<{ operadora_id?: string; conta_bancaria_id?: string; info?: string } | null>(null);
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


  const handleSelectForma = (value: string) => {
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

  const quickValues = [10, 20, 50, 100];

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Finalizar venda
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 space-y-4">
            {/* Total em destaque no topo */}
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Total</span>
                <span className="text-2xl font-bold tabular-nums text-foreground">R$ {total.toFixed(2)}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">Restante</span>
                <span className={`font-semibold tabular-nums ${restante > 0 ? "text-destructive" : "text-success"}`}>
                  R$ {restante.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Lista de pagamentos adicionados */}
            {pagamentos.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground font-semibold px-3 py-1.5 bg-muted/40 border-b border-border">Pagamentos</p>
                <ul className="divide-y divide-border">
                  {pagamentos.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate leading-tight">{formaLabel(p.forma)}</p>
                        {p.info && <p className="text-[11px] text-muted-foreground truncate">{p.info}</p>}
                      </div>
                      <span className="font-semibold shrink-0 tabular-nums">R$ {p.valor.toFixed(2)}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removePagamento(p.id)} aria-label="Remover">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Seletor forma + valor (só se ainda há restante) */}
            {restante > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Forma de pagamento</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {formasPagamento.map((forma) => {
                      const Icon = forma.icon;
                      const active = formaPagamento === forma.value;
                      return (
                        <Button
                          key={forma.value}
                          type="button"
                          variant={active ? "default" : "outline"}
                          className="h-14 flex-col gap-1 rounded-lg px-1"
                          onClick={() => handleSelectForma(forma.value)}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-[10.5px] leading-none">{forma.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {pendingExtras?.info && (
                  <div className="px-3 py-2 rounded-lg bg-success/10 text-success text-[11px] text-center font-medium">
                    {pendingExtras.info}
                  </div>
                )}

                {formaPagamento === "gas_do_povo" && (
                  <div className="space-y-1.5 p-3 rounded-lg border border-dashed border-border bg-muted/30">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Taxa de entrega (opcional)</Label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={taxaEntregaGasPovo}
                      onChange={(e) => setTaxaEntregaGasPovo(e.target.value)}
                      className="h-10 text-base text-center font-mono tabular-nums"
                    />
                    <p className="text-[10.5px] text-muted-foreground">
                      Cobrada à parte. Após adicionar, escolha a forma de recebimento da taxa.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor recebido</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={valorParcial}
                      onChange={(e) => setValorParcial(e.target.value)}
                      className="h-11 text-lg text-center font-mono tabular-nums"
                    />
                    <Button type="button" onClick={addPagamento} disabled={valorParcialNum <= 0} className="shrink-0 h-11 px-3 rounded-lg">
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {formaPagamento === "dinheiro" && (
                    <div className="grid grid-cols-5 gap-1.5">
                      {quickValues.map((v) => (
                        <Button
                          key={v}
                          type="button"
                          variant="outline"
                          className="h-9 rounded-lg text-xs font-semibold px-0 tabular-nums"
                          onClick={() => setValorParcial(v.toFixed(2).replace(".", ","))}
                        >
                          {v}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-lg text-xs font-semibold px-0"
                        onClick={() => setValorParcial(restante.toFixed(2).replace(".", ","))}
                      >
                        Exato
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Troco */}
            {troco > 0 && (
              <div className="flex items-baseline justify-between px-4 py-2.5 rounded-lg bg-success/10">
                <span className="text-xs font-semibold uppercase tracking-wide text-success">Troco</span>
                <span className="text-xl font-bold tabular-nums text-success">R$ {troco.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Botões fixos no footer */}
          <div className="flex gap-2 px-5 py-4 border-t border-border bg-muted/20">
            <Button variant="outline" className="flex-1 h-11 min-w-0 rounded-lg" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-[1.5] h-11 min-w-0 rounded-lg font-semibold"
              disabled={!podeFinalizar || isLoading}
              onClick={handleConfirm}
            >
              {isLoading ? "Processando..." : "Confirmar venda"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIX Key Selector */}
      <PixKeySelectorModal
        open={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        valor={valorParcialNum > 0 ? valorParcialNum : restante}
        beneficiario={unidadeAtual?.nome}
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
        onSelect={(op) => {
          setPendingExtras({
            operadora_id: op.id,
            info: `${op.nome} • Taxa ${op.taxa.toFixed(2)}% • D+${op.prazo}`,
          });
        }}
      />
    </>
  );
}
