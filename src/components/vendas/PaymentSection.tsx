import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreditCard, Plus, Trash2, AlertCircle, CheckCircle2, Camera, ImageIcon, Loader2, Info } from "lucide-react";
import { cn, getBrasiliaDateString } from "@/lib/utils";
import { formatCurrency, parseCurrency } from "@/hooks/useInputMasks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { PixKeySelectorModal } from "@/components/pagamento/PixKeySelectorModal";
import { CardOperatorSelectorModal } from "@/components/pagamento/CardOperatorSelectorModal";
import { useUnidade } from "@/contexts/UnidadeContext";

export interface Pagamento {
  id: string;
  forma: string;
  valor: number;
  // Cheque extras
  cheque_numero?: string;
  cheque_banco?: string;
  cheque_foto_url?: string;
  // Fiado extras
  data_vencimento_fiado?: string;
  // Operator/PIX extras
  operadora_id?: string;
  operadora_nome?: string;
  conta_bancaria_id?: string;
}

interface PaymentSectionProps {
  pagamentos: Pagamento[];
  onChange: (pagamentos: Pagamento[]) => void;
  totalVenda: number;
  unidadeId?: string;
}

const formasPagamento = [
  { value: "dinheiro", label: "Dinheiro", icon: "💵" },
  { value: "pix", label: "PIX", icon: "📱" },
  { value: "pix_maquininha", label: "PIX Maquininha", icon: "📱" },
  { value: "cartao_debito", label: "Cartão Débito", icon: "💳" },
  { value: "cartao_credito", label: "Cartão Crédito", icon: "💳" },
  { value: "boleto", label: "Boleto", icon: "📄" },
  { value: "vale_gas", label: "Vale Gás", icon: "🔥" },
  { value: "cheque", label: "Cheque", icon: "🧾" },
  { value: "fiado", label: "Fiado / A Prazo", icon: "📝" },
  
];

