import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, ChevronDown, ChevronUp, Wrench, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

function CampoCopiavel({ valor, mascarado }: { valor: string; mascarado?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const [visivel, setVisivel] = useState(!mascarado);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 text-[11px] break-all bg-muted rounded-md px-2 py-2">
        {visivel ? valor : "•".repeat(Math.min(valor.length, 32))}
      </code>
      {mascarado && (
        <Button size="sm" variant="outline" onClick={() => setVisivel((v) => !v)}>
          {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={copiar}>
        {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export function DiagnosticoMetaOAuth() {
  const [aberto, setAberto] = useState(false);
  const { unidadeAtual } = useUnidade();
  const [carregando, setCarregando] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);

  const redirectUri = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/meta-oauth-callback` : "";

  const carregarWebhook = async (criar: boolean) => {
    if (!unidadeAtual?.id) {
      toast({ title: "Selecione uma unidade primeiro", variant: "destructive" });
      return;
    }
    setCarregando(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-webhook-config", {
        body: { unidade_id: unidadeAtual.id, criar },
      });
      if (error) throw error;
      setWebhookUrl(data?.webhook_url ?? null);
      setVerifyToken(data?.verify_token ?? null);
      if (criar && data?.verify_token) {
        toast({ title: "Token de verificação pronto para uso" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao carregar webhook", description: e.message, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  };

  const alternar = () => {
    const novo = !aberto;
    setAberto(novo);
    if (novo && !webhookUrl) carregarWebhook(false);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={alternar}
          className="w-full flex items-center gap-2 text-left"
        >
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium flex-1">Diagnóstico e webhook da Meta</span>
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {aberto && (
          <div className="mt-4 space-y-5">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Endereço de retorno usado pelo sistema (URI de redirecionamento OAuth válido):
              </p>
              {redirectUri ? <CampoCopiavel valor={redirectUri} /> : <p className="text-xs">indisponível</p>}
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Webhook da Meta (passo 3 no Meta Developers)</span>
              </div>

              {carregando && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                </div>
              )}

              {webhookUrl && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">URL de callback (unidade ativa):</p>
                  <CampoCopiavel valor={webhookUrl} />
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-1">Token de verificação:</p>
                {verifyToken ? (
                  <CampoCopiavel valor={verifyToken} mascarado />
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Nenhum token configurado para esta unidade ainda.
                    </p>
                    <Button size="sm" onClick={() => carregarWebhook(true)} disabled={carregando}>
                      Gerar token de verificação
                    </Button>
                  </div>
                )}
              </div>

              <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                <li>No Meta for Developers, abra o produto (WhatsApp, Instagram ou Webhooks) → Configuração.</li>
                <li>Cole a URL de callback acima no campo "URL de retorno de chamada".</li>
                <li>Cole o token de verificação no campo "Verificar token" e clique em Verificar e salvar.</li>
                <li>Assine os campos desejados (mensagens, comentários, menções).</li>
              </ol>
            </div>

            <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4 border-t pt-4">
              <li>Login do Facebook → Configurações: cole o endereço de retorno OAuth em "URIs de redirecionamento do OAuth válidos".</li>
              <li>
                Se o app estiver em modo desenvolvimento, adicione o Facebook do administrador da
                Página como Testador (Funções → Testadores) e aceite o convite em
                facebook.com/settings → Desenvolvedor.
              </li>
              <li>Volte aqui e clique em "Conectar rede social".</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
