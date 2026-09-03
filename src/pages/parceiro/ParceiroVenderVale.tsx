import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ParceiroLayout } from "@/components/parceiro/ParceiroLayout";
import { useParceiroDados } from "@/hooks/useParceiroDados";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, CheckCircle, Printer, Loader2, MapPin } from "lucide-react";

type Step = "buscar" | "consumidor" | "confirmado";

interface ValeEncontrado {
  id: string;
  numero: number;
  codigo: string;
  valor: number;
  produto_nome: string | null;
}

export default function ParceiroVenderVale() {
  const { parceiro, refetchVales } = useParceiroDados();
  const location = useLocation();
  const valeNumeroFromState = (location.state as any)?.valeNumero || "";
  const [step, setStep] = useState<Step>("buscar");
  const [busca, setBusca] = useState(valeNumeroFromState);
  const [loading, setLoading] = useState(false);
  const [vale, setVale] = useState<ValeEncontrado | null>(null);
  const [cpf, setCpf] = useState("");
  const [nomeConsumidor, setNomeConsumidor] = useState("");
  const [telefoneConsumidor, setTelefoneConsumidor] = useState("");
  const [enderecoConsumidor, setEnderecoConsumidor] = useState("");
  const [valorVenda, setValorVenda] = useState("");
  const cupomRef = useRef<HTMLDivElement>(null);

  const buscarVale = async () => {
    if (!busca.trim() || !parceiro) return;
    setLoading(true);
    try {
      let { data, error } = await (supabase as any).from("vale_gas")
        .select("id, numero, codigo, valor, produto_nome, status, parceiro_id")
        .eq("parceiro_id", parceiro.id)
        .eq("status", "disponivel")
        .eq("codigo", busca.trim().toUpperCase())
        .limit(1);

      let found = data?.[0] || null;

      if (!found && !error) {
        const num = parseInt(busca.trim());
        if (!isNaN(num)) {
          const res = await (supabase as any).from("vale_gas")
            .select("id, numero, codigo, valor, produto_nome, status, parceiro_id")
            .eq("parceiro_id", parceiro.id)
            .eq("status", "disponivel")
            .eq("numero", num)
            .limit(1);
          found = res.data?.[0] || null;
          error = res.error;
        }
      }

      data = found;

      if (error) throw error;
      if (!data) {
        toast.error("Vale não encontrado ou não está disponível.");
        return;
      }

      setVale(data);
      setValorVenda("125.00");
      setStep("consumidor");
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar vale");
    } finally {
      setLoading(false);
    }
  };

  const registrarVenda = async () => {
    if (!vale || !nomeConsumidor.trim()) {
      toast.error("Informe o nome do consumidor.");
      return;
    }
    const valorVendaNum = parseFloat(valorVenda);
    if (isNaN(valorVendaNum) || valorVendaNum <= 0) {
      toast.error("Informe um valor de venda válido.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await (supabase as any).from("vale_gas").update({
        status: "vendido",
        consumidor_nome: nomeConsumidor.trim(),
        consumidor_cpf: cpf.trim() || null,
        consumidor_telefone: telefoneConsumidor.trim() || null,
        consumidor_endereco: enderecoConsumidor.trim() || null,
        valor_venda: valorVendaNum,
      }).eq("id", vale.id);

      if (error) throw error;
      toast.success(`Vale #${vale.numero} vendido com sucesso!`);
      setStep("confirmado");
      refetchVales();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar venda");
    } finally {
      setLoading(false);
    }
  };

  const imprimirCupom = () => {
    const printContent = cupomRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Cupom Vale Gás</title>
      <style>
        body { font-family: monospace; width: 280px; margin: 0 auto; padding: 10px; }
        .center { text-align: center; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
        .bold { font-weight: bold; }
        .small { font-size: 11px; }
        @media print { body { width: 100%; } }
      </style></head><body>
      ${printContent.innerHTML}
      <script>window.print(); window.close();</script>
      </body></html>
    `);
    win.document.close();
  };

  const resetar = () => {
    setStep("buscar");
    setBusca("");
    setVale(null);
    setCpf("");
    setNomeConsumidor("");
    setTelefoneConsumidor("");
    setEnderecoConsumidor("");
    setValorVenda("");
  };

  const valorVendaNum = parseFloat(valorVenda) || 0;
  const lucro = vale ? valorVendaNum - Number(vale.valor) : 0;

  return (
    <ParceiroLayout title="Vender Vale">
      <div className="p-4 space-y-4">
        {step === "buscar" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-5 w-5" /> Buscar Vale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Número ou código do vale</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: 123 ou VG-000123"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && buscarVale()}
                  />
                  <Button onClick={buscarVale} disabled={loading || !busca.trim()}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Digite o número do vale ou escaneie o QR Code para buscar.
              </p>
            </CardContent>
          </Card>
        )}

        {step === "consumidor" && vale && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados da Venda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vale info */}
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Vale #{vale.numero}</span>
                  <Badge>Disponível</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Código: {vale.codigo}</p>
                <p className="text-xs text-muted-foreground">Valor de custo: R$ {Number(vale.valor).toFixed(2)}</p>
                {vale.produto_nome && (
                  <p className="text-xs text-muted-foreground">Produto: {vale.produto_nome}</p>
                )}
              </div>

              {/* Valor de venda */}
              <div className="p-3 rounded-lg border-2 border-primary/20 bg-primary/5 space-y-2">
                <Label className="font-semibold">Valor de Venda (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 110.00"
                  value={valorVenda}
                  onChange={(e) => setValorVenda(e.target.value)}
                  className="text-lg font-bold"
                />
                {lucro !== 0 && (
                  <p className={`text-xs font-medium ${lucro >= 0 ? "text-success" : "text-destructive"}`}>
                    {lucro >= 0 ? "Lucro" : "Prejuízo"}: R$ {Math.abs(lucro).toFixed(2)}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome do Consumidor *</Label>
                  <Input
                    placeholder="Nome completo"
                    value={nomeConsumidor}
                    onChange={(e) => setNomeConsumidor(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>CPF</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Telefone</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={telefoneConsumidor}
                    onChange={(e) => setTelefoneConsumidor(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> Endereço de Entrega
                  </Label>
                  <Textarea
                    placeholder="Rua, número, bairro, complemento..."
                    value={enderecoConsumidor}
                    onChange={(e) => setEnderecoConsumidor(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={resetar} className="flex-1">Cancelar</Button>
                <Button onClick={registrarVenda} disabled={loading || !nomeConsumidor.trim()} className="flex-1">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Confirmar Venda
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "confirmado" && vale && (
          <>
            <Card>
              <CardContent className="pt-6 text-center space-y-3">
                <CheckCircle className="h-12 w-12 text-primary mx-auto" />
                <h2 className="text-lg font-bold">Venda Registrada!</h2>
                <p className="text-muted-foreground">
                  Vale #{vale.numero} vendido para {nomeConsumidor}
                </p>
                <p className="text-sm font-semibold text-primary">
                  Valor cobrado: R$ {valorVendaNum.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            {/* Printable receipt */}
            <div ref={cupomRef} className="hidden">
              <div className="center bold">VALE GÁS</div>
              <div className="center small">{parceiro?.nome}</div>
              {parceiro?.cnpj && <div className="center small">CNPJ: {parceiro.cnpj}</div>}
              <div className="line"></div>
              <div className="bold">Vale #{vale.numero}</div>
              <div>Código: {vale.codigo}</div>
              <div className="bold">Valor: R$ {valorVendaNum.toFixed(2)}</div>
              {vale.produto_nome && <div>Produto: {vale.produto_nome}</div>}
              <div className="line"></div>
              <div className="bold">Consumidor:</div>
              <div>{nomeConsumidor}</div>
              {cpf && <div>CPF: {cpf}</div>}
              {telefoneConsumidor && <div>Tel: {telefoneConsumidor}</div>}
              {enderecoConsumidor && <div>End: {enderecoConsumidor}</div>}
              <div className="line"></div>
              <div className="center small">
                {new Date().toLocaleString("pt-BR")}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={imprimirCupom} className="flex-1">
                <Printer className="h-4 w-4 mr-2" /> Imprimir Cupom
              </Button>
              <Button onClick={resetar} className="flex-1">
                Nova Venda
              </Button>
            </div>
          </>
        )}
      </div>
    </ParceiroLayout>
  );
}
