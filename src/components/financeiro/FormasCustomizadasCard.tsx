import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import { buildCustomSlug, FormaPagamentoCustom } from "@/hooks/useFormasPagamentoCustom";

const EMOJIS = ["💰", "💵", "📱", "💳", "🎫", "🏦", "📝", "🔥", "🧾", "🛒", "🎁", "⭐"];

interface Props {
  contas: Array<{ id: string; nome: string; banco: string }>;
}

interface FormState {
  id?: string;
  nome: string;
  icone: string;
  grupo: "a_vista" | "a_prazo";
  conta_bancaria_id: string | null;
  ativo: boolean;
}

const EMPTY: FormState = { nome: "", icone: "💰", grupo: "a_vista", conta_bancaria_id: null, ativo: true };

export default function FormasCustomizadasCard({ contas }: Props) {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["formas-pagamento-custom-admin", unidadeAtual?.id],
    queryFn: async () => {
      let q = (supabase as any).from("formas_pagamento_custom").select("*").order("nome");
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FormaPagamentoCustom[];
    },
  });

  const openNew = () => { setForm(EMPTY); setOpen(true); };
  const openEdit = (item: FormaPagamentoCustom) => {
    setForm({
      id: item.id,
      nome: item.nome,
      icone: item.icone || "💰",
      grupo: item.grupo,
      conta_bancaria_id: item.conta_bancaria_id,
      ativo: item.ativo,
    });
    setOpen(true);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["formas-pagamento-custom-admin"] });
    qc.invalidateQueries({ queryKey: ["formas-pagamento-custom"] });
  };

  const salvar = async () => {
    if (!form.nome.trim()) { toast.error("Informe um nome"); return; }
    setSaving(true);
    try {
      const slug = buildCustomSlug(form.nome, form.grupo);
      const payload: any = {
        nome: form.nome.trim(),
        slug,
        icone: form.icone,
        grupo: form.grupo,
        conta_bancaria_id: form.grupo === "a_vista" ? form.conta_bancaria_id : null,
        ativo: form.ativo,
        unidade_id: unidadeAtual?.id || null,
        empresa_id: (empresa as any)?.id || null,
      };
      if (form.id) {
        const { error } = await (supabase as any).from("formas_pagamento_custom").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Forma atualizada");
      } else {
        const { error } = await (supabase as any).from("formas_pagamento_custom").insert(payload);
        if (error) throw error;
        toast.success("Forma criada");
      }
      setOpen(false);
      invalidate();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (item: FormaPagamentoCustom) => {
    if (!confirm(`Excluir "${item.nome}"?`)) return;
    const { error } = await (supabase as any).from("formas_pagamento_custom").delete().eq("id", item.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Forma excluída");
    invalidate();
  };

  const toggleAtivo = async (item: FormaPagamentoCustom) => {
    const { error } = await (supabase as any)
      .from("formas_pagamento_custom")
      .update({ ativo: !item.ativo })
      .eq("id", item.id);
    if (error) { toast.error("Erro"); return; }
    invalidate();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Formas de pagamento customizadas
              </CardTitle>
              <CardDescription className="text-sm">
                Crie formas próprias (ex.: Ticket Alimentação, Voucher, Vale Combustível). Elas aparecem em toda a operação — vendas, contas a receber, recebimentos do entregador.
              </CardDescription>
            </div>
            <Button onClick={openNew} size="sm" className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> Nova
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
          ) : itens.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma forma customizada cadastrada.
            </p>
          ) : (
            <div className="space-y-2">
              {itens.map((it) => {
                const conta = contas.find(c => c.id === it.conta_bancaria_id);
                return (
                  <div key={it.id} className={`flex items-center gap-3 p-3 rounded-lg border ${!it.ativo ? "opacity-60" : ""}`}>
                    <span className="text-2xl">{it.icone}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{it.nome}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {it.grupo === "a_vista" ? "À vista" : "A prazo"}
                        </Badge>
                        {!it.ativo && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {it.grupo === "a_vista"
                          ? (conta ? `Cai em ${conta.nome}` : "Fica no caixa da loja")
                          : "Gera título em Contas a Receber"}
                      </p>
                    </div>
                    <Switch checked={it.ativo} onCheckedChange={() => toggleAtivo(it)} />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(it)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => excluir(it)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar forma" : "Nova forma de pagamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Ticket Alimentação"
                maxLength={60}
              />
            </div>
            <div>
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm({ ...form, icone: e })}
                    className={`h-9 w-9 rounded-lg border text-lg transition ${form.icone === e ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Comportamento *</Label>
              <RadioGroup
                value={form.grupo}
                onValueChange={(v) => setForm({ ...form, grupo: v as "a_vista" | "a_prazo" })}
                className="mt-2 space-y-2"
              >
                <label className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="a_vista" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">À vista</p>
                    <p className="text-xs text-muted-foreground">Baixa imediata. Pode direcionar para uma conta bancária ou ficar no caixa.</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="a_prazo" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">A prazo</p>
                    <p className="text-xs text-muted-foreground">Gera título pendente em Contas a Receber (como Fiado/Boleto).</p>
                  </div>
                </label>
              </RadioGroup>
            </div>
            {form.grupo === "a_vista" && (
              <div>
                <Label>Conta bancária destino (opcional)</Label>
                <Select
                  value={form.conta_bancaria_id || "nenhuma"}
                  onValueChange={(v) => setForm({ ...form, conta_bancaria_id: v === "nenhuma" ? null : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">— Nenhuma (fica no caixa) —</SelectItem>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Ativa</Label>
                <p className="text-xs text-muted-foreground">Se desativada, não aparece nos seletores.</p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
