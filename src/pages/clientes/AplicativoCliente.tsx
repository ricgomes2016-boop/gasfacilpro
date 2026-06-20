import { useState, useEffect } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Smartphone, Copy, Check, ExternalLink, QrCode, Users, ShoppingCart,
  TrendingUp, Download, Share2, Link2, Star, MessageSquare, Upload, Save
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export default function AplicativoCliente() {
  const { empresa, loading } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ totalClientes: 0, pedidosMes: 0, avaliacaoMedia: 0, clientesAtivos: 0 });
  const [unidadeEmpresa, setUnidadeEmpresa] = useState<{ id: string; nome: string; slug: string | null } | null>(null);
  const [unidadeBrand, setUnidadeBrand] = useState<{ slug: string | null; logo_url: string | null }>({ slug: null, logo_url: null });
  const [slugInput, setSlugInput] = useState("");
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [savingBrand, setSavingBrand] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Resolve empresa from the active unit + carrega branding da unidade
  useEffect(() => {
    let cancelled = false;
    async function resolveEmpresaDaUnidade() {
      if (!unidadeAtual?.id) {
        setUnidadeEmpresa(null);
        setUnidadeBrand({ slug: null, logo_url: null });
        return;
      }
      const { data: u } = await supabase
        .from("unidades")
        .select("empresa_id, slug, logo_url, nome")
        .eq("id", unidadeAtual.id)
        .maybeSingle();
      if (!u?.empresa_id) {
        if (!cancelled) setUnidadeEmpresa(null);
        return;
      }
      if (!cancelled) {
        setUnidadeBrand({ slug: (u as any).slug ?? null, logo_url: (u as any).logo_url ?? null });
        setSlugInput((u as any).slug ?? slugify((u as any).nome ?? ""));
        setLogoUrlInput((u as any).logo_url ?? "");
      }
      const { data: e } = await supabase
        .from("empresas")
        .select("id, nome, slug")
        .eq("id", u.empresa_id)
        .maybeSingle();
      if (!cancelled && e) setUnidadeEmpresa(e as any);
    }
    resolveEmpresaDaUnidade();
    return () => { cancelled = true; };
  }, [unidadeAtual?.id]);

  const empresaLink = unidadeEmpresa ?? empresa;

  const baseUrl = "https://clientes.gasfacilpro.com.br";
  const appLink = unidadeBrand.slug
    ? `${baseUrl}?u=${unidadeBrand.slug}`
    : empresaLink?.slug
      ? `${baseUrl}?empresa=${empresaLink.slug}${unidadeAtual ? `&unidade=${unidadeAtual.id}` : ""}`
      : baseUrl;

  async function handleSaveBrand() {
    if (!unidadeAtual?.id) return;
    const slug = slugify(slugInput);
    if (!slug) {
      toast.error("Informe um slug válido (apenas letras, números e hífen)");
      return;
    }
    setSavingBrand(true);
    const { error } = await supabase
      .from("unidades")
      .update({ slug, logo_url: logoUrlInput || null } as any)
      .eq("id", unidadeAtual.id);
    setSavingBrand(false);
    if (error) {
      if (error.message?.includes("unique") || (error as any).code === "23505") {
        toast.error("Esse slug já está em uso por outra unidade");
      } else {
        toast.error("Erro ao salvar: " + error.message);
      }
      return;
    }
    setUnidadeBrand({ slug, logo_url: logoUrlInput || null });
    toast.success("Identidade da unidade salva!");
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !unidadeAtual?.id) return;
    const empresaId = unidadeEmpresa?.id || empresa?.id;
    if (!empresaId) {
      toast.error("Empresa não identificada. Recarregue a página.");
      return;
    }
    setUploadingLogo(true);
    const ext = file.name.split(".").pop() || "png";
    // RLS exige que a primeira pasta seja o empresa_id do usuário
    const path = `${empresaId}/unidades-logos/${unidadeAtual.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("marketing-assets").upload(path, file, { upsert: true });
    if (upErr) {
      setUploadingLogo(false);
      toast.error("Erro no upload: " + upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("marketing-assets").getPublicUrl(path);
    setLogoUrlInput(pub.publicUrl);
    setUploadingLogo(false);
    toast.success("Logo enviado. Clique em Salvar para confirmar.");
  }


  useEffect(() => {
    document.title = "GásFácil Pro — Aplicativo do Cliente";
  }, []);

  useEffect(() => {
    if (!empresa?.id || loading) return;

    async function fetchStats() {
      const now = new Date();
      const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const [clientesRes, pedidosRes, avaliacoesRes]: any[] = await Promise.all([
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", empresa!.id),
        (supabase.from("pedidos").select("id", { count: "exact", head: true }) as any).eq("empresa_id", empresa!.id).gte("created_at", firstOfMonth),
        supabase.from("avaliacoes_entrega").select("nota_entregador, pedido_id").not("nota_entregador", "is", null).limit(500),
      ]);

      const notas = avaliacoesRes.data ?? [];
      const media = notas.length > 0
        ? notas.reduce((sum: number, a: any) => sum + (a.nota_entregador ?? 0), 0) / notas.length
        : 0;

      setStats({
        totalClientes: clientesRes.count ?? 0,
        pedidosMes: pedidosRes.count ?? 0,
        avaliacaoMedia: Math.round(media * 10) / 10,
        clientesAtivos: clientesRes.count ?? 0,
      });
    }

    fetchStats();
  }, [empresa?.id, loading]);

  const handleCopy = () => {
    navigator.clipboard.writeText(appLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${empresaLink?.nome ?? "GásFácil"} - Peça seu Gás`,
          text: `Peça seu gás de cozinha pelo app da ${empresaLink?.nome ?? "nossa distribuidora"}!`,
          url: appLink,
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Olá! Agora você pode pedir seu gás pelo nosso app:\n${appLink}`
  );
  const whatsappLink = `https://wa.me/?text=${whatsappMessage}`;

  return (
    <MainLayout>
      <Header title="Aplicativo do Cliente" />
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-primary" />
            Aplicativo do Cliente
          </h1>
          <p className="text-muted-foreground mt-1">
            Compartilhe o link do seu aplicativo para seus clientes fazerem pedidos online.
          </p>
        </div>

        {/* Insights */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalClientes}</p>
                <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pedidosMes}</p>
                <p className="text-xs text-muted-foreground">Pedidos este mês</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.avaliacaoMedia || "—"}</p>
                <p className="text-xs text-muted-foreground">Avaliação média</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.clientesAtivos}</p>
                <p className="text-xs text-muted-foreground">Clientes ativos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Identidade da Unidade */}
        <Card>
          <CardHeader>
            <CardTitle>Identidade desta unidade</CardTitle>
            <CardDescription>
              Cada unidade pode ter seu próprio nome, logo e link de aplicativo.
              {unidadeAtual?.nome && <> Editando: <span className="font-medium">{unidadeAtual.nome}</span></>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unidade-slug">Slug do app (aparece na URL)</Label>
                <Input
                  id="unidade-slug"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  placeholder="ex: forte-gas-matriz"
                />
                <p className="text-xs text-muted-foreground">
                  Apenas letras minúsculas, números e hífen. Será gerado: <code className="text-xs">?u={slugify(slugInput) || "..."}</code>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Logo do app</Label>
                <div className="flex items-center gap-3">
                  {logoUrlInput && (
                    <img src={logoUrlInput} alt="Logo" className="h-14 w-14 rounded-lg object-cover border" />
                  )}
                  <div className="flex-1 space-y-2">
                    <Input
                      value={logoUrlInput}
                      onChange={(e) => setLogoUrlInput(e.target.value)}
                      placeholder="URL da imagem"
                    />
                    <label className="inline-flex">
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                      <Button type="button" variant="outline" size="sm" asChild className="gap-2 cursor-pointer">
                        <span>
                          <Upload className="h-3.5 w-3.5" />
                          {uploadingLogo ? "Enviando..." : "Enviar imagem"}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={handleSaveBrand} disabled={savingBrand || !unidadeAtual?.id} className="gap-2">
              <Save className="h-4 w-4" />
              {savingBrand ? "Salvando..." : "Salvar identidade"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Link do App */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Link do Aplicativo
              </CardTitle>
              <CardDescription>
                Copie e compartilhe este link com seus clientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={appLink} readOnly className="font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleShare} className="gap-2">
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </Button>
                <Button variant="outline" asChild className="gap-2">
                  <a href={appLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir App
                  </a>
                </Button>
                <Button variant="outline" asChild className="gap-2">
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <MessageSquare className="h-4 w-4" />
                    Enviar via WhatsApp
                  </a>
                </Button>
              </div>

              {!empresaLink?.slug && (
                <p className="text-sm text-destructive">
                  Configure o slug da sua empresa nas configurações para gerar um link personalizado.
                </p>
              )}
            </CardContent>
          </Card>

          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code
              </CardTitle>
              <CardDescription>
                Imprima e coloque no balcão, veículo ou panfleto
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-xl border">
                <QRCodeSVG value={appLink} size={180} level="H" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Escaneie para acessar o aplicativo
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const svg = document.querySelector(".qr-download-target svg");
                  if (!svg) {
                    toast.info("Use o botão direito > 'Salvar imagem' no QR Code acima");
                    return;
                  }
                }}
              >
                <Download className="h-4 w-4" />
                Baixar QR Code
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Dicas */}
        <Card>
          <CardHeader>
            <CardTitle>Dicas para divulgar seu app</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: "WhatsApp", desc: "Envie o link nas conversas e grupos de clientes" },
                { title: "Panfletos", desc: "Imprima o QR Code nos panfletos e cartões de visita" },
                { title: "Veículos", desc: "Adesivo com QR Code no caminhão de entrega" },
                { title: "Redes Sociais", desc: "Poste o link no Instagram, Facebook e Google Meu Negócio" },
                { title: "Nota Fiscal", desc: "Inclua o link na parte de observações da NF" },
                { title: "Boca a Boca", desc: "Peça para os entregadores divulgarem nas entregas" },
              ].map((dica) => (
                <div key={dica.title} className="p-3 rounded-lg border bg-muted/30">
                  <p className="font-medium text-sm text-foreground">{dica.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{dica.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
