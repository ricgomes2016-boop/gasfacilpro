import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "@/hooks/use-toast";
import { detectPlaceholders, applyPlaceholders, labelFor, suggestSchedule } from "@/lib/templatePlaceholders";
import { PostPreview } from "./PostPreview";
import { SeletorImagemGaleria } from "./SeletorImagemGaleria";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, X, Save, CalendarPlus, Eye, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: any | null;
}

export function AplicarTemplateModal({ open, onOpenChange, template }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const [values, setValues] = useState<Record<string, string>>({});
  const [imagemUrl, setImagemUrl] = useState<string>("");
  const [seletorOpen, setSeletorOpen] = useState(false);

  const placeholders = useMemo(
    () => (template ? detectPlaceholders(template.legenda, template.hashtags) : []),
    [template]
  );

  // Pré-preencher empresa
  useEffect(() => {
    if (template && empresa?.nome) {
      setValues((v) => ({ empresa: empresa.nome, ...v }));
    }
  }, [template, empresa?.nome]);

  useEffect(() => {
    if (!open) {
      setValues({});
      setImagemUrl("");
    }
  }, [open]);

  const legendaFinal = useMemo(
    () => (template ? applyPlaceholders(template.legenda, values) : ""),
    [template, values]
  );
  const hashtagsFinal = useMemo(
    () => (template?.hashtags ? applyPlaceholders(template.hashtags, values) : ""),
    [template, values]
  );

  const textoCompleto = [legendaFinal, hashtagsFinal].filter(Boolean).join("\n\n");

  // Variáveis pendentes (sem valor preenchido)
  const pendentes = useMemo(
    () => placeholders.filter((k) => !values[k]?.trim()),
    [placeholders, values]
  );
  const preenchidas = placeholders.filter((k) => values[k]?.trim());

  const salvarMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        empresa_id: empresa!.id,
        unidade_id: unidadeAtual?.id || null,
        tipo: template.plataforma === "whatsapp" ? "texto" : "imagem",
        plataforma: template.plataforma,
        titulo: template.nome,
        conteudo: legendaFinal,
        hashtags: hashtagsFinal || null,
      };
      if (imagemUrl) payload.midia_url = imagemUrl;
      const { error } = await supabase.from("marketing_conteudos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mkt-conteudos"] });
      toast({ title: "Salvo na biblioteca!" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const agendar = () => {
    if (pendentes.length > 0) {
      const ok = confirm(
        `Existem ${pendentes.length} variável(eis) sem preenchimento (${pendentes.map(labelFor).join(", ")}).\n\nElas aparecerão como {{${pendentes[0]}}} no post. Deseja continuar mesmo assim?`
      );
      if (!ok) return;
    }
    const sugestao = suggestSchedule(template.plataforma);
    const params = new URLSearchParams();
    params.set("legenda", textoCompleto);
    params.set("plataforma", template.plataforma);
    params.set("data", sugestao.data);
    params.set("hora", sugestao.hora);
    if (imagemUrl) params.set("imagem", imagemUrl);
    navigate(`/marketing/agendamentos?${params.toString()}`);
  };

  if (!template) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aplicar template: {template.nome}</DialogTitle>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-4 py-2">
            <div className="space-y-3">
              {placeholders.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Variáveis detectadas</Label>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        {preenchidas.length}/{placeholders.length}
                      </Badge>
                      {pendentes.length > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-warning/40 text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          {pendentes.length} pendente(s)
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Revise e confirme os valores que serão substituídos no post antes de agendar.
                  </p>
                  {placeholders.map((key) => {
                    const filled = !!values[key]?.trim();
                    return (
                      <div key={key}>
                        <Label className="text-xs flex items-center gap-1.5">
                          {filled ? (
                            <CheckCircle2 className="h-3 w-3 text-success" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-warning" />
                          )}
                          <span className={filled ? "text-foreground" : "text-warning"}>
                            {labelFor(key)}
                          </span>
                          <code className="text-[10px] text-muted-foreground">{`{{${key}}}`}</code>
                        </Label>
                        <Input
                          value={values[key] || ""}
                          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                          placeholder={`Ex: ${labelFor(key)}`}
                          className={!filled ? "border-warning/40" : ""}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <Label className="text-sm font-medium mb-1.5 block">Imagem (opcional)</Label>
                {imagemUrl ? (
                  <div className="relative">
                    <img src={imagemUrl} alt="" className="w-full max-h-40 object-cover rounded-lg border border-border" />
                    <Button
                      variant="destructive" size="icon" className="absolute top-1.5 right-1.5 h-7 w-7"
                      onClick={() => setImagemUrl("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setSeletorOpen(true)} className="w-full">
                    <ImageIcon className="h-4 w-4 mr-1.5" /> Escolher da Galeria
                  </Button>
                )}
              </div>

              {template.dica && (
                <div className="text-xs bg-muted/50 border border-border/50 rounded-md p-2.5 text-muted-foreground">
                  💡 <span className="font-medium">Dica:</span> {template.dica}
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Preview
              </Label>
              <div className="bg-muted/30 rounded-lg p-3">
                <PostPreview
                  plataforma={template.plataforma}
                  imagemUrl={imagemUrl || null}
                  texto={textoCompleto}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending}>
              <Save className="h-4 w-4 mr-1.5" /> Salvar na Biblioteca
            </Button>
            <Button onClick={agendar}>
              <CalendarPlus className="h-4 w-4 mr-1.5" /> Agendar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SeletorImagemGaleria
        open={seletorOpen}
        onOpenChange={setSeletorOpen}
        onSelect={(url) => setImagemUrl(url)}
      />
    </>
  );
}
