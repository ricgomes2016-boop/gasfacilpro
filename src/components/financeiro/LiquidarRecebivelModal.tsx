import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import {
  Banknote,
  Smartphone,
  CreditCard,
  ArrowLeftRight,
  FileText,
  Receipt,
  Trash2,
  Plus,
  DollarSign,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { getBrasiliaDateString } from "@/lib/utils";
import { CardOperatorSelectorModal } from "@/components/pagamento/CardOperatorSelectorModal";
import { PixKeySelectorModal } from "@/components/pagamento/PixKeySelectorModal";
import {
  liquidarRecebivel,
  type LinhaLiquidacao,
  type RecebivelParaLiquidar,
} from "@/services/liquidarRecebivelService";

interface LiquidarRecebivelModalProps {
  open: boolean;
  onClose: () => void;
  conta: RecebivelParaLiquidar | null;
  onSuccess?: () => void;
  dataMinima?: string; // ex: data da venda
}

type FormaSlug = LinhaLiquidacao["forma"];

const FORMA_META: Record<
  FormaSlug,
  { label: string; icon: any; needs: "operadora" | "chave_pix" | "banco" | "cheque" | null; auto: boolean }
> = {
  dinheiro: { label: "Dinheiro", icon: Banknote, needs: null, auto: true },
  pix: { label: "PIX (chave)", icon: Smartphone, needs: "chave_pix", auto: false },
  pix_maquininha: { label: "PIX Maquininha", icon: Smartphone, needs: "operadora", auto: false },
  cartao_debito: { label: "Cartão Débito", icon: CreditCard, needs: "operadora", auto: false },
  cartao_credito: { label: "Cartão Crédito", icon: CreditCard, needs: "operadora", auto: false },
  transferencia: { label: "Transferência/TED", icon: ArrowLeftRight, needs: "banco", auto: false },
  boleto_pago: { label: "Boleto pago", icon: FileText, needs: "banco", auto: false },
  cheque: { label: "Cheque", icon: Receipt, needs: "cheque", auto: false },
};

interface Linha extends LinhaLiquidacao {
  _uid: string;
  _configurado: boolean;
}

function novaLinha(valor = 0): Linha {
  return {
    _uid: Math.random().toString(36).slice(2),
    _configurado: true,
    forma: "dinheiro",
    valor,
  };
}

export function LiquidarRecebivelModal({
  open,
  onClose,
  conta,
  onSuccess,
  dataMinima,
}: LiquidarRecebivelModalProps) {
  const hoje = getBrasiliaDateString();
  const [dataRec, setDataRec] = useState(hoje);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [saving, setSaving] = useState(false);
  const [cardModal, setCardModal] = useState<{ idx: number; tipo: "debito" | "credito" | "pix_maquininha" } | null>(null);
  const [pixModal, setPixModal] = useState<{ idx: number } | null>(null);
  const [contasBancarias, setContasBancarias] = useState<Array<{ id: string; nome: string; banco: string }>>([]);

  useEffect(() => {
    if (!open || !conta) return;
    setDataRec(hoje);
    setLinhas([{ ...novaLinha(Number(conta.valor) || 0), _configurado: true }]);
  }, [open, conta]);

  useEffect(() => {
    if (!open || !conta?.unidade_id) return;
    supabase
      .from("contas_bancarias")
      .select("id, nome, banco")
      .eq("unidade_id", conta.unidade_id)
      .eq("ativo", true)
      .then(({ data }) => setContasBancarias((data as any) || []));
  }, [open, conta?.unidade_id]);

  const totalPago = useMemo(() => linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0), [linhas]);
  const valorConta = Number(conta?.valor) || 0;
  const parcial = totalPago < valorConta - 0.01;
  const excede = totalPago > valorConta + 0.01;

  const podeConfirmar =
    !!conta &&
    !!dataRec &&
    totalPago > 0 &&
    !excede &&
    linhas.every((l) => l.valor > 0 && l._configurado);

  const addLinha = () => {
    const restante = Math.max(0, valorConta - totalPago);
    setLinhas((p) => [...p, novaLinha(restante)]);
  };
  const removeLinha = (uid: string) =>
    setLinhas((p) => (p.length > 1 ? p.filter((l) => l._uid !== uid) : p));
  const updateLinha = (uid: string, patch: Partial<Linha>) =>
    setLinhas((p) => p.map((l) => (l._uid === uid ? { ...l, ...patch } : l)));

  const onSelectForma = (uid: string, forma: FormaSlug) => {
    const meta = FORMA_META[forma];
    updateLinha(uid, {
      forma,
      operadora_id: undefined,
      operadora_nome: undefined,
      operadora_taxa: undefined,
      operadora_prazo: undefined,
      operadora_conta_bancaria_id: undefined,
      chave_pix: undefined,
      conta_bancaria_id: undefined,
      terminal_id: undefined,
      cheque_numero: undefined,
      cheque_banco: undefined,
      cheque_bom_para: undefined,
      parcelas: forma === "cartao_credito" ? 1 : undefined,
      _configurado: meta.auto,
    });
    // Abre modais quando aplicável
    const idx = linhas.findIndex((l) => l._uid === uid);
    if (forma === "pix") setPixModal({ idx });
    else if (forma === "pix_maquininha") setCardModal({ idx, tipo: "pix_maquininha" });
    else if (forma === "cartao_debito") setCardModal({ idx, tipo: "debito" });
    else if (forma === "cartao_credito") setCardModal({ idx, tipo: "credito" });
  };

  const handleConfirmar = async () => {
    if (!conta) return;
    if (dataMinima && dataRec < dataMinima) {
      toast.error(
        `A data do recebimento não pode ser anterior à data da venda (${format(
          new Date(dataMinima + "T12:00:00"),
          "dd/MM/yyyy"
        )})`
      );
      return;
    }
    if (dataRec > hoje) {
      toast.error("A data do recebimento não pode ser posterior a hoje.");
      return;
    }
    if (excede) {
      toast.error("Total pago excede o valor da conta.");
      return;
    }
    setSaving(true);
    try {
      const payload: LinhaLiquidacao[] = linhas.map(({ _uid, _configurado, ...rest }) => rest);
      const res = await liquidarRecebivel(conta, payload, dataRec);
      if (res.parcial) {
        toast.success(`Recebido parcial R$ ${res.totalPago.toFixed(2)} — Restante R$ ${res.restante.toFixed(2)}`);
      } else {
        toast.success(`Conta liquidada em ${format(new Date(dataRec + "T12:00:00"), "dd/MM/yyyy")}!`);
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error("Erro ao liquidar: " + (err.message || "erro"));
    } finally {
      setSaving(false);
    }
  };

  const currentCardLinha = cardModal !== null ? linhas[cardModal.idx] : null;
  const currentPixLinha = pixModal !== null ? linhas[pixModal.idx] : null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Liquidar / Receber
            </DialogTitle>
          </DialogHeader>

          {conta && (
            <div className="space-y-4 pt-2">
              {/* Cabeçalho */}
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Cliente</p>
                    <p className="truncate text-base font-semibold">{conta.cliente || "Cliente"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{conta.descricao}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total a receber</p>
                    <p className="text-2xl font-bold">
                      R$ {valorConta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Data */}
              <div>
                <Label className="text-sm">Data do recebimento *</Label>
                <Input
                  type="date"
                  className="mt-1"
                  min={dataMinima || undefined}
                  max={hoje}
                  value={dataRec}
                  onChange={(e) => setDataRec(e.target.value)}
                />
              </div>

              {/* Linhas de pagamento */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Formas de pagamento</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLinha} className="h-8 gap-1">
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                </div>

                {linhas.map((linha, idx) => {
                  const meta = FORMA_META[linha.forma];
                  const Icon = meta.icon;
                  return (
                    <div key={linha._uid} className="rounded-lg border p-3 space-y-2 bg-card">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[180px] flex-1">
                          <Label className="text-[11px] text-muted-foreground">Forma</Label>
                          <Select
                            value={linha.forma}
                            onValueChange={(v) => onSelectForma(linha._uid, v as FormaSlug)}
                          >
                            <SelectTrigger className="mt-1 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(FORMA_META) as FormaSlug[]).map((k) => {
                                const M = FORMA_META[k];
                                return (
                                  <SelectItem key={k} value={k}>
                                    <span className="flex items-center gap-2">
                                      <M.icon className="h-3.5 w-3.5" />
                                      {M.label}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-[130px]">
                          <Label className="text-[11px] text-muted-foreground">Valor (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="mt-1 h-9"
                            value={linha.valor}
                            onChange={(e) =>
                              updateLinha(linha._uid, { valor: parseFloat(e.target.value) || 0 })
                            }
                          />
                        </div>
                        {linhas.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => removeLinha(linha._uid)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      {/* Detalhes por forma */}
                      {meta.needs === "operadora" && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {linha.operadora_nome ? (
                            <Badge variant="secondary" className="gap-1">
                              <Icon className="h-3 w-3" />
                              {linha.operadora_nome} · {linha.operadora_taxa?.toFixed(2)}% · D+
                              {linha.operadora_prazo}
                              {linha.parcelas && linha.parcelas > 1 ? ` · ${linha.parcelas}x` : ""}
                            </Badge>
                          ) : (
                            <span className="text-xs text-warning flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> Escolha a operadora
                            </span>
                          )}
                          {linha.forma === "cartao_credito" && linha.operadora_nome && (
                            <div className="ml-auto flex items-center gap-1">
                              <Label className="text-[11px] text-muted-foreground">Parcelas</Label>
                              <Select
                                value={String(linha.parcelas || 1)}
                                onValueChange={(v) => updateLinha(linha._uid, { parcelas: Number(v) })}
                              >
                                <SelectTrigger className="h-7 w-[70px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                                    <SelectItem key={n} value={String(n)}>
                                      {n}x
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7"
                            onClick={() =>
                              setCardModal({
                                idx,
                                tipo:
                                  linha.forma === "cartao_credito"
                                    ? "credito"
                                    : linha.forma === "cartao_debito"
                                    ? "debito"
                                    : "pix_maquininha",
                              })
                            }
                          >
                            {linha.operadora_nome ? "Trocar" : "Escolher"}
                          </Button>
                        </div>
                      )}

                      {meta.needs === "chave_pix" && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {linha.chave_pix ? (
                            <Badge variant="secondary" className="gap-1">
                              <Smartphone className="h-3 w-3" /> {linha.chave_pix.slice(0, 24)}
                              {linha.chave_pix.length > 24 ? "…" : ""}
                            </Badge>
                          ) : (
                            <span className="text-xs text-warning flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> Escolha a chave PIX
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 ml-auto"
                            onClick={() => setPixModal({ idx })}
                          >
                            {linha.chave_pix ? "Trocar" : "Escolher"}
                          </Button>
                        </div>
                      )}

                      {meta.needs === "banco" && (
                        <div className="pt-1">
                          <Label className="text-[11px] text-muted-foreground">Conta destino</Label>
                          <Select
                            value={linha.conta_bancaria_id || ""}
                            onValueChange={(v) =>
                              updateLinha(linha._uid, {
                                conta_bancaria_id: v,
                                _configurado: !!v,
                              })
                            }
                          >
                            <SelectTrigger className="mt-1 h-9">
                              <SelectValue placeholder="Escolha a conta bancária" />
                            </SelectTrigger>
                            <SelectContent>
                              {contasBancarias.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.nome} · {c.banco}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {meta.needs === "cheque" && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Nº Cheque</Label>
                            <Input
                              className="mt-1 h-9"
                              value={linha.cheque_numero || ""}
                              onChange={(e) =>
                                updateLinha(linha._uid, {
                                  cheque_numero: e.target.value,
                                  _configurado: !!e.target.value && !!linha.cheque_banco,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Banco</Label>
                            <Input
                              className="mt-1 h-9"
                              value={linha.cheque_banco || ""}
                              onChange={(e) =>
                                updateLinha(linha._uid, {
                                  cheque_banco: e.target.value,
                                  _configurado: !!e.target.value && !!linha.cheque_numero,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-muted-foreground">Bom para</Label>
                            <Input
                              type="date"
                              className="mt-1 h-9"
                              value={linha.cheque_bom_para || ""}
                              onChange={(e) => updateLinha(linha._uid, { cheque_bom_para: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resumo */}
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Total pago</span>
                  <span className="font-semibold">
                    R$ {totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {parcial && !excede && (
                  <div className="flex justify-between text-warning">
                    <span>Restante (fica pendente)</span>
                    <span className="font-semibold">
                      R$ {(valorConta - totalPago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {excede && (
                  <p className="text-destructive text-xs flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Total excede o valor da conta
                  </p>
                )}
                {!parcial && !excede && (
                  <p className="text-success text-xs flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Cobre 100% do recebível
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmar} disabled={!podeConfirmar || saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando…
                    </>
                  ) : (
                    "Confirmar recebimento"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modais auxiliares */}
      {cardModal !== null && currentCardLinha && (
        <CardOperatorSelectorModal
          open={cardModal !== null}
          onClose={() => setCardModal(null)}
          valor={Number(currentCardLinha.valor) || 0}
          tipoCartao={cardModal.tipo}
          unidadeId={conta?.unidade_id || undefined}
          parcelasInicial={currentCardLinha.parcelas || 1}
          onSelect={(op) => {
            const uid = currentCardLinha._uid;
            updateLinha(uid, {
              operadora_id: op.id,
              operadora_nome: op.nome,
              operadora_taxa: op.taxa,
              operadora_prazo: op.prazo,
              operadora_conta_bancaria_id: op.conta_bancaria_id || null,
              parcelas: cardModal.tipo === "credito" ? op.parcelas || 1 : undefined,
              _configurado: true,
            });
          }}
        />
      )}

      {pixModal !== null && currentPixLinha && (
        <PixKeySelectorModal
          open={pixModal !== null}
          onClose={() => setPixModal(null)}
          valor={Number(currentPixLinha.valor) || 0}
          beneficiario={conta?.cliente || undefined}
          unidadeId={conta?.unidade_id || undefined}
          onSelect={(chave, contaId) => {
            const uid = currentPixLinha._uid;
            updateLinha(uid, {
              chave_pix: chave,
              conta_bancaria_id: contaId,
              _configurado: true,
            });
          }}
        />
      )}
    </>
  );
}
