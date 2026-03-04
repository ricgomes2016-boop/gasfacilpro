import { useState, useEffect } from "react";
import { Download, Smartphone, CheckCircle, Share, MoreVertical, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Instalar() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const ua = navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
            <Flame className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Gás Fácil</h1>
          <p className="text-muted-foreground text-sm">
            Instale o app no seu celular para acesso rápido, mesmo offline.
          </p>
        </div>

        {isInstalled ? (
          <Card className="border-success/30 bg-success/5">
            <CardContent className="p-6 text-center space-y-3">
              <CheckCircle className="h-12 w-12 text-success mx-auto" />
              <h2 className="text-lg font-semibold">App já instalado!</h2>
              <p className="text-sm text-muted-foreground">
                O Gás Fácil já está instalado no seu dispositivo. Abra pela tela inicial.
              </p>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">Instalar agora</h2>
                  <p className="text-xs text-muted-foreground">Rápido, leve e sem loja de apps</p>
                </div>
              </div>
              <Button onClick={handleInstall} className="w-full gap-2" size="lg">
                <Download className="h-5 w-5" />
                Instalar Gás Fácil
              </Button>
            </CardContent>
          </Card>
        ) : isIos ? (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-center">Como instalar no iPhone</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">1</div>
                  <div>
                    <p className="text-sm font-medium">Toque no botão Compartilhar</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Share className="h-3.5 w-3.5" /> no Safari (barra inferior)
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">2</div>
                  <p className="text-sm font-medium">Selecione "Adicionar à Tela de Início"</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">3</div>
                  <p className="text-sm font-medium">Toque "Adicionar" para confirmar</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-center">Como instalar no Android</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">1</div>
                  <div>
                    <p className="text-sm font-medium">Toque no menu do navegador</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MoreVertical className="h-3.5 w-3.5" /> (três pontinhos no Chrome)
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">2</div>
                  <p className="text-sm font-medium">Selecione "Instalar app" ou "Adicionar à tela inicial"</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">3</div>
                  <p className="text-sm font-medium">Confirme a instalação</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Smartphone, label: "Acesso rápido" },
            { icon: Download, label: "Funciona offline" },
            { icon: CheckCircle, label: "Sem loja de apps" },
          ].map((b) => (
            <div key={b.label} className="text-center space-y-1.5">
              <div className="mx-auto h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <b.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">{b.label}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <a href="/auth" className="text-primary hover:underline">Voltar ao login</a>
        </p>
      </div>
    </div>
  );
}
