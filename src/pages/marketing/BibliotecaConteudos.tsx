import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Search, FileText, Image, Video, Star, StarOff, Trash2, Copy, CalendarPlus,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const tipoConfig: Record<string, { icon: any; label: string; color: string }> = {
  texto: { icon: FileText, label: "Texto", color: "bg-blue-500/10 text-blue-600" },
  imagem: { icon: Image, label: "Imagem", color: "bg-pink-500/10 text-pink-600" },
  video: { icon: Video, label: "Vídeo/Roteiro", color: "bg-violet-500/10 text-violet-600" },
};

const plataformaEmoji: Record<string, string> = {
  instagram: "📸", facebook: "📘", tiktok: "🎵", youtube: "▶️", whatsapp: "💬",
  reels: "📸", shorts: "▶️",
};

export default function BibliotecaConteudos() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroPlataforma, setFiltroPlataforma] = useState("todas");

  const { data: conteudos = [] } = useQuery({
    queryKey: ["mkt-conteudos", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_conteudos").select("*").eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!empresaId,
  });

  const toggleFav = useMutation({
    mutationFn: async ({ id, favorito }: { id: string; favorito: boolean }) => {
      await supabase.from("marketing_conteudos").update({ favorito }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mkt-conteudos"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("marketing_conteudos").delete().eq("id", id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["mkt-conteudos"] }); toast({ title: "Removido" }); },
  });

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copiado!" }); };

  const filtered = conteudos.filter((c: any) => {
    if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
    if (filtroPlataforma !== "todas" && c.plataforma !== filtroPlataforma) return false;
    if (busca) {
      const s = busca.toLowerCase();
      return c.titulo?.toLowerCase().includes(s) || c.conteudo?.toLowerCase().includes(s) || c.hashtags?.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <MainLayout>
      <Header title="Biblioteca de Conteúdos" subtitle="Todos os conteúdos gerados pelo marketing" />
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="texto">Texto</SelectItem>
              <SelectItem value="imagem">Imagem</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroPlataforma} onValueChange={setFiltroPlataforma}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Plataforma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => navigate("/clientes/marketing")} size="sm"><Sparkles className="h-4 w-4 mr-1" /> Criar</Button>
        </div>

        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold mb-2">Nenhum conteúdo</h3>
              <p className="text-sm text-muted-foreground mb-4">Use "Criar Conteúdo" para gerar com IA</p>
              <Button onClick={() => navigate("/clientes/marketing")}><Sparkles className="h-4 w-4 mr-1" /> Criar Conteúdo</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c: any) => {
              const tc = tipoConfig[c.tipo] || tipoConfig.texto;
              const TipoIcon = tc.icon;
              return (
                <Card key={c.id} className="border-border/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] gap-1 ${tc.color}`}>
                          <TipoIcon className="h-3 w-3" /> {tc.label}
                        </Badge>
                        {c.plataforma && <span className="text-sm">{plataformaEmoji[c.plataforma] || ""}</span>}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(c.created_at), "dd/MM/yy", { locale: ptBR })}
                      </span>
                    </div>
                    {c.titulo && <p className="font-medium text-sm line-clamp-2">{c.titulo}</p>}
                    {c.conteudo && <p className="text-sm text-muted-foreground line-clamp-4">{c.conteudo}</p>}
                    {c.hashtags && <p className="text-xs text-primary/70 truncate">{c.hashtags}</p>}
                    <div className="flex items-center gap-1 pt-1 border-t border-border/30">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleFav.mutate({ id: c.id, favorito: !c.favorito })}>
                        {c.favorito ? <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" /> : <StarOff className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => c.conteudo && copyToClipboard(c.conteudo)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/marketing/agendamentos")}>
                        <CalendarPlus className="h-3.5 w-3.5" />
                      </Button>
                      <div className="flex-1" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMut.mutate(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
