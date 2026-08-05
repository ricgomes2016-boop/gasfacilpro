import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, CheckCircle, Clock, Percent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { prazoOperadoraD0 } from "@/lib/financeiro/operadoraRecebimento";

interface Operadora {
  id: string;
  nome: string;
  bandeira: string;
  taxa_debito: number;
  taxa_credito_vista: number;
  taxa_credito_parcelado: number;
  prazo_debito: number;
  prazo_credito: number;
  taxa_pix: number | null;
  prazo_pix: number | null;
  conta_bancaria_id: string | null;
  conta_bancaria?: { id: string; nome: string; banco: string } | null;
}

interface CardOperatorSelectorModalProps {
  open: boolean;
  onClose: () => void;
  valor: number;
  tipoCartao: "debito" | "credito" | "pix_maquininha";
  unidadeId?: string;
  parcelasInicial?: number;
  preferredOperator?: string;
  applyInstallmentSurcharge?: boolean;
  onSelect: (operadora: { id: string; nome: string; taxa: number; prazo: number; valorLiquido: number; conta_bancaria_id?: string | null; parcelas?: number; taxaParcelamentoPercentual?: number; taxaParcelamentoValor?: number; taxaTotal?: number }) => void;
}

const JUROS_CREDITO_PARCELADO_MENSAL = 1.99;
const TAXA_CREDITO_PARCELADO_BASE = 4.99;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function CardOperatorSelectorModal({
  open,
  onClose,
  valor,
  tipoCartao,
  unidadeId: externalUnidadeId,
  parcelasInicial = 1,
  preferredOperator,
  applyInstallmentSurcharge = false,
  onSelect,
}: CardOperatorSelectorModalProps) {
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState(parcelasInicial);
  const [loading, setLoading] = useState(true);
  const { unidadeAtual } = useUnidade();

  const resolvedUnidadeId = externalUnidadeId || unidadeAtual?.id;

  useEffect(() => {
    if (!open || !resolvedUnidadeId) return;
    setParcelas(tipoCartao === "credito" ? Math.max(1, parcelasInicial || 1) : 1);
    setLoading(true);
    supabase
      .from("operadoras_cartao")
      .select("*, conta_bancaria:contas_bancarias(id,nome,banco)")
      .eq("unidade_id", resolvedUnidadeId)
      .eq("ativo", true)
      .then(({ data }) => {
        const items = (data || []) as any as Operadora[];
        setOperadoras(items);
        const preferred = preferredOperator
          ? items.find((item) => normalizeText(item.nome).includes(normalizeText(preferredOperator)))
          : null;
        if (preferred) setSelected(preferred.id);
        else if (items.length === 1) setSelected(items[0].id);
        else setSelected(null);
        setLoading(false);
      });
  }, [open, resolvedUnidadeId, tipoCartao, parcelasInicial, preferredOperator]);

  const getTaxaEPrazo = (op: Operadora) => {
    switch (tipoCartao) {
      case "debito":
        return { taxa: Number(op.taxa_debito) || 0, prazo: prazoOperadoraD0({ nome: op.nome, prazoCadastro: op.prazo_debito, prazoPadrao: 1 }) };
      case "credito":
        return {
          taxa: parcelas > 1 && applyInstallmentSurcharge
            ? TAXA_CREDITO_PARCELADO_BASE
            : parcelas > 1
              ? Number(op.taxa_credito_parcelado) || 0
              : Number(op.taxa_credito_vista) || 0,
          prazo: prazoOperadoraD0({ nome: op.nome, prazoCadastro: op.prazo_credito, prazoPadrao: 30 }),
        };
      case "pix_maquininha":
        return { taxa: Number(op.taxa_pix) || 0, prazo: prazoOperadoraD0({ nome: op.nome, prazoCadastro: op.prazo_pix, prazoPadrao: 0 }) };
      default:
        return { taxa: 0, prazo: 0 };
    }
  };

  const tipoLabel = {
    debito: "Débito",
    credito: "Crédito",
    pix_maquininha: "PIX Maquininha",
  }[tipoCartao];

  const selectedOp = operadoras.find((o) => o.id === selected);
  const taxaParcelamentoPercentual = applyInstallmentSurcharge && tipoCartao === "credito" && parcelas > 1
    ? JUROS_CREDITO_PARCELADO_MENSAL * (parcelas - 1)
    : 0;
  const taxaParcelamentoValor = valor * (taxaParcelamentoPercentual / 100);

  const handleConfirm = () => {
    if (!selectedOp) return;
    const { taxa, prazo } = getTaxaEPrazo(selectedOp);
    const taxaTotal = taxa + taxaParcelamentoPercentual;
    const valorLiquido = valor - valor * (taxaTotal / 100);
    onSelect({
      id: selectedOp.id,
      nome: selectedOp.nome,
      taxa,
      prazo,
      valorLiquido,
      conta_bancaria_id: selectedOp.conta_bancaria_id || null,
      parcelas: tipoCartao === "credito" ? parcelas : undefined,
      taxaParcelamentoPercentual,
      taxaParcelamentoValor,
      taxaTotal,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Selecionar Operadora — {tipoLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total */}
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <p className="text-xs text-muted-foreground">Valor Bruto</p>
            <p className="text-2xl font-bold text-primary">
              R$ {valor.toFixed(2)}
            </p>
          </div>

          {tipoCartao === "credito" && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Parcelas do crédito
              </p>
              <Select value={String(parcelas)} onValueChange={(value) => setParcelas(Number(value))}>
                <SelectTrigger className="h-11 bg-background">
                  <SelectValue placeholder="Selecione as parcelas" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x {n > 1 ? `de R$ ${(valor / n).toFixed(2)}` : "à vista"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-[11px] text-muted-foreground">
                1x usa a taxa de crédito à vista; 2x ou mais desconta 1,99% ao mês do valor líquido.
              </p>
            </div>
          )}

          {tipoCartao === "credito" && parcelas > 1 && (
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-warning/5 p-3 text-center">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Base</p>
                <p className="text-sm font-bold">R$ {valor.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Desconto</p>
                <p className="text-sm font-bold text-warning">-R$ {taxaParcelamentoValor.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Cobrado</p>
                <p className="text-sm font-bold text-primary">R$ {valor.toFixed(2)}</p>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-center text-muted-foreground text-sm py-4">Carregando operadoras...</p>
          ) : operadoras.length === 0 ? (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
              Nenhuma operadora cadastrada para esta unidade.
            </div>
          ) : (
            <div className="space-y-2">
              {operadoras.map((op) => {
                const { taxa, prazo } = getTaxaEPrazo(op);
                const taxaTotal = taxa + taxaParcelamentoPercentual;
                const liquido = valor - valor * (taxaTotal / 100);
                const isSelected = selected === op.id;

                return (
                  <button
                    key={op.id}
                    onClick={() => setSelected(op.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-sm truncate">{op.nome}</span>
                        {op.bandeira && (
                          <Badge variant="secondary" className="text-[10px]">
                            {op.bandeira}
                          </Badge>
                        )}
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    {op.conta_bancaria ? (
                      <p className="text-[11px] text-muted-foreground mb-2">
                        💰 Recebe em: <span className="font-medium text-foreground">{op.conta_bancaria.nome}</span> ({op.conta_bancaria.banco})
                      </p>
                    ) : (
                      <p className="text-[11px] text-warning mb-2">⚠ Sem conta vinculada — defina em Operadora › Configuração</p>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-muted/50 rounded">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                          <Percent className="h-3 w-3" />
                          <span className="text-[10px] uppercase">Taxa</span>
                        </div>
                        <p className="text-sm font-bold">{taxaTotal.toFixed(2)}%</p>
                      </div>
                      <div className="p-2 bg-muted/50 rounded">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                          <Clock className="h-3 w-3" />
                          <span className="text-[10px] uppercase">Prazo</span>
                        </div>
                        <p className="text-sm font-bold">D+{prazo}</p>
                      </div>
                      <div className="p-2 bg-success/10 rounded">
                        <span className="text-[10px] uppercase text-muted-foreground">Líquido</span>
                        <p className="text-sm font-bold text-success">
                          R$ {liquido.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Resumo selecionado */}
          {selectedOp && (
            <div className="p-3 bg-muted/30 rounded-lg border border-dashed space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Resumo</p>
              <div className="flex justify-between text-sm">
                <span>Operadora</span>
                <span className="font-semibold">{selectedOp.nome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Taxa ({tipoLabel})</span>
                <span className="font-semibold">{(getTaxaEPrazo(selectedOp).taxa + taxaParcelamentoPercentual).toFixed(2)}%</span>
              </div>
              {tipoCartao === "credito" && taxaParcelamentoPercentual > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Desconto parcelamento</span>
                  <span className="font-semibold">-{taxaParcelamentoPercentual.toFixed(2)}%</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Valor cobrado</span>
                <span className="font-semibold">R$ {valor.toFixed(2)}</span>
              </div>
              {tipoCartao === "credito" && (
                <div className="flex justify-between text-sm">
                  <span>Parcelas</span>
                  <span className="font-semibold">{parcelas}x</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Recebe em</span>
                <span className="font-semibold">D+{getTaxaEPrazo(selectedOp).prazo}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t">
                <span>Valor Líquido</span>
                <span className="text-success">
                  R$ {(valor - valor * ((getTaxaEPrazo(selectedOp).taxa + taxaParcelamentoPercentual) / 100)).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!selectedOp}
              onClick={handleConfirm}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
