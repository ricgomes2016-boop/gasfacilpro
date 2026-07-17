import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ThumbsUp, Share2 } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface Props {
  plataforma: string;
  imagemUrl?: string | null;
  texto?: string;
}

/**
 * Mockup visual de como o post aparecerá na rede social.
 * Suporta Instagram, Facebook e WhatsApp.
 */
export function PostPreview({ plataforma, imagemUrl, texto }: Props) {
  const { empresa } = useEmpresa();
  const handle = (empresa?.nome || "sua_marca").toLowerCase().replace(/\s+/g, "_").slice(0, 20);
  const inicial = (empresa?.nome || "M").charAt(0).toUpperCase();

  if (plataforma === "instagram" || plataforma === "reels") {
    return (
      <div className="max-w-sm mx-auto bg-background border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-warning via-primary to-primary p-[2px]">
              <div className="h-full w-full rounded-full bg-background flex items-center justify-center text-xs font-bold">
                {inicial}
              </div>
            </div>
            <span className="text-sm font-semibold">{handle}</span>
          </div>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </div>
        {imagemUrl ? (
          <img src={imagemUrl} alt="" className="w-full aspect-square object-cover" />
        ) : (
          <div className="w-full aspect-square bg-muted flex items-center justify-center text-muted-foreground text-xs">
            Sem imagem
          </div>
        )}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5" />
              <MessageCircle className="h-5 w-5" />
              <Send className="h-5 w-5" />
            </div>
            <Bookmark className="h-5 w-5" />
          </div>
          {texto && (
            <p className="text-sm whitespace-pre-wrap">
              <span className="font-semibold mr-1">{handle}</span>
              {texto}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (plataforma === "facebook") {
    return (
      <div className="max-w-sm mx-auto bg-background border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-info flex items-center justify-center text-white font-bold text-sm">
              {inicial}
            </div>
            <div>
              <p className="text-sm font-semibold">{empresa?.nome || "Sua Marca"}</p>
              <p className="text-[10px] text-muted-foreground">Agora · 🌐</p>
            </div>
          </div>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </div>
        {texto && <p className="px-3 pb-2 text-sm whitespace-pre-wrap">{texto}</p>}
        {imagemUrl && <img src={imagemUrl} alt="" className="w-full max-h-96 object-cover" />}
        <div className="flex items-center justify-around p-2 border-t border-border text-xs text-muted-foreground">
          <button className="flex items-center gap-1.5 px-3 py-1.5"><ThumbsUp className="h-4 w-4" /> Curtir</button>
          <button className="flex items-center gap-1.5 px-3 py-1.5"><MessageCircle className="h-4 w-4" /> Comentar</button>
          <button className="flex items-center gap-1.5 px-3 py-1.5"><Share2 className="h-4 w-4" /> Compartilhar</button>
        </div>
      </div>
    );
  }

  if (plataforma === "whatsapp") {
    return (
      <div className="max-w-sm mx-auto bg-[hsl(150_20%_92%)] dark:bg-muted p-4 rounded-xl">
        <div className="bg-background rounded-lg p-2 max-w-[85%] shadow-sm space-y-1.5">
          {imagemUrl && <img src={imagemUrl} alt="" className="w-full rounded object-cover max-h-64" />}
          {texto && <p className="text-sm whitespace-pre-wrap px-1">{texto}</p>}
          <p className="text-[10px] text-muted-foreground text-right">12:00 ✓✓</p>
        </div>
      </div>
    );
  }

  // fallback (tiktok, youtube)
  return (
    <div className="max-w-sm mx-auto bg-background border border-border rounded-xl overflow-hidden shadow-sm">
      {imagemUrl && <img src={imagemUrl} alt="" className="w-full aspect-[9/16] object-cover" />}
      {texto && <p className="p-3 text-sm whitespace-pre-wrap">{texto}</p>}
    </div>
  );
}