export function PaymentSection({ pagamentos, onChange, totalVenda, unidadeId }: PaymentSectionProps) {
  const [forma, setForma] = useState("");
  const [valorDisplay, setValorDisplay] = useState("");
  const [chequeNumero, setChequeNumero] = useState("");
  const [chequeBanco, setChequeBanco] = useState("");
  const [chequeFotoUrl, setChequeFotoUrl] = useState<string | null>(null);
  const [isUploadingCheque, setIsUploadingCheque] = useState(false);
  const [dataVencimentoFiado, setDataVencimentoFiado] = useState("");
  const [chequeDialogOpen, setChequeDialogOpen] = useState(false);
  const chequePhotoRef = useRef<HTMLInputElement>(null);
  const chequeCameraRef = useRef<HTMLInputElement>(null);

  // Selector modals
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [pendingOperadora, setPendingOperadora] = useState<{ id: string; nome: string } | null>(null);
  const [pendingContaBancaria, setPendingContaBancaria] = useState<string | null>(null);
  const [pendingCardInfo, setPendingCardInfo] = useState<string | null>(null);

  const { unidadeAtual } = useUnidade();
  const effectiveUnidadeNome = unidadeId ? undefined : unidadeAtual?.nome;

  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const diferenca = totalVenda - totalPago;

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setValorDisplay(formatted);
  };

  const handleChequeFoto = async (file: File) => {
    setIsUploadingCheque(true);
    try {
      const compressed = await compressImage(file);
      const blob = await (await fetch(compressed)).blob();
      const fileName = `cheques/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error } = await supabase.storage.from("product-images").upload(fileName, blob, { cacheControl: "3600" });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
      setChequeFotoUrl(urlData.publicUrl);
      toast.success("Foto enviada! Extraindo dados...");

      try {
        const { data: ocrData, error: ocrError } = await supabase.functions.invoke("parse-cheque-photo", {
          body: { image_url: urlData.publicUrl },
        });
        if (!ocrError && ocrData?.success && ocrData.data) {
          const d = ocrData.data;
          if (d.numero_cheque) setChequeNumero(d.numero_cheque);
          if (d.banco_emitente) setChequeBanco(d.banco_emitente);
          toast.success("Dados do cheque preenchidos automaticamente!");
        } else {
          toast.info("Não foi possível extrair dados. Preencha manualmente.");
        }
      } catch {
        toast.info("OCR indisponível. Preencha manualmente.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar foto");
    } finally {
      setIsUploadingCheque(false);
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxW = 1200;
          const scale = Math.min(1, maxW / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const resetExtraFields = () => {
    setChequeNumero("");
    setChequeBanco("");
    setChequeFotoUrl(null);
    setDataVencimentoFiado("");
    setPendingOperadora(null);
    setPendingContaBancaria(null);
    setPendingCardInfo(null);
  };

  const addPagamento = () => {
    const valorNum = parseCurrency(valorDisplay);
    if (!forma || valorNum <= 0) return;

    if (forma === "cheque" && (!chequeNumero || !chequeBanco)) {
      toast.error("Preencha o número e banco do cheque");
      return;
    }

    const novoPagamento: Pagamento = {
      id: crypto.randomUUID(),
      forma,
      valor: valorNum,
    };

    if (forma === "cheque") {
      novoPagamento.cheque_numero = chequeNumero;
      novoPagamento.cheque_banco = chequeBanco;
      novoPagamento.cheque_foto_url = chequeFotoUrl || undefined;
    }

    if (forma === "fiado") {
      novoPagamento.data_vencimento_fiado = dataVencimentoFiado || format(addDays(new Date(), 30), "yyyy-MM-dd");
    }

    // Attach operator/PIX info
    if (pendingOperadora) {
      novoPagamento.operadora_id = pendingOperadora.id;
      novoPagamento.operadora_nome = pendingOperadora.nome;
    }
    if (pendingContaBancaria) {
      novoPagamento.conta_bancaria_id = pendingContaBancaria;
    }

    onChange([...pagamentos, novoPagamento]);
    setForma("");
    setValorDisplay("");
    resetExtraFields();
  };

  const removePagamento = (id: string) => {
    onChange(pagamentos.filter((p) => p.id !== id));
  };

  const getFormaLabel = (formaValue: string) => {
    return formasPagamento.find((f) => f.value === formaValue)?.label || formaValue;
  };

  const getFormaIcon = (formaValue: string) => {
    return formasPagamento.find((f) => f.value === formaValue)?.icon || "💰";
  };

  const handleFormaChange = (value: string) => {
    setForma(value);
    resetExtraFields();
    if (!valorDisplay && diferenca > 0) {
      setValorDisplay(formatCurrency(diferenca.toFixed(2).replace(".", ",")));
    }

    // Auto-open selector modals
    if (value === "pix") {
      setPixModalOpen(true);
    } else if (value === "cartao_debito" || value === "cartao_credito" || value === "pix_maquininha") {
      setCardModalOpen(true);
    }
  };

  const cardTipoMap: Record<string, "debito" | "credito" | "pix_maquininha"> = {
    cartao_debito: "debito",
    cartao_credito: "credito",
    pix_maquininha: "pix_maquininha",
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5" />
            Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Lista de pagamentos adicionados */}
          {pagamentos.length > 0 && (
            <div className="space-y-2">
              {pagamentos.map((pag) => (
                <div
                  key={pag.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">{getFormaIcon(pag.forma)}</span>
                    <div className="min-w-0">
                      <span className="font-medium text-sm">{getFormaLabel(pag.forma)}</span>
                      {pag.cheque_numero && (
                        <p className="text-xs text-muted-foreground">Cheque #{pag.cheque_numero} • {pag.cheque_banco}</p>
                      )}
                      {pag.data_vencimento_fiado && (
                        <p className="text-xs text-muted-foreground">Venc: {format(new Date(pag.data_vencimento_fiado + "T12:00:00"), "dd/MM/yyyy")}</p>
                      )}
                      {pag.operadora_nome && (
                        <p className="text-xs text-muted-foreground">Operadora: {pag.operadora_nome}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pag.cheque_foto_url && (
                      <a href={pag.cheque_foto_url} target="_blank" rel="noopener noreferrer">
                        <img src={pag.cheque_foto_url} alt="Cheque" className="h-6 w-8 rounded object-cover border" />
                      </a>
                    )}
                    <span className="font-semibold">R$ {pag.valor.toFixed(2)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removePagamento(pag.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Adicionar novo pagamento */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Select value={forma} onValueChange={handleFormaChange}>
                <SelectTrigger className="flex-1 min-w-[140px]">
                  <SelectValue placeholder="Forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {formasPagamento.map((fp) => (
                    <SelectItem key={fp.value} value={fp.value}>
                      <span className="flex items-center gap-2">
                        <span>{fp.icon}</span>
                        <span>{fp.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-shrink-0 w-28 sm:w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  placeholder="0,00"
                  value={valorDisplay}
                  onChange={handleValorChange}
                  className="pl-9"
                />
              </div>
              <Button onClick={addPagamento} size="icon" className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Pending selection info */}
            {pendingCardInfo && (
              <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                {pendingCardInfo}
              </div>
            )}

            {/* Cheque extra fields */}
            {forma === "cheque" && (
              <div className="p-3 bg-muted/30 rounded-lg space-y-2 border border-dashed">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados do Cheque</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nº Cheque *</Label>
                    <Input value={chequeNumero} onChange={e => setChequeNumero(e.target.value)} placeholder="000001" className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Banco *</Label>
                    <Input value={chequeBanco} onChange={e => setChequeBanco(e.target.value)} placeholder="Itaú, BB..." className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => chequePhotoRef.current?.click()} disabled={isUploadingCheque}>
                    {isUploadingCheque ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ImageIcon className="h-3 w-3 mr-1" />}
                    Foto
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => chequeCameraRef.current?.click()} disabled={isUploadingCheque}>
                    <Camera className="h-3 w-3 mr-1" />Câmera
                  </Button>
                  {chequeFotoUrl && <img src={chequeFotoUrl} alt="Cheque" className="h-8 w-12 rounded border object-cover" />}
                  <input ref={chequePhotoRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleChequeFoto(f); e.target.value = ""; }} />
                  <input ref={chequeCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleChequeFoto(f); e.target.value = ""; }} />
                </div>
              </div>
            )}

            {/* Fiado extra fields */}
            {forma === "fiado" && (
              <div className="p-3 bg-muted/30 rounded-lg space-y-2 border border-dashed">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados do Fiado</p>
                <div>
                  <Label className="text-xs">Data de Vencimento</Label>
                  <Input
                    type="date"
                    value={dataVencimentoFiado}
                    onChange={e => setDataVencimentoFiado(e.target.value)}
                    min={getBrasiliaDateString()}
                    className="h-8 text-sm"
                    placeholder={format(addDays(new Date(), 30), "yyyy-MM-dd")}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Se não informado, vencimento será em 30 dias ({format(addDays(new Date(), 30), "dd/MM/yyyy")})</p>
                </div>
              </div>
            )}
          </div>

          {/* Status do pagamento */}
          {totalVenda > 0 && (
            <div
              className={cn(
                "p-3 rounded-lg flex items-center gap-2 text-sm",
                diferenca > 0 && "bg-destructive/10 text-destructive",
                diferenca < 0 && "bg-warning/10 text-warning",
                diferenca === 0 && "bg-success/10 text-success"
              )}
            >
              {diferenca > 0 ? (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span>Falta pagar: R$ {diferenca.toFixed(2)}</span>
                </>
              ) : diferenca < 0 ? (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span>Troco: R$ {Math.abs(diferenca).toFixed(2)}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Pagamento completo!</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PIX Key Selector */}
      <PixKeySelectorModal
        open={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        valor={parseCurrency(valorDisplay) || diferenca}
        beneficiario={effectiveUnidadeNome}
        unidadeId={unidadeId}
        onSelect={(chavePix, contaBancariaId) => {
          setPendingContaBancaria(contaBancariaId);
          setPendingCardInfo(`Chave PIX selecionada ✓`);
        }}
      />

      {/* Card Operator Selector */}
      <CardOperatorSelectorModal
        open={cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        valor={parseCurrency(valorDisplay) || diferenca}
        tipoCartao={cardTipoMap[forma] || "debito"}
        unidadeId={unidadeId}
        onSelect={(op) => {
          setPendingOperadora({ id: op.id, nome: op.nome });
          setPendingCardInfo(`${op.nome} • Taxa ${op.taxa.toFixed(2)}% • D+${op.prazo} • Líq. R$ ${op.valorLiquido.toFixed(2)}`);
        }}
      />
    </>
  );
}
