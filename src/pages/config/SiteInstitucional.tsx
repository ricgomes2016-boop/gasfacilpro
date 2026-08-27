import { useState, useMemo } from "react";
import {
  Copy, ExternalLink, Check, Globe, Share2, AlertCircle,
  Monitor, Tablet, Smartphone, Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { cn } from "@/lib/utils";

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

type Device = "desktop" | "tablet" | "mobile";

const DEVICES: { id: Device; label: string; icon: typeof Monitor; width: string; height: string }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: "100%", height: "620px" },
  { id: "tablet", label: "Tablet", icon: Tablet, width: "768px", height: "620px" },
  { id: "mobile", label: "Mobile", icon: Smartphone, width: "390px", height: "680px" },
];

const DICAS = [
  "Adicione o link na bio do Instagram e Facebook",
  "Envie pelo WhatsApp para clientes e prospects",
  "Imprima o link ou QR Code em panfletos e cartões",
  "Inclua nas assinaturas de e-mail da equipe",
  "Divulgue em grupos de bairro e comunidades locais",
];

export default function SiteInstitucional() {
  const [copied, setCopied] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
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

  // Força reload do iframe ao trocar empresa/unidade
  const iframeKey = `${empresa?.id ?? "none"}-${unidadeAtual?.id ?? "none"}-${siteUrl}`;

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

  const current = DEVICES.find((d) => d.id === device) ?? DEVICES[0];

  return (
    <MainLayout>
      <Header
        title="Site Institucional"
        subtitle={activeName ? `Divulgação · ${activeName}` : "Divulgação da sua loja"}
      />
      <div className="w-full min-w-0 max-w-full space-y-4 p-3 sm:p-4 md:p-6">
        {!empresa && !unidadeAtual ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
              <AlertCircle className="h-5 w-5 shrink-0" />
              Selecione uma loja para visualizar o site institucional.
            </CardContent>
          </Card>
        ) : !site ? (
          <Card>
            <CardContent className="flex items-start gap-3 p-6">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="font-medium">
                  Nenhum site institucional configurado para {activeName || "esta loja"}.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Fale com o administrador.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <SectionCard
              icon={Globe}
              title={`Link público · ${site.nome}`}
              description="Compartilhe este endereço com seus clientes."
            >
              <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
                <Input value={siteUrl} readOnly className="w-full min-w-0 font-mono text-sm" aria-label="Link público" />
                <div className="flex w-full min-w-0 flex-wrap gap-2 lg:w-auto">
                  <Button variant="outline" className="h-10 gap-2" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    <span className="hidden sm:inline">Copiar</span>
                  </Button>
                  <Button variant="outline" className="h-10 gap-2" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Compartilhar</span>
                  </Button>
                  <Button className="h-10 gap-2" onClick={() => window.open(siteUrl, "_blank", "noopener")}>
                    <ExternalLink className="h-4 w-4" /> Abrir site
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Pré-visualização"
              description="Confira como o site aparece em cada tamanho de tela."
              actions={
                <div className="flex min-w-0 items-center gap-1 rounded-lg bg-muted p-1">
                  {DEVICES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDevice(d.id)}
                      aria-pressed={device === d.id}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                        device === d.id
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <d.icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{d.label}</span>
                    </button>
                  ))}
                </div>
              }
              bodyClassName="bg-muted/40"
            >
              <div className="flex w-full min-w-0 justify-center overflow-x-auto">
                <div
                  className="w-full max-w-full overflow-hidden rounded-xl border border-border bg-background shadow-sm transition-[width] duration-300"
                  style={{ width: current.width }}
                >
                  <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="ml-2 min-w-0 truncate font-mono">{siteUrl}</span>
                  </div>
                  <iframe
                    key={`${iframeKey}-${device}`}
                    src={siteUrl}
                    title={`Site institucional - ${site.nome}`}
                    className="w-full bg-background"
                    style={{ height: current.height }}
                    loading="lazy"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard icon={Lightbulb} title="Dicas de divulgação">
              <ul className="grid gap-x-6 gap-y-2 text-sm text-muted-foreground sm:grid-cols-2">
                {DICAS.map((d) => (
                  <li key={d} className="flex min-w-0 items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    <span className="min-w-0">{d}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </>
        )}
      </div>
    </MainLayout>
  );
}
