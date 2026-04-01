import { useState, useRef } from "react";
import { TransportadoraLayout } from "@/components/transportadora/TransportadoraLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/transp-utils";
import { toast } from "sonner";
import { Plus, Receipt, Camera, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";

const TIPOS_DESPESA = [
  { value: "combustivel", label: "Combustível" },
  { value: "manutencao", label: "Manutenção" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "salario", label: "Salários" },
  { value: "pedagio", label: "Pedágio" },
  { value: "outros", label: "Outros" },
];

export default function TranspLancamento() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    tipo: "combustivel", descricao: "", valor: 0,
    data: format(new Date(), "yyyy-MM-dd"), veiculo_id: "", comprovante: null as File | null,
  });

  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ["transp-despesas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("transp_despesas").select("*").order("data", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ["transp-veiculos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("transp_veiculos").select("id, placa").eq("ativo", true);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-empresa", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("empresa_id").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const handlePhotoCapture = async (file: File) => {
    setForm(f => ({ ...f, comprovante: file }));
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setScanning(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("receipt-ocr", {
        body: { image_base64: base64 },
      });

      if (error) throw error;

      if (data) {
        setForm(f => ({
          ...f,
          tipo: data.tipo && TIPOS_DESPESA.some(t => t.value === data.tipo) ? data.tipo : f.tipo,
          descricao: data.descricao || f.descricao,
          valor: data.valor != null ? data.valor : f.valor,
          data: data.data || f.data,
        }));
        toast.success("✨ Despesa reconhecida automaticamente!", { description: "Confira os campos e ajuste se necessário." });
      }
    } catch (e: any) {
      console.error("OCR error:", e);
      toast.error("Não foi possível ler a foto", { description: "Preencha manualmente." });
    } finally {
      setScanning(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      let comprovante_url = null;
      if (form.comprovante) {
        const ext = form.comprovante.name.split(".").pop();
        const path = `${profile?.empresa_id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("transp-comprovantes").upload(path, form.comprovante);
        if (upErr) throw upErr;
        comprovante_url = path;
      }
      const { error } = await (supabase as any).from("transp_despesas").insert({
        empresa_id: profile?.empresa_id,
        tipo: form.tipo, descricao: form.descricao || null, valor: form.valor,
        data: form.data, veiculo_id: form.veiculo_id && form.veiculo_id !== "nenhum" ? form.veiculo_id : null,
        mes_referencia: form.data.slice(0, 7), comprovante_url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-despesas"] });
      toast.success("Despesa registrada!");
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({ tipo: "combustivel", descricao: "", valor: 0, data: format(new Date(), "yyyy-MM-dd"), veiculo_id: "", comprovante: null });
    setPreviewUrl(null);
  };

  const mesAtual = new Date().toISOString().slice(0, 7);
  const totalMes = despesas.filter((d: any) => d.data?.startsWith(mesAtual)).reduce((acc: number, d: any) => acc + Number(d.valor), 0);

  return (
    <TransportadoraLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Despesas</h1>
            <p className="text-muted-foreground text-sm">Despesas reais do mês · Total: <strong>{formatCurrency(totalMes)}</strong></p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Nova Despesa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Registrar Despesa</DialogTitle></DialogHeader>

              {/* Camera/AI Scan Area */}
              <div className="relative">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoCapture(file);
                    e.target.value = "";
                  }}
                />

                {previewUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img src={previewUrl} alt="Comprovante" className="w-full max-h-48 object-cover" />
                    {scanning && (
                      <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium text-foreground">Analisando com IA...</p>
                        <p className="text-xs text-muted-foreground">Reconhecendo dados do comprovante</p>
                      </div>
                    )}
                    {!scanning && (
                      <div className="absolute top-2 right-2">
                        <span className="inline-flex items-center gap-1 bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded-full">
                          <Sparkles className="h-3 w-3" /> Reconhecido
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="w-full border-2 border-dashed border-primary/40 rounded-lg p-6 flex flex-col items-center gap-2 hover:bg-primary/5 transition-colors"
                  >
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Camera className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Tirar foto do comprovante</p>
                    <p className="text-xs text-muted-foreground">A IA preenche automaticamente</p>
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">ou preencha manualmente</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({...form, tipo: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIPOS_DESPESA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({...form, data: e.target.value})} /></div>
                </div>
                <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({...form, valor: +e.target.value})} /></div>
                  <div><Label>Veículo</Label>
                    <Select value={form.veiculo_id} onValueChange={(v) => setForm({...form, veiculo_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        {veiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!previewUrl && (
                  <div>
                    <Label>Comprovante (arquivo)</Label>
                    <Input type="file" accept="image/*,application/pdf" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setForm({...form, comprovante: file});
                    }} />
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={save.isPending || scanning}>
                  {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : "Registrar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {despesas.map((d: any) => (
            <Card key={d.id} className="border-border/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground capitalize">{TIPOS_DESPESA.find(t => t.value === d.tipo)?.label || d.tipo}</p>
                    <p className="text-xs text-muted-foreground">{d.data} {d.descricao && `· ${d.descricao}`}</p>
                  </div>
                </div>
                <p className="font-bold text-foreground">{formatCurrency(Number(d.valor))}</p>
              </CardContent>
            </Card>
          ))}
          {!isLoading && despesas.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma despesa registrada</div>
          )}
        </div>
      </div>
    </TransportadoraLayout>
  );
}
