import { useState } from "react";
import { ClienteLayout } from "@/components/cliente/ClienteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCliente } from "@/contexts/ClienteContext";
import { 
  Gift, 
  Copy, 
  Share2, 
  Users, 
  Coins,
  CheckCircle,
  MessageCircle,
  Facebook,
  Twitter
} from "lucide-react";
import { toast } from "sonner";

export default function ClienteIndicacao() {
  const { referralCode, referralCount, walletBalance, empresaSlug } = useCliente();
  const [copied, setCopied] = useState(false);

  const appBaseUrl = "https://app.gasfacilpro.com.br/auth";
  const referralLink = `${appBaseUrl}?ref=${encodeURIComponent(referralCode)}${empresaSlug ? `&empresa=${encodeURIComponent(empresaSlug)}` : ""}`;
  const shareMessage = `🔥 Compre gás com desconto! Use meu código ${referralCode} e ganhe R$10 na primeira compra. Acesse: ${referralLink}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Erro ao copiar");
    }
  };

  const shareVia = (platform: string) => {
    let url = "";
    switch (platform) {
      case "whatsapp":
        url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
        break;
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`;
        break;
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`;
        break;
      default:
        if (navigator.share) {
          navigator.share({
            title: "Indique e Ganhe - GásExpress",
            text: shareMessage,
            url: referralLink
          });
          return;
        }
    }
    if (url) window.open(url, "_blank");
  };

  return (
    <ClienteLayout>
      <div className="space-y-4">
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground shadow-md">
          <div className="p-6 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-full">
                <Gift className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Indique e Ganhe</h1>
                <p className="text-primary-foreground/80">R$10 por cada amigo!</p>
              </div>
            </div>

            <p className="text-sm text-primary-foreground/90">
              Convide amigos para usar o GásExpress. Quando eles fizerem a primeira compra,
              você ganha R$10 na sua carteira!
            </p>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
            <Gift className="h-40 w-40" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{referralCount}</p>
              <p className="text-sm text-muted-foreground">Amigos indicados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Coins className="h-8 w-8 mx-auto text-amber-500 mb-2" />
              <p className="text-2xl font-bold">R$ {walletBalance.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Ganho total</p>
            </CardContent>
          </Card>
        </div>

        {/* Referral Code */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Seu Código de Indicação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 bg-muted rounded-lg p-3 font-mono text-lg font-bold text-center">
                {referralCode}
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(referralCode)}
              >
                {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Referral Link */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Seu Link de Indicação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input 
                value={referralLink} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(referralLink)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Share Buttons */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Compartilhar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="gap-2 h-12 bg-green-500/10 border-green-500/30 text-green-600 hover:bg-green-500/20"
                onClick={() => shareVia("whatsapp")}
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </Button>
              <Button 
                variant="outline" 
                className="gap-2 h-12 bg-blue-500/10 border-blue-500/30 text-blue-600 hover:bg-blue-500/20"
                onClick={() => shareVia("facebook")}
              >
                <Facebook className="h-5 w-5" />
                Facebook
              </Button>
              <Button 
                variant="outline" 
                className="gap-2 h-12 bg-sky-500/10 border-sky-500/30 text-sky-600 hover:bg-sky-500/20"
                onClick={() => shareVia("twitter")}
              >
                <Twitter className="h-5 w-5" />
                Twitter
              </Button>
              <Button 
                variant="outline" 
                className="gap-2 h-12"
                onClick={() => shareVia("native")}
              >
                <Share2 className="h-5 w-5" />
                Outros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Como Funciona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Badge className="h-6 w-6 rounded-full flex items-center justify-center shrink-0">1</Badge>
                <div>
                  <p className="font-medium">Compartilhe seu link</p>
                  <p className="text-sm text-muted-foreground">Envie para amigos e familiares</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge className="h-6 w-6 rounded-full flex items-center justify-center shrink-0">2</Badge>
                <div>
                  <p className="font-medium">Amigo faz cadastro</p>
                  <p className="text-sm text-muted-foreground">E realiza a primeira compra</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Badge className="h-6 w-6 rounded-full flex items-center justify-center shrink-0">3</Badge>
                <div>
                  <p className="font-medium">Vocês dois ganham!</p>
                  <p className="text-sm text-muted-foreground">R$10 na carteira de cada um</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClienteLayout>
  );
}
