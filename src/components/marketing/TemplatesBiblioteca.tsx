import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, FileText, Star } from "lucide-react";
import { TemplateCard } from "./TemplateCard";
import { AplicarTemplateModal } from "./AplicarTemplateModal";
import { EditorTemplateModal } from "./EditorTemplateModal";
import { PostPreview } from "./PostPreview";

export function TemplatesBiblioteca() {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [busca, setBusca] = useState("");
  const [filtroPlataforma, setFiltroPlataforma] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [favOnly, setFavOnly] = useState(false);

  const [aplicarItem, setAplicarItem] = useState<any | null>(null);
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [editorItem, setEditorItem] = useState<any | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ["mkt-templates", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_templates")
        .select("*")
        .order("is_padrao", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const toggleFav = useMutation({
    mutationFn: async ({ id, favorito, isPadrao }: { id: string; favorito: boolean; isPadrao: boolean }) => {
      if (isPadrao) {
        toast({ title: "Templates padrão não podem ser favoritados aqui", description: "Duplique para favoritar." });
        return;
      }
      const { error } = await supabase.from("marketing_templates").update({ favorito }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mkt-templates"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mkt-templates"] }); toast({ title: "Removido" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const duplicar = useMutation({
    mutationFn: async (t: any) => {
      const { error } = await supabase.from("marketing_templates").insert({
        empresa_id: empresaId!,
        nome: `${t.nome} (cópia)`,
        plataforma: t.plataforma,
        categoria: t.categoria,
        legenda: t.legenda,
        hashtags: t.hashtags,
        dica: t.dica,
        is_padrao: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mkt-templates"] }); toast({ title: "Template duplicado" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return templates.filter((t: any) => {
      if (filtroPlataforma !== "todas" && t.plataforma !== filtroPlataforma) return false;
      if (filtroCategoria !== "todas" && t.categoria !== filtroCategoria) return false;
      if (favOnly && !t.favorito) return false;
      if (busca) {
        const s = busca.toLowerCase();
        return t.nome?.toLowerCase().includes(s) || t.legenda?.toLowerCase().includes(s);
      }
      return true;
    });
  }, [templates, filtroPlataforma, filtroCategoria, favOnly, busca]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar templates..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={filtroPlataforma} onValueChange={setFiltroPlataforma}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas plataformas</SelectItem>
            <SelectItem value="instagram">📸 Instagram</SelectItem>
            <SelectItem value="facebook">📘 Facebook</SelectItem>
            <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
            <SelectItem value="reels">🎬 Reels</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            <SelectItem value="promocao">Promoção</SelectItem>
            <SelectItem value="institucional">Institucional</SelectItem>
            <SelectItem value="data">Datas</SelectItem>
            <SelectItem value="engajamento">Engajamento</SelectItem>
            <SelectItem value="lancamento">Lançamento</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={favOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setFavOnly(!favOnly)}
          className="gap-1.5"
        >
          <Star className={`h-4 w-4 ${favOnly ? "fill-current" : ""}`} /> Favoritos
        </Button>
        <Button size="sm" onClick={() => { setEditorItem(null); setEditorOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo template
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold mb-2">Nenhum template encontrado</h3>
            <p className="text-sm text-muted-foreground mb-4">Ajuste os filtros ou crie um novo template.</p>
            <Button onClick={() => { setEditorItem(null); setEditorOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t: any) => (
            <TemplateCard
              key={t.id}
              template={t}
              onUse={() => setAplicarItem(t)}
              onPreview={() => setPreviewItem(t)}
              onEdit={() => { setEditorItem(t); setEditorOpen(true); }}
              onDuplicate={() => duplicar.mutate(t)}
              onDelete={() => { if (confirm(`Excluir "${t.nome}"?`)) deleteMut.mutate(t.id); }}
              onToggleFav={() => toggleFav.mutate({ id: t.id, favorito: !t.favorito, isPadrao: t.is_padrao })}
            />
          ))}
        </div>
      )}

      <AplicarTemplateModal
        open={!!aplicarItem}
        onOpenChange={(v) => !v && setAplicarItem(null)}
        template={aplicarItem}
      />

      <EditorTemplateModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editorItem}
      />

      <Dialog open={!!previewItem} onOpenChange={(v) => !v && setPreviewItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Preview: {previewItem?.nome}</DialogTitle></DialogHeader>
          {previewItem && (
            <div className="bg-muted/30 rounded-lg p-3">
              <PostPreview
                plataforma={previewItem.plataforma}
                texto={[previewItem.legenda, previewItem.hashtags].filter(Boolean).join("\n\n")}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
