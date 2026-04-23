import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "@/hooks/use-toast";

const PLACEHOLDERS = ["empresa", "produto", "preco", "telefone", "cupom", "cliente"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template?: any | null;
}

export function EditorTemplateModal({ open, onOpenChange, template }: Props) {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresa();
  const [form, setForm] = useState({
    nome: "",
    plataforma: "instagram",
    categoria: "promocao",
    legenda: "",
    hashtags: "",
    dica: "",
  });

  useEffect(() => {
    if (template) {
      setForm({
        nome: template.nome || "",
        plataforma: template.plataforma || "instagram",
        categoria: template.categoria || "promocao",
        legenda: template.legenda || "",
        hashtags: template.hashtags || "",
        dica: template.dica || "",
      });
    } else if (open) {
      setForm({ nome: "", plataforma: "instagram", categoria: "promocao", legenda: "", hashtags: "", dica: "" });
    }
  }, [template, open]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        empresa_id: empresa!.id,
        nome: form.nome,
        plataforma: form.plataforma,
        categoria: form.categoria,
        legenda: form.legenda,
        hashtags: form.hashtags || null,
        dica: form.dica || null,
        is_padrao: false,
      };
      if (template?.id) {
        const { error } = await supabase.from("marketing_templates").update(payload).eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("marketing_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mkt-templates"] });
      toast({ title: template ? "Template atualizado" : "Template criado!" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const insertPlaceholder = (key: string) => {
    setForm((f) => ({ ...f, legenda: f.legenda + `{{${key}}}` }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar template" : "Novo template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Promoção quinta-feira" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plataforma</Label>
              <Select value={form.plataforma} onValueChange={(v) => setForm((f) => ({ ...f, plataforma: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">📸 Instagram</SelectItem>
                  <SelectItem value="facebook">📘 Facebook</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="reels">🎬 Reels</SelectItem>
                  <SelectItem value="tiktok">🎵 TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="promocao">Promoção</SelectItem>
                  <SelectItem value="institucional">Institucional</SelectItem>
                  <SelectItem value="data">Data Comemorativa</SelectItem>
                  <SelectItem value="engajamento">Engajamento</SelectItem>
                  <SelectItem value="lancamento">Lançamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Legenda</Label>
            <Textarea value={form.legenda} onChange={(e) => setForm((f) => ({ ...f, legenda: e.target.value }))} rows={6} placeholder="Use {{empresa}}, {{produto}}, etc..." />
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-[11px] text-muted-foreground self-center mr-1">Inserir:</span>
              {PLACEHOLDERS.map((p) => (
                <Button key={p} type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={() => insertPlaceholder(p)}>
                  {`{{${p}}}`}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>Hashtags (opcional)</Label>
            <Input value={form.hashtags} onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))} placeholder="#promocao #gas" />
          </div>
          <div>
            <Label>Dica de uso (opcional)</Label>
            <Textarea value={form.dica} onChange={(e) => setForm((f) => ({ ...f, dica: e.target.value }))} rows={2} placeholder="Ex: Postar pela manhã para mais alcance" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={!form.nome || !form.legenda || saveMut.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
