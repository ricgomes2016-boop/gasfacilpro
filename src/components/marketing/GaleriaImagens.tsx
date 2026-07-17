import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Upload, Sparkles, Loader2, Star, StarOff, Copy, Download, Trash2, CalendarPlus, ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { GerarImagemModal } from "./GerarImagemModal";

export function GaleriaImagens() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("todas");
  const [apenasFav, setApenasFav] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openGerar, setOpenGerar] = useState(false);

  const { data: imagens = [], isLoading } = useQuery({
    queryKey: ["marketing-imagens", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_imagens")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const toggleFav = useMutation({
    mutationFn: async ({ id, favorito }: { id: string; favorito: boolean }) => {
      await supabase.from("marketing_imagens").update({ favorito }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-imagens"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (img: any) => {
      // tenta remover do bucket
      try {
        const url = new URL(img.url);
        const parts = url.pathname.split("/storage/v1/object/public/marketing-assets/");
        if (parts.length > 1) {
          await supabase.storage.from("marketing-assets").remove([parts[1]]);
        }
      } catch {}
      await supabase.from("marketing_imagens").delete().eq("id", img.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing-imagens"] });
      toast({ title: "Imagem removida" });
    },
  });

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !empresaId) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máx 8MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `imagens/${empresaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("marketing-assets")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("marketing-assets").getPublicUrl(path);
      const { error: insErr } = await supabase.from("marketing_imagens").insert({
        empresa_id: empresaId,
        url: pub.publicUrl,
        origem: "importada",
        titulo: file.name,
      });
      if (insErr) throw insErr;

      toast({ title: "Imagem importada!" });
      qc.invalidateQueries({ queryKey: ["marketing-imagens"] });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "URL copiada!" });
  };

  const filtered = imagens.filter((i: any) => {
    if (filtroOrigem !== "todas" && i.origem !== filtroOrigem) return false;
    if (apenasFav && !i.favorito) return false;
    if (busca) {
      const s = busca.toLowerCase();
      return (
        i.titulo?.toLowerCase().includes(s) ||
        i.tags?.toLowerCase().includes(s) ||
        i.prompt?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar imagem..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="ia">Geradas IA</SelectItem>
            <SelectItem value="importada">Importadas</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={apenasFav ? "default" : "outline"}
          size="sm"
          onClick={() => setApenasFav(!apenasFav)}
        >
          <Star className="h-4 w-4 mr-1" /> Favoritas
        </Button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImport} className="hidden" />
        <Button variant="import" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Importar
        </Button>
        <Button size="sm" onClick={() => setOpenGerar(true)}>
          <Sparkles className="h-4 w-4 mr-1" /> Gerar com IA
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <div className="py-12 text-center">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma imagem ainda</h3>
            <p className="text-sm text-muted-foreground mb-4">Importe ou gere imagens com IA para usar nos seus posts</p>
            <div className="flex gap-2 justify-center">
              <Button variant="import" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Importar
              </Button>
              <Button onClick={() => setOpenGerar(true)}>
                <Sparkles className="h-4 w-4 mr-1" /> Gerar com IA
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((img: any) => (
            <Card key={img.id} className="overflow-hidden group border-border/50">
              <div className="aspect-square bg-muted relative">
                <img src={img.url} alt={img.titulo || ""} className="w-full h-full object-cover" loading="lazy" />
                <Badge
                  variant="secondary"
                  className="absolute top-1.5 left-1.5 text-[9px] gap-1 backdrop-blur-sm bg-background/80"
                >
                  {img.origem === "ia" ? <><Sparkles className="h-2.5 w-2.5" /> IA</> : <><Upload className="h-2.5 w-2.5" /> Importada</>}
                </Badge>
                {img.favorito && (
                  <Star className="absolute top-1.5 right-1.5 h-4 w-4 text-warning fill-warning drop-shadow" />
                )}
              </div>
              <div className="p-2 space-y-1.5">
                {img.titulo && (
                  <p className="text-xs font-medium line-clamp-1" title={img.titulo}>{img.titulo}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(img.created_at), "dd/MM/yy", { locale: ptBR })}
                </p>
                <div className="flex items-center gap-0.5 pt-1 border-t border-border/30">
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    title="Usar em post"
                    onClick={() => navigate(`/marketing/agendamentos?imagem=${encodeURIComponent(img.url)}`)}
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    title="Favoritar"
                    onClick={() => toggleFav.mutate({ id: img.id, favorito: !img.favorito })}
                  >
                    {img.favorito ? <Star className="h-3.5 w-3.5 text-warning fill-warning" /> : <StarOff className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    title="Copiar URL"
                    onClick={() => copyUrl(img.url)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    title="Baixar"
                    asChild
                  >
                    <a href={img.url} target="_blank" rel="noreferrer" download>
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                    title="Excluir"
                    onClick={() => {
                      if (confirm("Excluir esta imagem?")) deleteMut.mutate(img);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <GerarImagemModal open={openGerar} onOpenChange={setOpenGerar} />
    </div>
  );
}
