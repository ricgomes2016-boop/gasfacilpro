import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const exemplos = [
  "Promoção de gás P13 com fundo azul e botijão em destaque",
  "Banner de entrega rápida de gás em até 30 minutos",
  "Post de bom dia com imagem de cozinha aconchegante e botijão",
  "Anúncio de água mineral 20L gelada em dia quente",
];

export function GerarImagemModal({ open, onOpenChange }: Props) {
  const { empresa, unidadeAtual } = useEmpresa();
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGerar = async () => {
    if (!prompt.trim() || !empresa?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-ai", {
        body: {
          type: "image",
          imagePrompt: prompt,
          save: true,
          empresa_id: empresa.id,
          unidade_id: unidadeAtual?.id || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Imagem gerada!", description: "Salva na galeria." });
      qc.invalidateQueries({ queryKey: ["marketing-imagens"] });
      setPrompt("");
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Erro ao gerar imagem",
        description: e.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Gerar Imagem com IA
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Descreva a imagem</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Botijão de gás P13 azul com fundo de cozinha moderna, estilo promocional..."
              rows={4}
              disabled={loading}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Exemplos rápidos:</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {exemplos.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  disabled={loading}
                  className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/70 border border-border/50"
                >
                  {ex.slice(0, 40)}...
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleGerar} disabled={loading || !prompt.trim()}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Gerar Imagem</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
