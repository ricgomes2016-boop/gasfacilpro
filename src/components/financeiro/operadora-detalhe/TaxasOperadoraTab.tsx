import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  operadoraId: string;
  initial: {
    taxa_debito: number;
    taxa_credito_vista: number;
    taxa_credito_parcelado: number;
    taxa_pix: number | null;
    prazo_debito: number;
    prazo_credito: number;
    prazo_pix: number | null;
  };
}

export function TaxasOperadoraTab({ operadoraId, initial }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial); }, [initial]);

  const upd = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v === "" ? null : Number(v) } as any));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("operadoras_cartao").update(form).eq("id", operadoraId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Taxas atualizadas");
    qc.invalidateQueries({ queryKey: ["operadora-cartao", operadoraId] });
  };

  const Field = ({ label, k, suf }: { label: string; k: keyof typeof form; suf: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type="number" step="0.01"
          value={form[k] ?? ""}
          onChange={(e) => upd(k, e.target.value)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suf}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Taxas aplicadas</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Débito" k="taxa_debito" suf="%" />
          <Field label="Crédito à vista" k="taxa_credito_vista" suf="%" />
          <Field label="Crédito parcelado" k="taxa_credito_parcelado" suf="%" />
          <Field label="PIX" k="taxa_pix" suf="%" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Prazos de liquidação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Débito" k="prazo_debito" suf="dias" />
          <Field label="Crédito" k="prazo_credito" suf="dias" />
          <Field label="PIX" k="prazo_pix" suf="dias" />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" />Salvar alterações
        </Button>
      </div>
    </div>
  );
}
