import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building, MapPin, Phone, Mail, Edit, Loader2, Store, Smartphone, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Unidade } from "@/contexts/UnidadeContext";

export default function UnidadesConfig() {
  const { toast } = useToast();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUnidade, setEditingUnidade] = useState<Unidade | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUnidades();
  }, []);

  const fetchUnidades = async () => {
    try {
      const { data, error } = await supabase
        .from("unidades")
        .select("*")
        .eq("ativo", true)
        .order("tipo")
        .order("nome");

      if (error) throw error;

      setUnidades(
        (data || []).map((u) => ({
          ...u,
          tipo: u.tipo as "matriz" | "filial",
          ativo: u.ativo ?? true,
        }))
      );
    } catch (error: any) {
      toast({ title: "Erro ao carregar unidades", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingUnidade) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("unidades")
        .update({
          nome: editingUnidade.nome,
          cnpj: editingUnidade.cnpj,
          telefone: editingUnidade.telefone,
          email: editingUnidade.email,
          endereco: editingUnidade.endereco,
          bairro: editingUnidade.bairro,
          cidade: editingUnidade.cidade,
          estado: editingUnidade.estado,
          cep: editingUnidade.cep,
          chave_pix: (editingUnidade as any).chave_pix || null,
          bairros_atendidos: (editingUnidade as any).bairros_atendidos || null,
          horario_abertura: (editingUnidade as any).horario_abertura || '07:00',
          horario_fechamento: (editingUnidade as any).horario_fechamento || '18:00',
        })
        .eq("id", editingUnidade.id);

      if (error) throw error;

      toast({ title: "Salvo!", description: `Dados de ${editingUnidade.nome} atualizados.` });
      setEditingUnidade(null);
      fetchUnidades();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof Unidade, value: string) => {
    if (!editingUnidade) return;
    setEditingUnidade({ ...editingUnidade, [field]: value });
  };

  return (
    <MainLayout>
      <Header title="Gestão de Unidades" subtitle="Visualize e edite os dados de cada loja" />
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {unidades.map((unidade) => (
              <Card key={unidade.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {unidade.tipo === "matriz" ? (
                        <Building className="h-5 w-5 text-primary" />
                      ) : (
                        <Store className="h-5 w-5 text-muted-foreground" />
                      )}
                      <CardTitle className="text-lg">{unidade.nome}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={unidade.tipo === "matriz" ? "default" : "secondary"}>
                        {unidade.tipo === "matriz" ? "Matriz" : "Filial"}
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => setEditingUnidade({ ...unidade })}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {unidade.cnpj && (
                    <p className="text-muted-foreground">CNPJ: {unidade.cnpj}</p>
                  )}
                  {unidade.telefone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {unidade.telefone}
                    </div>
                  )}
                  {unidade.email && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {unidade.email}
                    </div>
                  )}
                  {(unidade.endereco || unidade.bairro || unidade.cidade) && (
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        {[unidade.endereco, unidade.bairro, unidade.cidade && unidade.estado ? `${unidade.cidade}/${unidade.estado}` : unidade.cidade, unidade.cep]
                          .filter(Boolean)
                          .join(" - ")}
                      </span>
                    </div>
                  )}
                  {(unidade as any).chave_pix && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Smartphone className="h-3.5 w-3.5" />
                      PIX: {(unidade as any).chave_pix}
                    </div>
                  )}
                  {!unidade.cnpj && !unidade.telefone && !unidade.endereco && (
                    <p className="text-muted-foreground italic">Dados não preenchidos</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingUnidade} onOpenChange={(open) => !open && setEditingUnidade(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Editar {editingUnidade?.nome}
              </DialogTitle>
            </DialogHeader>
            {editingUnidade && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Nome da Unidade</Label>
                  <Input value={editingUnidade.nome} onChange={(e) => updateField("nome", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>CNPJ</Label>
                  <Input value={editingUnidade.cnpj || ""} onChange={(e) => updateField("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Telefone</Label>
                    <Input value={editingUnidade.telefone || ""} onChange={(e) => updateField("telefone", e.target.value)} placeholder="(00) 0000-0000" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input value={editingUnidade.email || ""} onChange={(e) => updateField("email", e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Endereço</Label>
                  <Input value={editingUnidade.endereco || ""} onChange={(e) => updateField("endereco", e.target.value)} placeholder="Rua, Número" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Bairro</Label>
                    <Input value={editingUnidade.bairro || ""} onChange={(e) => updateField("bairro", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>CEP</Label>
                    <Input value={editingUnidade.cep || ""} onChange={(e) => updateField("cep", e.target.value)} placeholder="00000-000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Cidade</Label>
                    <Input value={editingUnidade.cidade || ""} onChange={(e) => updateField("cidade", e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Estado</Label>
                    <Input value={editingUnidade.estado || ""} onChange={(e) => updateField("estado", e.target.value)} placeholder="UF" maxLength={2} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4" />
                    Chave PIX
                  </Label>
                  <Input
                    value={(editingUnidade as any).chave_pix || ""}
                    onChange={(e) => updateField("chave_pix" as any, e.target.value)}
                    placeholder="CPF, CNPJ, email, telefone ou chave aleatória"
                  />
                  <p className="text-xs text-muted-foreground">Será usada para gerar QR Code de pagamento PIX</p>
                </div>
                <div className="grid gap-2">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Horário de Atendimento (Bia IA)
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1">
                      <span className="text-xs text-muted-foreground">Abertura</span>
                      <Input
                        type="time"
                        value={(editingUnidade as any).horario_abertura || "07:00"}
                        onChange={(e) => updateField("horario_abertura" as any, e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1">
                      <span className="text-xs text-muted-foreground">Fechamento</span>
                      <Input
                        type="time"
                        value={(editingUnidade as any).horario_fechamento || "18:00"}
                        onChange={(e) => updateField("horario_fechamento" as any, e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Fora desse horário, a Bia avisará o cliente que está fora do expediente</p>
                </div>
                <div className="grid gap-2">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    Bairros Atendidos (Bia IA)
                  </Label>
                  <Input
                    value={(editingUnidade as any).bairros_atendidos || ""}
                    onChange={(e) => updateField("bairros_atendidos" as any, e.target.value)}
                    placeholder="Centro, Jardim América, Vila Nova (separados por vírgula)"
                  />
                  <p className="text-xs text-muted-foreground">A Bia usará esses bairros para direcionar pedidos automaticamente para esta unidade</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditingUnidade(null)}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
