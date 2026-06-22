import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogTrigger as DialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Plus, CreditCard, ChevronRight, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { getOperatorTheme, operatorGradient } from "@/lib/cartoes/operatorThemes";

interface Operadora {
  id: string;
  nome: string;
  bandeira: string | null;
  taxa_debito: number;
  taxa_credito_vista: number;
  taxa_credito_parcelado: number;
  taxa_pix: number | null;
  prazo_debito: number;
  prazo_credito: number;
  prazo_pix: number | null;
  ativo: boolean;
  unidade_id: string | null;
}

const emptyForm = {
  nome: "", bandeira: "",
  taxa_debito: "", taxa_credito_vista: "", taxa_credito_parcelado: "", taxa_pix: "",
  prazo_debito: "0", prazo_credito: "30", prazo_pix: "0",
};

export default function GestaoCartoes() {
  const { unidadeAtual } = useUnidade();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: operadoras = [], isLoading } = useQuery({
    queryKey: ["operadoras-cartao-grid", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("operadoras_cartao").select("*").eq("ativo", true).order("nome");
      if (unidadeAtual?.id) q = q.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Operadora[];
    },
  });

  // métricas a receber por operadora (pagamentos_cartao pendentes de liquidação)
  const { data: metricsByOp = {} } = useQuery({
    queryKey: ["operadoras-cartao-metrics", unidadeAtual?.id, operadoras.map(o => o.id).join(",")],
    enabled: operadoras.length > 0,
    queryFn: async () => {
      // pagamentos não têm operadora_id direto, então vamos via terminais
      const opIds = operadoras.map(o => o.id);
      const { data: terms } = await supabase
        .from("terminais_cartao")
        .select("numero_serie, operadora_id")
        .in("operadora_id", opIds);
      const serialToOp: Record<string, string> = {};
      (terms || []).forEach((t: any) => {
        if (t.numero_serie && t.operadora_id) serialToOp[t.numero_serie] = t.operadora_id;
      });

      let pq = supabase
        .from("pagamentos_cartao")
        .select("maquininha_serial, valor_liquido, liquidado")
        .eq("status", "aprovado");
      if (unidadeAtual?.id) pq = pq.eq("unidade_id", unidadeAtual.id);
      const { data: pags } = await pq;

      const acc: Record<string, { aReceber: number; recebido: number }> = {};
      opIds.forEach(id => { acc[id] = { aReceber: 0, recebido: 0 }; });
      (pags || []).forEach((p: any) => {
        const opId = serialToOp[p.maquininha_serial || ""];
        if (!opId || !acc[opId]) return;
        const v = Number(p.valor_liquido || 0);
        if (p.liquidado) acc[opId].recebido += v;
        else acc[opId].aReceber += v;
      });
      return acc;
    },
  });

  const resetForm = () => { setForm({ ...emptyForm }); setEditId(null); };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (op: Operadora) => {
    setEditId(op.id);
    setForm({
      nome: op.nome, bandeira: op.bandeira || "",
      taxa_debito: String(op.taxa_debito ?? ""),
      taxa_credito_vista: String(op.taxa_credito_vista ?? ""),
      taxa_credito_parcelado: String(op.taxa_credito_parcelado ?? ""),
      taxa_pix: String(op.taxa_pix ?? ""),
      prazo_debito: String(op.prazo_debito ?? "0"),
      prazo_credito: String(op.prazo_credito ?? "30"),
      prazo_pix: String(op.prazo_pix ?? "0"),
    });
    setDialogOpen(true);
  };

  const salvar = async () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload = {
      nome: form.nome.trim(),
      bandeira: form.bandeira || null,
      taxa_debito: parseFloat(form.taxa_debito) || 0,
      taxa_credito_vista: parseFloat(form.taxa_credito_vista) || 0,
      taxa_credito_parcelado: parseFloat(form.taxa_credito_parcelado) || 0,
      taxa_pix: parseFloat(form.taxa_pix) || 0,
      prazo_debito: parseInt(form.prazo_debito) || 0,
      prazo_credito: parseInt(form.prazo_credito) || 0,
      prazo_pix: parseInt(form.prazo_pix) || 0,
      unidade_id: unidadeAtual?.id || null,
    };
    if (editId) {
      const { error } = await supabase.from("operadoras_cartao").update(payload).eq("id", editId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Operadora atualizada!");
    } else {
      const { error } = await supabase.from("operadoras_cartao").insert(payload);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Operadora cadastrada!");
    }
    setDialogOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["operadoras-cartao-grid"] });
    queryClient.invalidateQueries({ queryKey: ["operadoras-cartao-metrics"] });
  };

  return (
    <MainLayout>
      <Header
        title="Gestão de Cartões"
        subtitle="Clique em uma operadora para abrir o portal"
      />
      <div className="p-4 md:p-6 space-y-6">
        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />Nova Operadora
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {editId ? "Editar Operadora" : "Nova Operadora"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="PagBank, Stone, Cielo..." />
                </div>
                <div>
                  <Label>Bandeira (opcional)</Label>
                  <Input value={form.bandeira} onChange={e => setForm({ ...form, bandeira: e.target.value })} placeholder="Visa, Master..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Taxa Débito (%)</Label>
                    <Input value={form.taxa_debito} onChange={e => setForm({ ...form, taxa_debito: e.target.value })} placeholder="1,99" />
                  </div>
                  <div>
                    <Label>Prazo Débito (dias)</Label>
                    <Input value={form.prazo_debito} onChange={e => setForm({ ...form, prazo_debito: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Taxa Crédito à vista (%)</Label>
                    <Input value={form.taxa_credito_vista} onChange={e => setForm({ ...form, taxa_credito_vista: e.target.value })} placeholder="3,19" />
                  </div>
                  <div>
                    <Label>Prazo Crédito (dias)</Label>
                    <Input value={form.prazo_credito} onChange={e => setForm({ ...form, prazo_credito: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Taxa Crédito parcelado (%)</Label>
                    <Input value={form.taxa_credito_parcelado} onChange={e => setForm({ ...form, taxa_credito_parcelado: e.target.value })} placeholder="4,29" />
                  </div>
                  <div>
                    <Label>Taxa PIX (%)</Label>
                    <Input value={form.taxa_pix} onChange={e => setForm({ ...form, taxa_pix: e.target.value })} placeholder="0,99" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
                  <Button onClick={salvar}>{editId ? "Atualizar" : "Salvar"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Grid de operadoras */}
        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground">Carregando...</p>
        ) : operadoras.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={CreditCard}
                title="Nenhuma operadora cadastrada"
                description="Cadastre operadoras para acessar o portal com recebíveis, conferência, relatórios e importação por operadora."
                action={{ label: "Nova operadora", onClick: openCreate, icon: Plus }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {operadoras.map(op => {
              const theme = getOperatorTheme(op.nome);
              const m = metricsByOp[op.id] || { aReceber: 0, recebido: 0 };
              return (
                <button
                  key={op.id}
                  onClick={() => navigate(`/financeiro/cartoes/${op.id}`)}
                  className="group text-left rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <div
                    className="p-4 relative"
                    style={{ background: operatorGradient(theme), color: theme.textColor }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-11 w-11 rounded-xl flex items-center justify-center font-bold shadow"
                          style={{ background: "rgba(255,255,255,0.18)", color: theme.textColor }}
                        >
                          {theme.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wider opacity-80">Operadora</p>
                          <p className="font-semibold truncate">{op.nome}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 opacity-70 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider opacity-80">A receber</p>
                        <p className="text-lg font-extrabold">
                          R$ {m.aReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider opacity-80">Recebido</p>
                        <p className="text-lg font-extrabold">
                          R$ {m.recebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-card flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap min-w-0">
                      <Badge variant="outline" className="shrink-0">Déb {Number(op.taxa_debito).toFixed(2)}%</Badge>
                      <Badge variant="outline" className="shrink-0">Créd {Number(op.taxa_credito_vista).toFixed(2)}%</Badge>
                      <Badge variant="outline" className="shrink-0">D+{op.prazo_credito}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); openEdit(op); }}
                      title="Editar operadora"
                      className="h-8 w-8 shrink-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
