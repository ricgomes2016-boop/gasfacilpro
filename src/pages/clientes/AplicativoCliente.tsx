import { useState, useEffect } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
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
  TrendingUp, Download, Share2, Link2, Star, MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

export default function AplicativoCliente() {
  const { empresa } = useEmpresa();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ totalClientes: 0, pedidosMes: 0, avaliacaoMedia: 0, clientesAtivos: 0 });

  const baseUrl = "https://clientes.gasfacilpro.com.br";
  const appLink = empresa?.slug ? `${baseUrl}?empresa=${empresa.slug}` : baseUrl;

  useEffect(() => {
    document.title = "GásFácil Pro — Aplicativo do Cliente";
  }, []);

  useEffect(() => {
    if (!empresa?.id) return;

    async function fetchStats() {
      const now = new Date();
      const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const clientesRes: any = await supabase.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", empresa!.id);
      const pedidosRes: any = await (supabase.from("pedidos").select("id", { count: "exact", head: true }) as any).eq("empresa_id", empresa!.id).gte("created_at", firstOfMonth);
      const avaliacoesRes: any = await supabase.from("avaliacoes_entrega").select("nota_entregador").not("nota_entregador", "is", null).limit(500);

      const notas = avaliacoesRes.data ?? [];
      const media = notas.length > 0
        ? notas.reduce((sum, a) => sum + (a.nota_entregador ?? 0), 0) / notas.length
        : 0;

      setStats({
        totalClientes: clientesRes.count ?? 0,
        pedidosMes: pedidosRes.count ?? 0,
        avaliacaoMedia: Math.round(media * 10) / 10,
        clientesAtivos: clientesRes.count ?? 0,
      });
    }

    fetchStats();
  }, [empresa?.id]);

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
          title: `${empresa?.nome ?? "GásFácil"} - Peça seu Gás`,
          text: `Peça seu gás de cozinha pelo app da ${empresa?.nome ?? "nossa distribuidora"}!`,
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
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pedidosMes}</p>
                <p className="text-xs text-muted-foreground">Pedidos este mês</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.avaliacaoMedia || "—"}</p>
                <p className="text-xs text-muted-foreground">Avaliação média</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.clientesAtivos}</p>
                <p className="text-xs text-muted-foreground">Clientes ativos</p>
              </div>
            </CardContent>
          </Card>
        </div>

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
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
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

              {!empresa?.slug && (
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
