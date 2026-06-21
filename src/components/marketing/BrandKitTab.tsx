import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Sparkles, Palette, ShieldAlert, Hash } from "lucide-react";

type BrandKit = {
  id?: string;
  empresa_id: string;
  unidade_id: string | null;
  slogan: string;
  descricao_curta: string;
  tom_voz: string;
  paleta_cores: string[];
  hashtags_fixas: string;
  frases_proibidas: string;
  bairros_atendidos: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  whatsapp: string;
  link_app: string;
  faixa_preco_min: string;
  faixa_preco_max: string;
  observacoes: string;
};

const empty = (empresaId: string, unidadeId: string | null): BrandKit => ({
  empresa_id: empresaId,
  unidade_id: unidadeId,
  slogan: "",
  descricao_curta: "",
  tom_voz: "profissional",
  paleta_cores: [],
  hashtags_fixas: "",
  frases_proibidas: "",
  bairros_atendidos: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  whatsapp: "",
  link_app: "",
  faixa_preco_min: "",
  faixa_preco_max: "",
  observacoes: "",
});

export function BrandKitTab() {
  const qc = useQueryClient();
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const empresaId = empresa?.id;
  const unidadeId = unidadeAtual?.id || null;

  const [scope, setScope] = useState<"empresa" | "unidade">(unidadeId ? "unidade" : "empresa");
  const targetUnidade = scope === "unidade" ? unidadeId : null;

  const { data: kit, isLoading } = useQuery({
    queryKey: ["brand-kit", empresaId, targetUnidade],
    queryFn: async () => {
      if (!empresaId) return null;
      let q = supabase.from("marketing_brand_kit").select("*").eq("empresa_id", empresaId);
      q = targetUnidade ? q.eq("unidade_id", targetUnidade) : q.is("unidade_id", null);
      const { data } = await q.maybeSingle();
      return data;
    },
    enabled: !!empresaId,
  });

  const [form, setForm] = useState<BrandKit>(empty(empresaId || "", targetUnidade));

  useEffect(() => {
    if (!empresaId) return;
    if (kit) {
      const raw = (kit as any).paleta_cores;
      const cores: string[] = Array.isArray(raw) ? raw.map((c: any) => String(c)) : [];
      setForm({
        ...empty(empresaId, targetUnidade),
        ...(kit as any),
        paleta_cores: cores,
        faixa_preco_min: (kit as any).faixa_preco_min ? String((kit as any).faixa_preco_min) : "",
        faixa_preco_max: (kit as any).faixa_preco_max ? String((kit as any).faixa_preco_max) : "",
      });
    } else {
      setForm(empty(empresaId, targetUnidade));
    }
  }, [kit, empresaId, targetUnidade]);

  const save = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa não encontrada");
      const payload: any = {
        empresa_id: empresaId,
        unidade_id: targetUnidade,
        slogan: form.slogan || null,
        descricao_curta: form.descricao_curta || null,
        tom_voz: form.tom_voz || "profissional",
        paleta_cores: form.paleta_cores,
        hashtags_fixas: form.hashtags_fixas || null,
        frases_proibidas: form.frases_proibidas || null,
        bairros_atendidos: form.bairros_atendidos || null,
        instagram: form.instagram || null,
        facebook: form.facebook || null,
        tiktok: form.tiktok || null,
        whatsapp: form.whatsapp || null,
        link_app: form.link_app || null,
        faixa_preco_min: form.faixa_preco_min ? Number(form.faixa_preco_min) : null,
        faixa_preco_max: form.faixa_preco_max ? Number(form.faixa_preco_max) : null,
        observacoes: form.observacoes || null,
      };
      if (kit?.id) {
        const { error } = await supabase.from("marketing_brand_kit").update(payload).eq("id", kit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("marketing_brand_kit").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-kit"] });
      toast({ title: "Brand Kit salvo!" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const addColor = () => setForm((f) => ({ ...f, paleta_cores: [...f.paleta_cores, "#3b82f6"] }));
  const setColor = (i: number, v: string) =>
    setForm((f) => ({ ...f, paleta_cores: f.paleta_cores.map((c, idx) => (idx === i ? v : c)) }));
  const removeColor = (i: number) =>
    setForm((f) => ({ ...f, paleta_cores: f.paleta_cores.filter((_, idx) => idx !== i) }));

  if (!empresaId) return null;

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold text-sm">Identidade aplicada à IA</p>
              <p className="text-xs text-muted-foreground">
                Toda criação de conteúdo passa a usar este Brand Kit — nome, slogan, hashtags e tom de voz oficiais da marca.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Escopo</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="empresa">Padrão da empresa</SelectItem>
                {unidadeId && <SelectItem value="unidade">Apenas {unidadeAtual?.nome}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Identidade</CardTitle>
              <CardDescription>Como sua revenda fala com o cliente</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Slogan / frase de identidade</Label>
                <Input
                  value={form.slogan}
                  onChange={(e) => setForm((f) => ({ ...f, slogan: e.target.value }))}
                  placeholder='Ex.: "Seu gás na hora certa, com o melhor preço"'
                />
              </div>
              <div className="md:col-span-2">
                <Label>Descrição curta</Label>
                <Textarea
                  rows={2}
                  value={form.descricao_curta}
                  onChange={(e) => setForm((f) => ({ ...f, descricao_curta: e.target.value }))}
                  placeholder="Ex.: Revenda autorizada Ultragaz com 12 anos atendendo Curitiba e região metropolitana."
                />
              </div>
              <div>
                <Label>Tom de voz preferido</Label>
                <Select value={form.tom_voz} onValueChange={(v) => setForm((f) => ({ ...f, tom_voz: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="informal">Informal / próximo</SelectItem>
                    <SelectItem value="promocional">Promocional / urgente</SelectItem>
                    <SelectItem value="educacional">Educacional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bairros atendidos</Label>
                <Input
                  value={form.bairros_atendidos}
                  onChange={(e) => setForm((f) => ({ ...f, bairros_atendidos: e.target.value }))}
                  placeholder="Ex.: Centro, Batel, Água Verde, Portão"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Paleta de cores</CardTitle>
              <CardDescription>Cores oficiais para imagens IA seguirem</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 items-center">
                {form.paleta_cores.map((c, i) => (
                  <div key={i} className="flex items-center gap-1 border rounded-md px-1.5 py-1">
                    <input
                      type="color"
                      value={c}
                      onChange={(e) => setColor(i, e.target.value)}
                      className="w-7 h-7 cursor-pointer border-0 bg-transparent"
                    />
                    <Input value={c} onChange={(e) => setColor(i, e.target.value)} className="h-7 w-24 text-xs font-mono" />
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={() => removeColor(i)}>×</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addColor}>+ Cor</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Hash className="h-4 w-4" /> Hashtags & restrições</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Hashtags fixas (sempre incluir nos posts)</Label>
                <Input
                  value={form.hashtags_fixas}
                  onChange={(e) => setForm((f) => ({ ...f, hashtags_fixas: e.target.value }))}
                  placeholder="Ex.: #fortegas #gascuritiba #entregarapida"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-destructive" /> Frases / palavras proibidas</Label>
                <Textarea
                  rows={2}
                  value={form.frases_proibidas}
                  onChange={(e) => setForm((f) => ({ ...f, frases_proibidas: e.target.value }))}
                  placeholder="Ex.: nomes de concorrentes, gás barato, gás clandestino"
                />
                <p className="text-[11px] text-muted-foreground mt-1">A IA será instruída a NUNCA escrever esses termos.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contatos & redes</CardTitle>
              <CardDescription>Usados como CTA dos posts</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="(41) 99999-0000" />
              </div>
              <div>
                <Label>Instagram</Label>
                <Input value={form.instagram} onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} placeholder="@suarevenda" />
              </div>
              <div>
                <Label>Facebook</Label>
                <Input value={form.facebook} onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))} placeholder="facebook.com/suarevenda" />
              </div>
              <div>
                <Label>TikTok</Label>
                <Input value={form.tiktok} onChange={(e) => setForm((f) => ({ ...f, tiktok: e.target.value }))} placeholder="@suarevenda" />
              </div>
              <div className="md:col-span-2">
                <Label>Link do app / site</Label>
                <Input value={form.link_app} onChange={(e) => setForm((f) => ({ ...f, link_app: e.target.value }))} placeholder="https://app.suarevenda.com.br" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Faixa de preço (opcional)</CardTitle>
              <CardDescription>Ajuda a IA a manter coerência em promoções</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Mínimo (R$)</Label>
                <Input type="number" step="0.01" value={form.faixa_preco_min} onChange={(e) => setForm((f) => ({ ...f, faixa_preco_min: e.target.value }))} placeholder="95" />
              </div>
              <div>
                <Label>Máximo (R$)</Label>
                <Input type="number" step="0.01" value={form.faixa_preco_max} onChange={(e) => setForm((f) => ({ ...f, faixa_preco_max: e.target.value }))} placeholder="120" />
              </div>
              <div className="md:col-span-3">
                <Label>Observações para a IA</Label>
                <Textarea
                  rows={2}
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Ex.: Atendemos 24h. Preço promocional somente no PIX. Foco em famílias."
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Brand Kit
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
