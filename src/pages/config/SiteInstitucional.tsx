import { useState, useMemo } from "react";
import { Copy, ExternalLink, Check, Globe, QrCode, Share2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";

const BASE_URL = "https://app.gasfacilpro.com.br";

// Mapa de empresas (por slug) para suas páginas institucionais publicadas
const SITES_INSTITUCIONAIS: Record<string, { path: string; nome: string }> = {
  "central-gas": { path: "/centralgascp", nome: "Central Gás" },
  "forte-gas": { path: "/fortegas", nome: "Forte Gás" },
};

export default function SiteInstitucional() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { empresa } = useEmpresa();

  const site = useMemo(() => {
    if (!empresa?.slug) return null;
    return SITES_INSTITUCIONAIS[empresa.slug] ?? null;
  }, [empresa?.slug]);

  const siteUrl = site ? `${BASE_URL}${site.path}` : "";

  const handleCopy = async () => {
    if (!siteUrl) return;
    await navigator.clipboard.writeText(siteUrl);
    setCopied(true);
    toast({ title: "Link copiado!", description: "Cole onde quiser para divulgar." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!siteUrl) return;
    if (navigator.share) {
      await navigator.share({ title: site?.nome ?? "Site", url: siteUrl });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Site Institucional</h1>
        <p className="text-muted-foreground">
          Gerencie e divulgue o site da {empresa?.nome ? <strong>{empresa.nome}</strong> : "sua empresa"}.
        </p>
      </div>

      {!empresa ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            Selecione uma empresa para visualizar o site institucional.
          </CardContent>
        </Card>
      ) : !site ? (
        <Card>
          <CardContent className="flex items-start gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Nenhum site institucional configurado para {empresa.nome}.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Entre em contato com o suporte para solicitar a criação de um site personalizado para sua empresa.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Link de Divulgação · {site.nome}
              </CardTitle>
              <CardDescription>
                Compartilhe este link com seus clientes nas redes sociais, WhatsApp, panfletos e cartões de visita.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={siteUrl} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => window.open(siteUrl, "_blank")} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Abrir Site
                </Button>
                <Button variant="outline" onClick={handleShare} className="gap-2">
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </Button>
              </div>

              {/* Pré-visualização */}
              <div className="rounded-lg border overflow-hidden bg-muted/30 mt-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="ml-2 font-mono truncate">{siteUrl}</span>
                </div>
                <iframe
                  src={siteUrl}
                  title={`Site institucional - ${site.nome}`}
                  className="w-full h-[500px] bg-background"
                  loading="lazy"
                />
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
        </>
      )}
    </div>
  );
}
