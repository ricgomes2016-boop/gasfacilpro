import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, CheckCircle, Loader2, AlertCircle, Send } from "lucide-react";

interface ParceiroPublico {
  id: string;
  nome: string;
}

interface ValeResult {
  numero: number;
  codigo: string;
  valor: number;
  produto_nome: string | null;
}

export default function ComprarValeGas() {
  const { parceiroId } = useParams<{ parceiroId: string }>();
  const [parceiro, setParceiro] = useState<ParceiroPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [valeResult, setValeResult] = useState<ValeResult | null>(null);
  const [parceiroNome, setParceiroNome] = useState("");

  useEffect(() => {
    if (!parceiroId) return;
    loadParceiro();
  }, [parceiroId]);

  const loadParceiro = async () => {
    try {
      // Use a simple fetch to the edge function to validate the partner
      // We can't query directly without auth, so we just set the ID and show the form
      // The edge function will validate on submit
      setParceiro({ id: parceiroId!, nome: "" });
    } catch {
      setError("Parceiro não encontrado.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("vender-vale-publico", {
        body: {
          parceiroId,
          nome: nome.trim(),
          cpf: cpf.trim() || null,
          telefone: telefone.trim(),
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setValeResult(data.vale);
      setParceiroNome(data.parceiro.nome);
    } catch (err: any) {
      setError(err.message || "Erro ao processar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const gerarLinkWhatsApp = () => {
    if (!valeResult) return "";
    const phone = telefone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `🔥 *VALE GÁS* 🔥\n\n` +
      `✅ Vale Nº ${valeResult.numero}\n` +
      `📋 Código: ${valeResult.codigo}\n` +
      `💰 Valor: R$ ${Number(valeResult.valor).toFixed(2)}\n` +
      (valeResult.produto_nome ? `📦 Produto: ${valeResult.produto_nome}\n` : "") +
      `🏪 Parceiro: ${parceiroNome}\n\n` +
      `Apresente este código ao entregador para resgatar seu gás.\n` +
      `Obrigado pela preferência!`
    );
    return `https://wa.me/55${phone}?text=${msg}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warning to-warning flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-warning" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-warning to-warning flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-warning to-warning text-white py-6 px-4 text-center shadow-lg">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Flame className="h-8 w-8" />
          <h1 className="text-2xl font-bold">Gas Express25</h1>
        </div>
        <p className="text-warning text-sm">Vale Gás Digital</p>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        {!valeResult ? (
          <>
            <Card className="border-warning shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-center">
                  Adquira seu Vale Gás
                </CardTitle>
                <p className="text-sm text-muted-foreground text-center">
                  Preencha seus dados para receber o vale no WhatsApp
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome">Nome Completo *</Label>
                    <Input
                      id="nome"
                      placeholder="Seu nome completo"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                      className="border-warning focus-visible:ring-warning"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      className="border-warning focus-visible:ring-warning"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="telefone">WhatsApp *</Label>
                    <Input
                      id="telefone"
                      placeholder="(00) 00000-0000"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      required
                      className="border-warning focus-visible:ring-warning"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting || !nome.trim() || !telefone.trim()}
                    className="w-full bg-gradient-to-r from-warning to-warning hover:from-warning hover:to-warning text-white font-bold py-3"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Flame className="h-5 w-5 mr-2" />
                    )}
                    {submitting ? "Processando..." : "Solicitar Vale Gás"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Success */}
            <Card className="border-success shadow-md">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-success flex items-center justify-center mx-auto">
                  <CheckCircle className="h-10 w-10 text-success" />
                </div>
                <h2 className="text-xl font-bold text-success">Vale Gás Emitido!</h2>

                <div className="bg-success rounded-xl p-4 space-y-2 text-left">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Vale Nº</span>
                    <span className="font-bold text-lg">{valeResult.numero}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Código</span>
                    <span className="font-mono text-sm">{valeResult.codigo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Valor</span>
                    <span className="font-bold text-success text-lg">
                      R$ {Number(valeResult.valor).toFixed(2)}
                    </span>
                  </div>
                  {valeResult.produto_nome && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Produto</span>
                      <span className="text-sm">{valeResult.produto_nome}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Parceiro</span>
                    <span className="text-sm">{parceiroNome}</span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Apresente o código ao entregador para resgatar seu gás.
                </p>
              </CardContent>
            </Card>

            <a
              href={gerarLinkWhatsApp()}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button className="w-full bg-success hover:bg-success text-white font-bold py-3 gap-2">
                <Send className="h-5 w-5" />
                Receber no WhatsApp
              </Button>
            </a>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setValeResult(null);
                setNome("");
                setCpf("");
                setTelefone("");
              }}
            >
              Solicitar outro vale
            </Button>
          </>
        )}
      </main>

      <footer className="text-center py-4 text-xs text-muted-foreground">
        Gas Express25 • Vale Gás Digital
      </footer>
    </div>
  );
}
