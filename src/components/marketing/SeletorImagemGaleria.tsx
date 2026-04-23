import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ImageIcon, Sparkles, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (url: string) => void;
}

export function SeletorImagemGaleria({ open, onOpenChange, onSelect }: Props) {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [busca, setBusca] = useState("");

  const { data: imagens = [], isLoading } = useQuery({
    queryKey: ["marketing-imagens-seletor", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_imagens")
        .select("id, url, titulo, origem, favorito")
        .eq("empresa_id", empresaId!)
        .order("favorito", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!empresaId && open,
  });

  const filtered = imagens.filter((i: any) =>
    !busca ? true : i.titulo?.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Escolher imagem da galeria</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma imagem na galeria.</p>
              <p className="text-xs">Vá em Biblioteca → Galeria para importar ou gerar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filtered.map((img: any) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => { onSelect(img.url); onOpenChange(false); }}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-border/50 hover:border-primary hover:ring-2 hover:ring-primary/30 transition"
                >
                  <img src={img.url} alt={img.titulo || ""} className="w-full h-full object-cover" loading="lazy" />
                  <Badge variant="secondary" className="absolute top-1 left-1 text-[9px] gap-0.5 backdrop-blur-sm bg-background/80">
                    {img.origem === "ia" ? <><Sparkles className="h-2.5 w-2.5" /> IA</> : <><Upload className="h-2.5 w-2.5" /></>}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      </DialogContent>
    </Dialog>
  );
}
