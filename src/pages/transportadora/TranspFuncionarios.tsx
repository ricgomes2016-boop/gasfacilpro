import { useState } from "react";
import { TransportadoraLayout } from "@/components/transportadora/TransportadoraLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, calcSalarioDiario } from "@/lib/transp-utils";
import { toast } from "sonner";
import { Plus, Users, Pencil, Trash2, Download } from "lucide-react";

export default function TranspFuncionarios() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", cargo: "motorista", salario_mensal: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["transp-funcionarios"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("transp_funcionarios").select("*").eq("ativo", true).order("nome");
      if (error) throw error;
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

  // Fetch existing funcionarios from the main system to import
  const { data: sistemaFuncionarios = [], isLoading: loadingSistema } = useQuery({
    queryKey: ["sistema-funcionarios-import", profile?.empresa_id],
    queryFn: async () => {
      // Get all funcionarios from the main system for the same empresa
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cargo, salario")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;

      // Get already imported names to filter them out
      const existingNames = funcionarios.map((f: any) => f.nome.toLowerCase());
      return (data || []).filter((f: any) => !existingNames.includes(f.nome.toLowerCase()));
    },
    enabled: importOpen && !!profile?.empresa_id,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, empresa_id: profile?.empresa_id };
      if (editId) {
        const { error } = await (supabase as any).from("transp_funcionarios").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("transp_funcionarios").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-funcionarios"] });
      toast.success(editId ? "Funcionário atualizado" : "Funcionário cadastrado");
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const importar = useMutation({
    mutationFn: async () => {
      const toImport = sistemaFuncionarios.filter((f: any) => selectedIds.includes(f.id));
      const payloads = toImport.map((f: any) => ({
        nome: f.nome,
        cargo: f.cargo === "Entregador" ? "motorista" : "ajudante",
        salario_mensal: f.salario || 0,
        empresa_id: profile?.empresa_id,
      }));
      const { error } = await (supabase as any).from("transp_funcionarios").insert(payloads);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-funcionarios"] });
      qc.invalidateQueries({ queryKey: ["sistema-funcionarios-import"] });
      toast.success(`${selectedIds.length} funcionário(s) importado(s)!`);
      setImportOpen(false);
      setSelectedIds([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("transp_funcionarios").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transp-funcionarios"] });
      toast.success("Funcionário removido");
    },
  });

  const resetForm = () => { setForm({ nome: "", cargo: "motorista", salario_mensal: 0 }); setEditId(null); };

  const startEdit = (f: any) => {
    setForm({ nome: f.nome, cargo: f.cargo, salario_mensal: f.salario_mensal });
    setEditId(f.id);
    setOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === sistemaFuncionarios.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sistemaFuncionarios.map((f: any) => f.id));
    }
  };

  return (
    <TransportadoraLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Funcionários</h1>
            <p className="text-muted-foreground text-sm">Motoristas e ajudantes</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setSelectedIds([]); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Importar do Sistema</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Importar Funcionários do Sistema</DialogTitle></DialogHeader>
                <p className="text-sm text-muted-foreground">Selecione os funcionários da empresa para associá-los à transportadora.</p>
                
                {loadingSistema ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Carregando...</div>
                ) : sistemaFuncionarios.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Todos os funcionários já foram importados.</div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Checkbox
                        checked={selectedIds.length === sistemaFuncionarios.length && sistemaFuncionarios.length > 0}
                        onCheckedChange={toggleAll}
                      />
                      <span className="text-sm font-medium">Selecionar todos ({sistemaFuncionarios.length})</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {sistemaFuncionarios.map((f: any) => (
                        <label key={f.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={selectedIds.includes(f.id)}
                            onCheckedChange={() => toggleSelect(f.id)}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{f.nome}</p>
                            <p className="text-xs text-muted-foreground">{f.cargo} {f.salario ? `· ${formatCurrency(f.salario)}/mês` : ""}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <Button 
                      onClick={() => importar.mutate()} 
                      disabled={selectedIds.length === 0 || importar.isPending}
                      className="w-full"
                    >
                      Importar {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                    </Button>
                  </>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" />Novo Funcionário</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Funcionário</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
                  <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} required /></div>
                  <div><Label>Cargo</Label>
                    <Select value={form.cargo} onValueChange={(v) => setForm({...form, cargo: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="motorista">Motorista</SelectItem>
                        <SelectItem value="ajudante">Ajudante</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Salário Mensal</Label>
                    <Input type="number" step="0.01" value={form.salario_mensal} onChange={(e) => setForm({...form, salario_mensal: +e.target.value})} />
                    <p className="text-xs text-muted-foreground mt-1">Salário diário: <strong>{formatCurrency(calcSalarioDiario(form.salario_mensal))}</strong></p>
                  </div>
                  <Button type="submit" className="w-full" disabled={save.isPending}>{editId ? "Salvar" : "Cadastrar"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-3">
          {funcionarios.map((f: any) => (
            <Card key={f.id} className="border-border/40">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{f.nome}</p>
                    <p className="text-xs text-muted-foreground capitalize">{f.cargo} · {formatCurrency(f.salario_mensal)}/mês · {formatCurrency(calcSalarioDiario(f.salario_mensal))}/dia</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(f)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!isLoading && funcionarios.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum funcionário cadastrado</div>
          )}
        </div>
      </div>
    </TransportadoraLayout>
  );
}
