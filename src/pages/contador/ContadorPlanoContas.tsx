import { useState, useEffect } from "react";
import { ContadorPortalLayout } from "@/components/contador/ContadorPortalLayout";
import { useContador } from "@/contexts/ContadorContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, BookOpen, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ContaRow {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  natureza: string;
  ativo: boolean;
}

const tiposCont = [
  { value: "ativo", label: "Ativo" },
  { value: "passivo", label: "Passivo" },
  { value: "patrimonio", label: "Patrimônio Líquido" },
  { value: "receita", label: "Receita" },
  { value: "despesa", label: "Despesa" },
  { value: "custo", label: "Custo" },
];

export default function ContadorPlanoContas() {
  const { empresaAtiva } = useContador();
  const [contas, setContas] = useState<ContaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ codigo: "", nome: "", tipo: "despesa", natureza: "debito" });

  const fetch = async () => {
    if (!empresaAtiva) return;
    setLoading(true);
    const { data, error } = await supabase.from("plano_contas" as any)
      .select("*").eq("empresa_id", empresaAtiva.empresa_id).order("codigo");
    if (error) toast.error(error.message);
    else setContas((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [empresaAtiva]);

  const save = async () => {
    if (!empresaAtiva) return;
    if (!form.codigo || !form.nome) { toast.error("Preencha código e nome"); return; }
    const { error } = await (supabase.from("plano_contas" as any) as any).insert({
      empresa_id: empresaAtiva.empresa_id, ...form,
    });
    if (error) toast.error(error.message);
    else { toast.success("Conta criada"); setOpen(false); setForm({ codigo: "", nome: "", tipo: "despesa", natureza: "debito" }); fetch(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta conta?")) return;
    const { error } = await supabase.from("plano_contas" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removida"); fetch(); }
  };

  return (
    <ContadorPortalLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(0,0%,95%)]">Plano de Contas</h1>
            <p className="text-sm text-[hsl(220,10%,60%)]">Estrutura contábil customizada por empresa</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[hsl(165,60%,40%)] hover:bg-[hsl(165,60%,45%)] text-white" disabled={!empresaAtiva}>
                <Plus className="h-4 w-4 mr-2" /> Nova conta
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)] text-[hsl(0,0%,93%)]">
              <DialogHeader><DialogTitle>Nova conta contábil</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Código</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="ex: 3.1.01.001" /></div>
                <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="ex: Despesas com Combustível" /></div>
                <div>
                  <Label>Tipo</Label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="w-full bg-[hsl(220,18%,15%)] border border-[hsl(220,15%,22%)] text-white rounded-md px-3 py-2 text-sm">
                    {tiposCont.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Natureza</Label>
                  <select value={form.natureza} onChange={(e) => setForm({ ...form, natureza: e.target.value })}
                    className="w-full bg-[hsl(220,18%,15%)] border border-[hsl(220,15%,22%)] text-white rounded-md px-3 py-2 text-sm">
                    <option value="debito">Débito</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>
                <Button onClick={save} className="w-full bg-[hsl(165,60%,40%)] hover:bg-[hsl(165,60%,45%)] text-white">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[hsl(165,60%,55%)]" /></div>
            ) : contas.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 mx-auto mb-3 text-[hsl(220,10%,30%)]" />
                <p className="text-sm text-[hsl(220,10%,55%)]">Nenhuma conta cadastrada.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[hsl(220,18%,13%)] text-[hsl(220,10%,60%)] text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-left">Nome</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Natureza</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(220,15%,18%)]">
                  {contas.map((c) => (
                    <tr key={c.id} className="hover:bg-[hsl(220,18%,13%)]">
                      <td className="px-4 py-3 font-mono text-[hsl(165,60%,55%)]">{c.codigo}</td>
                      <td className="px-4 py-3 text-[hsl(0,0%,90%)]">{c.nome}</td>
                      <td className="px-4 py-3 text-[hsl(220,10%,75%)] capitalize">{c.tipo}</td>
                      <td className="px-4 py-3 text-[hsl(220,10%,75%)] capitalize">{c.natureza}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </ContadorPortalLayout>
  );
}
