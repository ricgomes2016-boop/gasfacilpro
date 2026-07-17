import { useState, useMemo } from "react";
import { Copy, ExternalLink, Check, Globe, QrCode, Share2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";

const BASE_URL = "https://app.gasfacilpro.com.br";

// Mapa de empresas para suas páginas institucionais publicadas.
// Aceita match por slug OU por nome normalizado (lowercase, sem acentos).
const SITES_INSTITUCIONAIS: Record<string, { path: string; nome: string }> = {
  "central-gas": { path: "/centralgascp", nome: "Central Gás" },
  "central gas": { path: "/centralgascp", nome: "Central Gás" },
  "forte-gas": { path: "/fortegas", nome: "Forte Gás" },
  "forte gas": { path: "/fortegas", nome: "Forte Gás" },
  "japa-gas": { path: "/japagas", nome: "Japa Gás" },
  "japa gas": { path: "/japagas", nome: "Japa Gás" },
};

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export default function SiteInstitucional() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();

  const activeName = unidadeAtual?.nome ?? empresa?.nome ?? "";

  const site = useMemo(() => {
    // Prioridade ESTRITA: a loja/unidade selecionada define o site.
    // Só caímos para a empresa quando não há unidade selecionada.
    const candidates: string[] = [];

    if (unidadeAtual?.nome) {
      candidates.push(normalize(unidadeAtual.nome));
    }

    if (!unidadeAtual) {
      if (empresa?.slug) candidates.push(empresa.slug);
      if (empresa?.nome) candidates.push(normalize(empresa.nome));
    }

    for (const key of candidates) {
      const match = SITES_INSTITUCIONAIS[key];
      if (match) return match;
    }

    return null;
  }, [unidadeAtual?.id, unidadeAtual?.nome, empresa?.id, empresa?.slug, empresa?.nome]);

  const siteUrl = site ? `${BASE_URL}${site.path}` : "";

  // Força reload do iframe ao trocar empresa
  const iframeKey = `${empresa?.id ?? "none"}-${siteUrl}`;

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
    <MainLayout>
      <Header title="Site Institucional" subtitle="Divulgação da sua loja" />
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h2 className="text-xl font-bold">Site Institucional</h2>
          <p className="text-muted-foreground">
            Gerencie e divulgue o site da {activeName ? <strong>{activeName}</strong> : "sua empresa"}.
          </p>
        </div>

        {!empresa && !unidadeAtual ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              Selecione uma loja para visualizar o site institucional.
            </CardContent>
          </Card>
        ) : !site ? (
          <Card>
            <CardContent className="flex items-start gap-3 p-6">
              <AlertCircle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Nenhum site institucional configurado para {activeName || "esta loja"}.</p>
                <p className="text-sm text-muted-foreground mt-1">Fale com o administrador.</p>
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
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
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
                    <span className="w-2 h-2 rounded-full bg-destructive" />
                    <span className="w-2 h-2 rounded-full bg-warning" />
                    <span className="w-2 h-2 rounded-full bg-success" />
                    <span className="ml-2 font-mono truncate">{siteUrl}</span>
                  </div>
                  <iframe
                    key={iframeKey}
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
    </MainLayout>
  );
}
