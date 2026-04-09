import { useState } from "react";
import { Copy, ExternalLink, Check, Globe, QrCode, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const SITE_URL = "https://app.gasfacilpro.com.br/centralgascp";

export default function SiteInstitucional() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SITE_URL);
    setCopied(true);
    toast({ title: "Link copiado!", description: "Cole onde quiser para divulgar." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Central Gás", url: SITE_URL });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Site Institucional</h1>
        <p className="text-muted-foreground">Gerencie e divulgue o site da sua empresa.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Link de Divulgação
          </CardTitle>
          <CardDescription>
            Compartilhe este link com seus clientes nas redes sociais, WhatsApp, panfletos e cartões de visita.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={SITE_URL} readOnly className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => window.open(SITE_URL, "_blank")} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Abrir Site
            </Button>
            <Button variant="outline" onClick={handleShare} className="gap-2">
              <Share2 className="h-4 w-4" />
              Compartilhar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Dicas de Divulgação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Adicione o link na bio do Instagram e Facebook da empresa</li>
            <li>Envie o link pelo WhatsApp para clientes e prospects</li>
            <li>Imprima o link ou QR Code em panfletos e cartões de visita</li>
            <li>Inclua em assinaturas de e-mail da equipe</li>
            <li>Divulgue em grupos de bairro e comunidades locais</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
