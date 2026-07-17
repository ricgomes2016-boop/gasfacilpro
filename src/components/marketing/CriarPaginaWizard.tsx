import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Instagram, Facebook, Music2, Youtube, MessageCircle, ExternalLink, Check, Sparkles, Loader2 } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ConectarRedeSocialButton } from "./ConectarRedeSocialButton";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const plataformas = [
  {
    id: "instagram",
    nome: "Instagram",
    icon: Instagram,
    color: "text-primary",
    url: "https://www.instagram.com/accounts/emailsignup/",
    requisitos: ["E-mail ou telefone", "Logo (quadrada, mín 320x320)", "Bio até 150 caracteres", "Conta vinculada ao Facebook (para publicar via API)"],
    dica: "Depois de criar, converta para conta Business em Configurações → Tipo de conta.",
  },
  {
    id: "facebook",
    nome: "Página do Facebook",
    icon: Facebook,
    color: "text-info",
    url: "https://www.facebook.com/pages/create",
    requisitos: ["Conta pessoal do Facebook", "Categoria do negócio", "Endereço e horário de funcionamento", "Foto de perfil + capa"],
    dica: "Categoria sugerida: 'Loja de Gás' ou 'Distribuidora'.",
  },
  {
    id: "tiktok",
    nome: "TikTok Business",
    icon: Music2,
    color: "text-foreground",
    url: "https://www.tiktok.com/signup",
    requisitos: ["Telefone ou e-mail", "Idade mínima 13 anos", "Logo + bio curta"],
    dica: "Após criar, ative a conta Business em Configurações para acessar análises.",
  },
  {
    id: "youtube",
    nome: "Canal do YouTube",
    icon: Youtube,
    color: "text-destructive",
    url: "https://www.youtube.com/create_channel",
    requisitos: ["Conta Google", "Foto de perfil 800x800", "Banner 2560x1440", "Descrição do canal"],
    dica: "Use o nome da empresa + cidade no canal para SEO local.",
  },
  {
    id: "whatsapp",
    nome: "WhatsApp Business",
    icon: MessageCircle,
    color: "text-success",
    url: "https://business.whatsapp.com/",
    requisitos: ["Número de telefone exclusivo", "Logo da empresa", "Endereço", "Horário de atendimento"],
    dica: "Para integrar com o sistema, use o WhatsApp Cloud API após validar o número.",
  },
];

export function CriarPaginaWizard({ open, onOpenChange }: Props) {
  const { empresa } = useEmpresa();
  const [selected, setSelected] = useState<string | null>(null);
  const [bioSugerida, setBioSugerida] = useState<string>("");
  const [gerando, setGerando] = useState(false);

  const plat = plataformas.find((p) => p.id === selected);

  const sugestaoNome = empresa
    ? `${empresa.nome.replace(/\s+/g, "")}Oficial`
    : "SuaEmpresaOficial";

  const gerarBio = async () => {
    if (!plat) return;
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-ai", {
        body: {
          tipo: "bio",
          plataforma: plat.id,
          empresa: empresa?.nome,
          contexto: `Bio curta e atrativa para ${plat.nome} de uma distribuidora de gás chamada ${empresa?.nome}.`,
        },
      });
      if (error) throw error;
      setBioSugerida(data?.resultado || data?.text || "Gás rápido, seguro e no melhor preço da cidade. 🔥 Peça já!");
    } catch {
      setBioSugerida(`${empresa?.nome} • Entrega de gás rápida e segura 🔥 Peça pelo WhatsApp!`);
    } finally {
      setGerando(false);
    }
  };

  const copiar = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast({ title: "Copiado!" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Criar nova página em rede social
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Não criamos a conta automaticamente (regras das plataformas), mas guiamos você
              passo a passo e conectamos automaticamente depois.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {plataformas.map((p) => (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setSelected(p.id)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${p.color}`}>
                      <p.icon className="h-5 w-5" />
                    </div>
                    <span className="font-medium text-sm">{p.nome}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : plat ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${plat.color}`}>
                <plat.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">{plat.nome}</h3>
                <p className="text-xs text-muted-foreground">{plat.dica}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">📋 Pré-requisitos</h4>
              <ul className="space-y-1.5">
                {plat.requisitos.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Sugestão de @ / nome</span>
                <Badge variant="secondary" className="text-[10px]">Auto</Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-mono">@{sugestaoNome.toLowerCase()}</code>
                <Button size="sm" variant="ghost" onClick={() => copiar(sugestaoNome.toLowerCase())}>
                  Copiar
                </Button>
              </div>
            </div>

            <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Sugestão de bio (IA)</span>
                <Button size="sm" variant="ghost" onClick={gerarBio} disabled={gerando}>
                  {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {gerando ? " Gerando..." : " Gerar com IA"}
                </Button>
              </div>
              {bioSugerida && (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm">{bioSugerida}</p>
                  <Button size="sm" variant="ghost" onClick={() => copiar(bioSugerida)}>
                    Copiar
                  </Button>
                </div>
              )}
            </div>

            <Button asChild className="w-full" size="lg">
              <a href={plat.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir cadastro do {plat.nome}
              </a>
            </Button>

            {(plat.id === "instagram" || plat.id === "facebook") && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  Já criou? Conecte agora para publicar automaticamente:
                </p>
                <ConectarRedeSocialButton onConnected={() => onOpenChange(false)} />
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          {selected && (
            <Button variant="outline" onClick={() => setSelected(null)}>
              ← Voltar
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
