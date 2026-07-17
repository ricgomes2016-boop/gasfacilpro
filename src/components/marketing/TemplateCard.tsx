import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, StarOff, Edit, Copy, Trash2, Eye, Wand2, Lock } from "lucide-react";

const plataformaEmoji: Record<string, string> = {
  instagram: "📸", facebook: "📘", whatsapp: "💬", reels: "📸", tiktok: "🎵",
};

const categoriaLabel: Record<string, string> = {
  promocao: "Promoção",
  institucional: "Institucional",
  data: "Data Comemorativa",
  engajamento: "Engajamento",
  lancamento: "Lançamento",
};

const categoriaColor: Record<string, string> = {
  promocao: "bg-warning/10 text-warning",
  institucional: "bg-info/10 text-info",
  data: "bg-primary/10 text-primary",
  engajamento: "bg-primary/10 text-primary",
  lancamento: "bg-success/10 text-success",
};

interface Props {
  template: any;
  onUse: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleFav: () => void;
}

export function TemplateCard({ template, onUse, onPreview, onEdit, onDuplicate, onDelete, onToggleFav }: Props) {
  const isPadrao = template.is_padrao;
  return (
    <Card className="border-border/50 flex flex-col">
      <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">{plataformaEmoji[template.plataforma] || "📝"}</span>
              <p className="font-semibold text-sm truncate">{template.nome}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${categoriaColor[template.categoria] || ""}`}>
                {categoriaLabel[template.categoria] || template.categoria}
              </Badge>
              {isPadrao && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Lock className="h-2.5 w-2.5" /> Padrão
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onToggleFav}>
            {template.favorito ? (
              <Star className="h-3.5 w-3.5 text-warning fill-warning" />
            ) : (
              <StarOff className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap flex-1">
          {template.legenda}
        </p>

        {template.hashtags && (
          <p className="text-[11px] text-primary/70 truncate">{template.hashtags}</p>
        )}

        <div className="flex items-center gap-1 pt-2 border-t border-border/30">
          <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" onClick={onUse}>
            <Wand2 className="h-3 w-3" /> Usar
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPreview} title="Visualizar">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {!isPadrao && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Editar">
              <Edit className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate} title="Duplicar">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {!isPadrao && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} title="Excluir">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
