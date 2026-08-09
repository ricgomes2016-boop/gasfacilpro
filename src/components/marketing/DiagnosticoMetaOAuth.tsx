import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, ChevronDown, ChevronUp, Wrench } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export function DiagnosticoMetaOAuth() {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const redirectUri = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/meta-oauth-callback` : "";

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="w-full flex items-center gap-2 text-left"
        >
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium flex-1">Diagnóstico da conexão Meta</span>
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {aberto && (
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Endereço de retorno usado pelo sistema (URI de redirecionamento OAuth válido):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] break-all bg-muted rounded-md px-2 py-2">
                  {redirectUri || "indisponível"}
                </code>
                <Button size="sm" variant="outline" onClick={copiar} disabled={!redirectUri}>
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
              <li>Abra o painel Meta for Developers → seu app → Login do Facebook → Configurações.</li>
              <li>Cole o endereço acima em "URIs de redirecionamento do OAuth válidos" e salve.</li>
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
