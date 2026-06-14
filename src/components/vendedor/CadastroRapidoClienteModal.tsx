import { useEffect, useState } from "react";
import { z } from "zod";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogFooter as DialogFooter,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { geocodeAddress } from "@/lib/geocoding";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ClienteVendedor } from "./ClienteSearchVendedor";

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  telefone: z.string().trim().min(10, "Telefone inválido").max(20),
  cep: z.string().trim().max(9).optional().or(z.literal("")),
  endereco: z.string().trim().max(160).optional().or(z.literal("")),
  numero: z.string().trim().max(20).optional().or(z.literal("")),
  complemento: z.string().trim().max(80).optional().or(z.literal("")),
  bairro: z.string().trim().max(80).optional().or(z.literal("")),
  cidade: z.string().trim().max(80).optional().or(z.literal("")),
  estado: z.string().trim().max(2).optional().or(z.literal("")),
  ponto_referencia: z.string().trim().max(160).optional().or(z.literal("")),
  tipo: z.enum(["residencial", "comercial"]),
  canal_venda_id: z.string().optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  termoInicial: string;
  onCriado: (cliente: ClienteVendedor) => void;
}

interface CanalVenda { id: string; nome: string; }

export function CadastroRapidoClienteModal({ open, onOpenChange, termoInicial, onCriado }: Props) {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [canais, setCanais] = useState<CanalVenda[]>([]);

  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    ponto_referencia: "",
    tipo: "residencial" as "residencial" | "comercial",
    canal_venda_id: "nenhum",
  });

  useEffect(() => {
    if (!open) return;
    // pré-preenche nome ou telefone com termo inicial
    const t = termoInicial.trim();
    const isPhone = /^\d{8,}$/.test(t.replace(/\D/g, "")) && t.replace(/\D/g, "").length >= 8;
    setForm((f) => ({
      ...f,
      nome: !isPhone && t.length > 0 && !/\d/.test(t) ? t : f.nome,
      telefone: isPhone ? t : f.telefone,
      endereco: !isPhone && /\d/.test(t) ? t : f.endereco,
    }));
  }, [open, termoInicial]);

  useEffect(() => {
    if (!open || !unidadeAtual?.id) return;
    (async () => {
      const { data } = await supabase
        .from("canais_venda")
        .select("id, nome")
        .eq("unidade_id", unidadeAtual.id)
        .eq("ativo", true)
        .order("nome");
      setCanais((data as any) || []);
    })();
  }, [open, unidadeAtual?.id]);

  const lookupCep = async (cepRaw: string) => {
    const cep = cepRaw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setLoadingCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (j && !j.erro) {
        setForm((f) => ({
          ...f,
          endereco: j.logradouro || f.endereco,
          bairro: j.bairro || f.bairro,
          cidade: j.localidade || f.cidade,
          estado: j.uf || f.estado,
        }));
      }
    } catch { /* silencioso */ }
    finally { setLoadingCep(false); }
  };

  const salvar = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Verifique os campos");
      return;
    }
    if (!empresa?.id || !unidadeAtual?.id) {
      toast.error("Sessão inválida");
      return;
    }
    setSaving(true);
    try {
      // geocoding best-effort
      let lat: number | null = null;
      let lng: number | null = null;
      const enderecoFull = [
        form.endereco,
        form.numero,
        form.bairro,
        form.cidade,
        form.estado,
      ].filter(Boolean).join(", ");
      if (enderecoFull.length > 8) {
        try {
          const geo = await geocodeAddress(enderecoFull);
          if (geo) { lat = geo.latitude; lng = geo.longitude; }
        } catch { /* silencioso */ }
      }

      const enderecoFinal = form.complemento
        ? `${form.endereco}${form.complemento ? ` - ${form.complemento}` : ""}`
        : form.endereco;

      const { data: cliente, error } = await (supabase as any)
        .from("clientes")
        .insert({
          empresa_id: empresa.id,
          nome: form.nome.trim(),
          telefone: form.telefone.replace(/\D/g, ""),
          cep: form.cep.replace(/\D/g, "") || null,
          endereco: enderecoFinal || null,
          numero: form.numero || null,
          bairro: form.bairro || null,
          cidade: form.cidade || null,
          estado: form.estado || null,
          tipo: form.tipo,
          ativo: true,
          latitude: lat,
          longitude: lng,
        })
        .select("id, nome, telefone, endereco, numero, bairro, cidade, cep, tipo")
        .single();
      if (error) throw error;

      // vincula à unidade atual
      await (supabase as any).from("cliente_unidades").insert({
        cliente_id: cliente.id,
        unidade_id: unidadeAtual.id,
      });

      // ponto de referência → cliente_observacoes
      if (form.ponto_referencia.trim()) {
        await (supabase as any).from("cliente_observacoes").insert({
          cliente_id: cliente.id,
          observacao: `Ponto de referência: ${form.ponto_referencia.trim()}`,
        });
      }

      toast.success("Cliente cadastrado!");
      onCriado(cliente as ClienteVendedor);
      onOpenChange(false);
      // reset
      setForm({
        nome: "", telefone: "", cep: "", endereco: "", numero: "", complemento: "",
        bairro: "", cidade: "", estado: "", ponto_referencia: "",
        tipo: "residencial", canal_venda_id: "nenhum",
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar cliente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cadastro rápido de cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pb-2">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Nome *</Label>
              <Input className="text-base" value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input className="text-base" inputMode="tel" value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label>CEP</Label>
                <div className="relative">
                  <Input className="text-base" inputMode="numeric" value={form.cep}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, cep: v });
                      if (v.replace(/\D/g, "").length === 8) lookupCep(v);
                    }} />
                  {loadingCep && (
                    <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
              <div>
                <Label>UF</Label>
                <Input className="text-base" maxLength={2} value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input className="text-base" value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Número</Label>
                <Input className="text-base" value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })} />
              </div>
              <div>
                <Label>Complemento</Label>
                <Input className="text-base" value={form.complemento}
                  onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Bairro</Label>
                <Input className="text-base" value={form.bairro}
                  onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input className="text-base" value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Ponto de referência</Label>
              <Input className="text-base" value={form.ponto_referencia}
                onChange={(e) => setForm({ ...form, ponto_referencia: e.target.value })}
                placeholder="Ex.: ao lado da padaria" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residencial">Residencial</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Canal de venda</Label>
                <Select value={form.canal_venda_id}
                  onValueChange={(v) => setForm({ ...form, canal_venda_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">—</SelectItem>
                    {canais.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? "Salvando..." : "Cadastrar cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
