import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Copy, ExternalLink, QrCode, Banknote, MessageCircle, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: {
    id: string;
    cliente: string;
    descricao: string;
    valor: number;
    vencimento: string;
    pedido_id?: string | null;
    asaas_charge_id?: string | null;
    linha_digitavel?: string | null;
    boleto_url?: string | null;
    pix_qrcode?: string | null;
    pix_copia_cola?: string | null;
  };
  onSuccess?: () => void;
}

type Tipo = "BOLETO" | "PIX";
const ASAAS_VALOR_MINIMO = 5;

export function EmitirBoletoAsaasDialog({ open, onOpenChange, conta, onSuccess }: Props) {
  const [tipo, setTipo] = useState<Tipo>("BOLETO");
  const [loading, setLoading] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [nome, setNome] = useState(conta.cliente || "");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [result, setResult] = useState<{
    linha_digitavel?: string;
    boleto_url?: string;
    pix_qrcode?: string;
    pix_copia_cola?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setNome(conta.cliente || "");
    setResult(
      conta.linha_digitavel || conta.boleto_url
        ? {
            linha_digitavel: conta.linha_digitavel || undefined,
            boleto_url: conta.boleto_url || undefined,
            pix_qrcode: conta.pix_qrcode || undefined,
            pix_copia_cola: conta.pix_copia_cola || undefined,
          }
        : null
    );

    // Pré-carrega CPF/email do cliente do pedido
    (async () => {
      if (!conta.pedido_id) return;
      const { data } = await supabase
        .from("pedidos")
        .select("clientes(cpf, email, telefone, nome)")
        .eq("id", conta.pedido_id)
        .maybeSingle();
      const c = (data as any)?.clientes;
      if (c) {
        if (c.cpf) setCpfCnpj(c.cpf);
        if (c.email) setEmail(c.email);
        if (c.telefone) setTelefone(c.telefone);
        if (c.nome && !nome) setNome(c.nome);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conta.id]);

  const copy = async (text?: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const handleEmitir = async () => {
    const valor = Number(conta.valor || 0);
    if (valor < ASAAS_VALOR_MINIMO) {
      toast.error("O Asaas exige valor mínimo de R$ 5,00 para emitir cobrança. Ajuste o valor da conta e tente novamente.");
      return;
    }

    const cpfLimpo = cpfCnpj.replace(/\D/g, "");
    if (cpfLimpo.length !== 11 && cpfLimpo.length !== 14) {
      toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido");
      return;
    }
    if (!nome.trim()) {
      toast.error("Informe o nome do pagador");
      return;
    }

    setLoading(true);
    try {
      // 1) Buscar ou criar cliente Asaas
      let customerId: string | null = null;
      const { data: listData, error: listErr } = await supabase.functions.invoke("asaas-api", {
        body: { action: "list_customers", cpfCnpj: cpfLimpo },
      });
      if (listErr) throw listErr;
      if (listData?.error) throw new Error(listData.error);

      if (listData?.customers?.length) {
        customerId = listData.customers[0].id;
      } else {
        const { data: createData, error: createErr } = await supabase.functions.invoke("asaas-api", {
          body: {
            action: "create_customer",
            name: nome.trim(),
            cpfCnpj: cpfLimpo,
            email: email.trim() || undefined,
            mobilePhone: telefone.replace(/\D/g, "") || undefined,
            externalReference: conta.id,
          },
        });
        if (createErr) throw createErr;
        if (createData?.error) throw new Error(createData.error);
        customerId = createData?.customer?.id;
      }
      if (!customerId) throw new Error("Não foi possível obter o cliente no Asaas");

      // 2) Criar cobrança
      const { data: chargeData, error: chargeErr } = await supabase.functions.invoke("asaas-api", {
        body: {
          action: "create_charge",
          customer: customerId,
          billingType: tipo,
          value: Number(conta.valor),
          dueDate: conta.vencimento,
          description: conta.descricao,
          externalReference: conta.id,
        },
      });
      if (chargeErr) throw chargeErr;
      if (chargeData?.error) throw new Error(chargeData.error);

      const charge = chargeData?.charge;
      if (!charge?.id) throw new Error("Cobrança não foi criada");

      const updates: Record<string, any> = {
        asaas_charge_id: charge.id,
        asaas_customer_id: customerId,
        boleto_url: charge.bankSlipUrl || charge.invoiceUrl || null,
        nosso_numero: charge.nossoNumero || null,
      };

      // 3) Dados específicos (linha digitável / PIX QR)
      let linha: string | undefined;
      let qr: string | undefined;
      let copiaCola: string | undefined;

      if (tipo === "BOLETO") {
        const { data: boletoData } = await supabase.functions.invoke("asaas-api", {
          body: { action: "get_boleto_url", id: charge.id },
        });
        linha = boletoData?.boleto?.identificationField;
        updates.linha_digitavel = linha || null;
      } else {
        const { data: pixData } = await supabase.functions.invoke("asaas-api", {
          body: { action: "get_pix_qrcode", id: charge.id },
        });
        qr = pixData?.pix?.encodedImage ? `data:image/png;base64,${pixData.pix.encodedImage}` : undefined;
        copiaCola = pixData?.pix?.payload;
        updates.pix_qrcode = qr || null;
        updates.pix_copia_cola = copiaCola || null;
      }

      // 4) Salvar em contas_receber
      const { error: updErr } = await supabase
        .from("contas_receber")
        .update(updates as any)
        .eq("id", conta.id);
      if (updErr) throw updErr;

      setResult({
        linha_digitavel: linha,
        boleto_url: updates.boleto_url,
        pix_qrcode: qr,
        pix_copia_cola: copiaCola,
      });
      toast.success(tipo === "BOLETO" ? "Boleto emitido com sucesso!" : "Cobrança PIX gerada!");
      onSuccess?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao emitir cobrança");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Emitir cobrança (Asaas)</DialogTitle>
          <DialogDescription>
            {conta.cliente} • R$ {Number(conta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} • venc. {conta.vencimento}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {Number(conta.valor || 0) < ASAAS_VALOR_MINIMO && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                O Asaas exige valor mínimo de R$ 5,00 para boleto ou PIX. Esta conta está em R$ {Number(conta.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.
              </div>
            )}

            <Tabs value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="BOLETO"><Banknote className="h-4 w-4 mr-1" />Boleto</TabsTrigger>
                <TabsTrigger value="PIX"><QrCode className="h-4 w-4 mr-1" />PIX</TabsTrigger>
              </TabsList>
              <TabsContent value="BOLETO" className="text-xs text-muted-foreground pt-2">
                Boleto registrado com linha digitável. Compensação em D+1 útil.
              </TabsContent>
              <TabsContent value="PIX" className="text-xs text-muted-foreground pt-2">
                QR Code dinâmico com vencimento. Conciliação imediata.
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Nome do pagador *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>CPF ou CNPJ *</Label>
                <Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="Somente números" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {result.linha_digitavel && (
              <div className="space-y-1.5">
                <Label className="text-xs">Linha digitável</Label>
                <div className="flex gap-2">
                  <Input readOnly value={result.linha_digitavel} className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => copy(result.linha_digitavel)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {result.boleto_url && (
              <Button asChild variant="outline" className="w-full">
                <a href={result.boleto_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir boleto / fatura no Asaas
                </a>
              </Button>
            )}
            {result.pix_qrcode && (
              <div className="flex justify-center">
                <img src={result.pix_qrcode} alt="QR Code PIX" className="w-48 h-48 border rounded-lg" />
              </div>
            )}
            {result.pix_copia_cola && (
              <div className="space-y-1.5">
                <Label className="text-xs">PIX copia e cola</Label>
                <div className="flex gap-2">
                  <Input readOnly value={result.pix_copia_cola} className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => copy(result.pix_copia_cola)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
              <Button onClick={handleEmitir} disabled={loading || Number(conta.valor || 0) < ASAAS_VALOR_MINIMO}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Emitir
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
