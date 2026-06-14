import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, Plus, Search, Edit, Trash2, Phone, Briefcase, Truck,
  LinkIcon, CreditCard, Mail, Lock, Loader2, UserCheck, Building2, Image,
  Target, TrendingUp, Percent, DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { FuncionarioUnidadesDialog } from "@/components/cadastros/FuncionarioUnidadesDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VendedorDesempenhoCard } from "@/components/cadastros/VendedorDesempenhoCard";


interface Funcionario {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  cargo: string | null;
  setor: string | null;
  data_admissao: string | null;
  salario: number | null;
  status: string | null;
  ativo: boolean | null;
  unidade_id: string | null;
  is_vendedor?: boolean | null;
}

interface Entregador {
  id: string;
  nome: string;
  funcionario_id: string | null;
  user_id: string | null;
  terminal_id: string | null;
  cnh: string | null;
  status: string | null;
  foto_url: string | null;
}

interface VendedorMeta {
  id: string;
  user_id: string | null;
  funcionario_id: string | null;
  meta_mensal: number;
  percentual: number;
  valor_fixo_comissao: number;
  tipo_comissao: string;
  tipo_venda_permitido: string;
  ativo: boolean;
}

interface TerminalOption {
  id: string;
  nome: string;
  numero_serie: string | null;
}

const emptyForm = {
  nome: "", cpf: "", telefone: "", email: "",
  cargo: "", setor: "", data_admissao: "", salario: "", endereco: "",
  is_entregador: false,
  cnh: "",
  login_email: "",
  login_password: "",
  terminal_id: "",
  foto_url: "",
  unidade_id: "",
  // Vínculo e regime
  tipo_vinculo: "clt",
  regime_pagamento: "mensal",
  valor_diaria: "",
  entra_na_escala: false,
  is_transporte: false,
  // Vendedor
  is_vendedor: false,
  vend_login_email: "",
  vend_login_password: "",
  vend_meta_mensal: "",
  vend_tipo_comissao: "percentual" as "percentual" | "valor_fixo",
  vend_percentual: "",
  vend_valor_fixo: "",
  vend_tipo_venda: "ambos" as "balcao" | "entrega" | "ambos",
};

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "entregadores" | "vendedores" | "internos">("todos");
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [terminais, setTerminais] = useState<TerminalOption[]>([]);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const { unidadeAtual, unidades } = useUnidade();
  const [unidadesDialog, setUnidadesDialog] = useState<{ userId: string; nome: string } | null>(null);

  const fetchFuncionarios = async () => {
    let query = supabase
      .from("funcionarios")
      .select("*")
      .eq("ativo", true)
      .order("nome");

    if (unidadeAtual?.id) {
      query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    }

    const { data, error } = await query;
    if (error) { console.error(error); return; }
    setFuncionarios(data || []);
    setLoading(false);
  };

  const fetchEntregadores = async () => {
    let query = supabase
      .from("entregadores")
      .select("id, nome, funcionario_id, user_id, terminal_id, cnh, status, foto_url")
      .eq("ativo", true);

    if (unidadeAtual?.id) {
      query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    }

    const { data } = await query;
    setEntregadores(data || []);
  };

  const fetchTerminais = async () => {
    const { data } = await (supabase.from("terminais_cartao" as any).select("id, nome, numero_serie") as any);
    setTerminais((data || []) as TerminalOption[]);
  };

  useEffect(() => {
    fetchFuncionarios();
    fetchEntregadores();
    fetchTerminais();
  }, [unidadeAtual?.id]);

  const uploadFotoEntregador = async (file: File, funcionarioId: string) => {
    if (!file.type.startsWith("image/")) throw new Error("Envie apenas arquivos de imagem.");
    if (file.size > 2 * 1024 * 1024) throw new Error("A foto deve ter no máximo 2MB.");

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `entregadores/${funcionarioId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) throw error;

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  };

  const getEntregadorForFuncionario = (funcId: string) =>
    entregadores.find(e => e.funcionario_id === funcId);

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }

    // Validate entregador login fields for new entregadores without existing user
    const existingEntregador = editId ? getEntregadorForFuncionario(editId) : null;
    const needsNewUser = form.is_entregador && !existingEntregador?.user_id;

    if (needsNewUser) {
      if (!form.login_email) {
        toast.error("Email de acesso é obrigatório para entregadores");
        return;
      }
      if (!form.login_password || form.login_password.length < 6) {
        toast.error("Senha deve ter no mínimo 6 caracteres");
        return;
      }
    }

    setSaving(true);

    try {
      const regimeUsaSalario = form.regime_pagamento === "mensal" || form.regime_pagamento === "misto";
      const regimeUsaDiaria = form.regime_pagamento === "diaria" || form.regime_pagamento === "misto";

      const payload: any = {
        nome: form.nome,
        cpf: form.cpf || null,
        telefone: form.telefone || null,
        email: form.email || null,
        cargo: form.is_entregador ? "Entregador" : (form.cargo || null),
        setor: form.setor || null,
        data_admissao: form.data_admissao || null,
        salario: regimeUsaSalario && form.salario ? parseFloat(form.salario) : 0,
        endereco: form.endereco || null,
        tipo_vinculo: form.tipo_vinculo || "clt",
        regime_pagamento: form.regime_pagamento || "mensal",
        valor_diaria: regimeUsaDiaria && form.valor_diaria ? parseFloat(form.valor_diaria) : 0,
        entra_na_escala: !!form.entra_na_escala,
        is_transporte: !!form.is_transporte,
        is_vendedor: !!form.is_vendedor,
      };
      // unidade_id: usa o selecionado no form, ou o atual da empresa, ou null
      if (form.unidade_id) {
        payload.unidade_id = form.unidade_id;
      } else if (!editId && unidadeAtual?.id) {
        payload.unidade_id = unidadeAtual.id;
      }

      let funcionarioId = editId;

      if (editId) {
        const { error } = await supabase.from("funcionarios").update(payload).eq("id", editId);
        if (error) { toast.error("Erro ao atualizar: " + error.message); setSaving(false); return; }
      } else {
        const { data, error } = await supabase.from("funcionarios").insert(payload).select("id").single();
        if (error) { toast.error("Erro ao salvar: " + error.message); setSaving(false); return; }
        funcionarioId = data.id;
      }

      // Sync entregador record
      if (form.is_entregador && funcionarioId) {
        let userId = existingEntregador?.user_id || null;
        let fotoUrl = form.foto_url || existingEntregador?.foto_url || null;

        // Create auth user if needed
        if (needsNewUser) {
          const { data: createData, error: createError } = await supabase.functions.invoke("manage-users", {
            body: {
              action: "create",
              email: form.login_email,
              password: form.login_password,
              full_name: form.nome,
              phone: form.telefone || undefined,
              role: "entregador",
              unidade_ids: unidadeAtual?.id ? [unidadeAtual.id] : [],
            },
          });

          if (createError) {
            toast.error("Erro ao criar acesso: " + createError.message);
            setSaving(false);
            return;
          }
          if (createData?.error) {
            toast.error("Erro ao criar acesso: " + createData.error);
            setSaving(false);
            return;
          }

          userId = createData.user_id;
        }

        if (fotoFile) {
          fotoUrl = await uploadFotoEntregador(fotoFile, funcionarioId);
        }

        const existing = entregadores.find(e => e.funcionario_id === funcionarioId);
        const entregadorPayload: any = {
          nome: form.nome,
          cpf: form.cpf || null,
          cnh: form.cnh || null,
          telefone: form.telefone || null,
          email: form.login_email || form.email || null,
          user_id: userId,
          terminal_id: form.terminal_id || null,
          foto_url: fotoUrl,
          funcionario_id: funcionarioId,
          ativo: true,
        };
        if (unidadeAtual?.id) {
          entregadorPayload.unidade_id = unidadeAtual.id;
        }

        if (existing) {
          await supabase.from("entregadores").update(entregadorPayload).eq("id", existing.id);
        } else {
          await supabase.from("entregadores").insert(entregadorPayload);
        }
      } else if (!form.is_entregador && funcionarioId) {
        const existing = entregadores.find(e => e.funcionario_id === funcionarioId);
        if (existing) {
          await supabase.from("entregadores").update({ ativo: false }).eq("id", existing.id);
        }
      }

      // ===== Sincroniza vendedor =====
      let vendedorUserCriado = false;
      if (form.is_vendedor && funcionarioId) {
        // Busca meta existente
        const { data: metaExistente } = await (supabase as any)
          .from("vendedor_metas")
          .select("id, user_id")
          .eq("funcionario_id", funcionarioId)
          .maybeSingle();

        let vendedorUserId: string | null = metaExistente?.user_id || null;

        // Criar login se solicitado e ainda não houver
        if (!vendedorUserId && form.vend_login_email && form.vend_login_password) {
          if (form.vend_login_password.length < 6) {
            toast.error("Senha do vendedor deve ter no mínimo 6 caracteres");
            setSaving(false);
            return;
          }
          const { data: createData, error: createError } = await supabase.functions.invoke("manage-users", {
            body: {
              action: "create",
              email: form.vend_login_email,
              password: form.vend_login_password,
              full_name: form.nome,
              phone: form.telefone || undefined,
              role: "vendedor",
              unidade_ids: unidadeAtual?.id ? [unidadeAtual.id] : [],
            },
          });
          if (createError || createData?.error) {
            toast.error("Erro ao criar acesso do vendedor: " + (createError?.message || createData?.error));
            setSaving(false);
            return;
          }
          vendedorUserId = createData.user_id;
          vendedorUserCriado = true;
        }

        const metaPayload: any = {
          funcionario_id: funcionarioId,
          user_id: vendedorUserId,
          meta_mensal: form.vend_meta_mensal ? parseFloat(form.vend_meta_mensal) : 0,
          percentual: form.vend_tipo_comissao === "percentual" && form.vend_percentual ? parseFloat(form.vend_percentual) : 0,
          valor_fixo_comissao: form.vend_tipo_comissao === "valor_fixo" && form.vend_valor_fixo ? parseFloat(form.vend_valor_fixo) : 0,
          tipo_comissao: form.vend_tipo_comissao,
          tipo_venda_permitido: form.vend_tipo_venda,
          ativo: true,
          unidade_id: unidadeAtual?.id || null,
        };

        if (metaExistente?.id) {
          await (supabase as any).from("vendedor_metas").update(metaPayload).eq("id", metaExistente.id);
        } else if (vendedorUserId) {
          await (supabase as any).from("vendedor_metas").insert(metaPayload);
        }
      } else if (!form.is_vendedor && funcionarioId) {
        await (supabase as any)
          .from("vendedor_metas")
          .update({ ativo: false })
          .eq("funcionario_id", funcionarioId);
      }

      toast.success(editId ? "Funcionário atualizado!" : "Funcionário cadastrado!");
      if (needsNewUser) {
        toast.success("Acesso ao app do entregador criado automaticamente!");
      }
      if (vendedorUserCriado) {
        toast.success("Acesso ao app de vendas criado automaticamente!");
      }
      setOpen(false);
      setForm(emptyForm);
      setFotoFile(null);
      setEditId(null);
      fetchFuncionarios();
      fetchEntregadores();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (f: Funcionario) => {
    const entregador = getEntregadorForFuncionario(f.id);
    const fAny = f as any;

    // Buscar metas do vendedor (se houver)
    let meta: VendedorMeta | null = null;
    if (fAny.is_vendedor) {
      const { data } = await (supabase as any)
        .from("vendedor_metas")
        .select("*")
        .eq("funcionario_id", f.id)
        .maybeSingle();
      meta = data as VendedorMeta | null;
    }

    setForm({
      nome: f.nome,
      cpf: f.cpf || "",
      telefone: f.telefone || "",
      email: f.email || "",
      cargo: f.cargo || "",
      setor: f.setor || "",
      data_admissao: f.data_admissao || "",
      salario: f.salario?.toString() || "",
      endereco: "",
      is_entregador: !!entregador,
      cnh: entregador?.cnh || "",
      login_email: "",
      login_password: "",
      terminal_id: entregador?.terminal_id || "",
      foto_url: entregador?.foto_url || "",
      unidade_id: f.unidade_id || "",
      tipo_vinculo: fAny.tipo_vinculo || "clt",
      regime_pagamento: fAny.regime_pagamento || "mensal",
      valor_diaria: fAny.valor_diaria?.toString() || "",
      entra_na_escala: !!fAny.entra_na_escala,
      is_transporte: !!fAny.is_transporte,
      is_vendedor: !!fAny.is_vendedor,
      vend_login_email: "",
      vend_login_password: "",
      vend_meta_mensal: meta?.meta_mensal?.toString() || "",
      vend_tipo_comissao: (meta?.tipo_comissao as any) || "percentual",
      vend_percentual: meta?.percentual?.toString() || "",
      vend_valor_fixo: meta?.valor_fixo_comissao?.toString() || "",
      vend_tipo_venda: (meta?.tipo_venda_permitido as any) || "ambos",
    });
    setFotoFile(null);
    setEditId(f.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("funcionarios").update({ ativo: false }).eq("id", id);
    const linked = entregadores.find(e => e.funcionario_id === id);
    if (linked) {
      await supabase.from("entregadores").update({ ativo: false }).eq("id", linked.id);
    }
    toast.success("Funcionário removido");
    fetchFuncionarios();
    fetchEntregadores();
  };

  const handleOpenUnidades = async (f: Funcionario) => {
    const entregador = getEntregadorForFuncionario(f.id);
    let userId = entregador?.user_id || null;

    if (!userId && f.email) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", f.email)
        .maybeSingle();
      userId = (data as any)?.user_id || null;
    }

    if (!userId) {
      toast.error("Funcionário sem login no sistema. Não é possível associar a filiais.");
      return;
    }

    setUnidadesDialog({ userId, nome: f.nome });
  };

  const entregadorFuncIds = new Set(entregadores.map(e => e.funcionario_id).filter(Boolean));

  const filtered = funcionarios.filter(f => {
    const matchSearch = f.nome.toLowerCase().includes(search.toLowerCase()) || (f.cpf || "").includes(search);
    if (!matchSearch) return false;
    if (filter === "entregadores") return entregadorFuncIds.has(f.id);
    if (filter === "vendedores") return !!(f as any).is_vendedor;
    if (filter === "internos") return !entregadorFuncIds.has(f.id) && !(f as any).is_vendedor;
    return true;
  });

  const totalSalarios = funcionarios.reduce((s, f) => s + (f.salario || 0), 0);
  const totalEntregadores = entregadores.length;

  return (
    <MainLayout>
      <Header title="Funcionários" subtitle="Gerencie a equipe da empresa" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); setFotoFile(null); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Novo Funcionário</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Funcionário" : "Cadastrar Novo Funcionário"}</DialogTitle>
                <DialogDescription>Preencha os dados do funcionário</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2 col-span-2">
                  <Label>Nome Completo *</Label>
                  <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome do funcionário" />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail Pessoal</Label>
                  <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input
                    value={form.is_entregador ? "Entregador" : form.cargo}
                    onChange={e => setForm({...form, cargo: e.target.value})}
                    placeholder="Atendente, Auxiliar..."
                    disabled={form.is_entregador}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Input value={form.setor} onChange={e => setForm({...form, setor: e.target.value})} placeholder="Operacional, Vendas..." />
                </div>
                <div className="space-y-2">
                  <Label>Data de Admissão</Label>
                  <Input value={form.data_admissao} onChange={e => setForm({...form, data_admissao: e.target.value})} type="date" />
                </div>
                {(form.regime_pagamento === "mensal" || form.regime_pagamento === "misto") && (
                  <div className="space-y-2">
                    <Label>Salário {form.regime_pagamento === "misto" ? "(parte fixa)" : ""}</Label>
                    <Input value={form.salario} onChange={e => setForm({...form, salario: e.target.value})} placeholder="2500.00" />
                  </div>
                )}
                <div className={`space-y-2 ${(form.regime_pagamento === "mensal" || form.regime_pagamento === "misto") ? "" : "col-span-2"}`}>
                  <Label>Endereço</Label>
                  <Input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} placeholder="Rua, número, bairro" />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    Filial / Unidade
                  </Label>
                  <Select
                    value={form.unidade_id || "none"}
                    onValueChange={(v) => setForm({ ...form, unidade_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a filial" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem filial (todas)</SelectItem>
                      {unidades.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Você pode mover este funcionário para outra filial a qualquer momento.
                  </p>
                </div>

                {/* Vínculo e pagamento */}
                <div className="col-span-2 border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <Label className="text-base font-medium">Vínculo e pagamento</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo de vínculo</Label>
                      <Select
                        value={form.tipo_vinculo}
                        onValueChange={(v) => setForm({ ...form, tipo_vinculo: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clt">CLT</SelectItem>
                          <SelectItem value="terceirizado">Terceirizado</SelectItem>
                          <SelectItem value="freelancer">Freelancer</SelectItem>
                          <SelectItem value="pj">PJ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Regime de pagamento</Label>
                      <Select
                        value={form.regime_pagamento}
                        onValueChange={(v) => setForm({ ...form, regime_pagamento: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal (salário)</SelectItem>
                          <SelectItem value="diaria">Diária</SelectItem>
                          <SelectItem value="por_produto">Por produto</SelectItem>
                          <SelectItem value="misto">Misto (diária + produto)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(form.regime_pagamento === "diaria" || form.regime_pagamento === "misto") && (
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Valor da diária (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.valor_diaria}
                          onChange={(e) => setForm({ ...form, valor_diaria: e.target.value })}
                          placeholder="120.00"
                        />
                      </div>
                    )}
                    {(form.regime_pagamento === "por_produto" || form.regime_pagamento === "misto") && (
                      <p className="col-span-2 text-xs text-muted-foreground">
                        Valores por produto são definidos em <strong>RH → Comissão</strong>, no editor de comissões (selecione este funcionário para uma regra individual).
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <Label className="text-sm">Entra na escala de trabalho</Label>
                      <p className="text-xs text-muted-foreground">
                        Permite escalar este funcionário em RH/Horários mesmo sem ser entregador formal.
                      </p>
                    </div>
                    <Switch
                      checked={form.entra_na_escala}
                      onCheckedChange={(v) => setForm({ ...form, entra_na_escala: v })}
                    />
                  </div>
                </div>

                {/* Setor Transporte toggle */}
                <div className="col-span-2 border rounded-lg p-4 bg-muted/20 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <Label className="text-base font-medium">Trabalha no setor de transporte</Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Marque se este funcionário atua no transporte (motorista, ajudante, conferente, etc.). Independente de ser entregador formal.
                    </p>
                  </div>
                  <Switch
                    checked={form.is_transporte}
                    onCheckedChange={(v) => setForm({ ...form, is_transporte: v })}
                  />
                </div>

                {/* Vendedor toggle */}
                <div className="col-span-2 border rounded-lg p-4 space-y-4 bg-emerald-500/5 border-emerald-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-emerald-600" />
                      <Label className="text-base font-medium">É Vendedor?</Label>
                    </div>
                    <Switch
                      checked={form.is_vendedor}
                      onCheckedChange={(v) => setForm({ ...form, is_vendedor: v })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Marque para habilitar o acesso ao app de vendas (vendas.gasfacilpro.com.br) e configurar meta/comissão.
                  </p>

                  {form.is_vendedor && (
                    <div className="space-y-4 pt-2 border-t border-emerald-500/20">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Tipo de venda permitido</Label>
                          <Select
                            value={form.vend_tipo_venda}
                            onValueChange={(v) => setForm({ ...form, vend_tipo_venda: v as any })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ambos">Balcão e Entrega</SelectItem>
                              <SelectItem value="balcao">Apenas Balcão</SelectItem>
                              <SelectItem value="entrega">Apenas Entrega</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1">
                            <Target className="h-3 w-3" /> Meta mensal (R$)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.vend_meta_mensal}
                            onChange={(e) => setForm({ ...form, vend_meta_mensal: e.target.value })}
                            placeholder="15000.00"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Tipo de comissão</Label>
                        <Select
                          value={form.vend_tipo_comissao}
                          onValueChange={(v) => setForm({ ...form, vend_tipo_comissao: v as any })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentual">% sobre o valor da venda</SelectItem>
                            <SelectItem value="valor_fixo">Valor fixo por venda</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {form.vend_tipo_comissao === "percentual" ? (
                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1">
                            <Percent className="h-3 w-3" /> % de comissão
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.vend_percentual}
                            onChange={(e) => setForm({ ...form, vend_percentual: e.target.value })}
                            placeholder="3.00"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1">
                            <DollarSign className="h-3 w-3" /> Valor fixo por venda (R$)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.vend_valor_fixo}
                            onChange={(e) => setForm({ ...form, vend_valor_fixo: e.target.value })}
                            placeholder="5.00"
                          />
                        </div>
                      )}

                      {/* Credenciais de acesso ao app de vendas */}
                      <div className="space-y-3 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Mail className="h-4 w-4 text-emerald-600" />
                          Acesso ao app de vendas
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Preencha apenas se for criar um login novo. Se o vendedor já tem acesso, deixe em branco.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">E-mail de login</Label>
                            <Input
                              type="email"
                              value={form.vend_login_email}
                              onChange={(e) => setForm({ ...form, vend_login_email: e.target.value })}
                              placeholder="vendedor@empresa.com"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Senha temporária
                            </Label>
                            <div className="flex gap-1">
                              <Input
                                value={form.vend_login_password}
                                onChange={(e) => setForm({ ...form, vend_login_password: e.target.value })}
                                placeholder="Mínimo 6 caracteres"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const senha = Math.random().toString(36).slice(-8);
                                  setForm({ ...form, vend_login_password: senha });
                                }}
                              >
                                Gerar
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Desempenho do mês — apenas em edição */}
                      {editId && (
                        <VendedorDesempenhoCard funcionarioId={editId} />
                      )}
                    </div>
                  )}
                </div>

                {/* Entregador toggle */}
                <div className="col-span-2 border rounded-lg p-4 space-y-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <Label className="text-base font-medium">É Entregador?</Label>
                    </div>
                    <Switch
                      checked={form.is_entregador}
                      onCheckedChange={(v) => setForm({...form, is_entregador: v})}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Marque para habilitar campos de entregador. O acesso ao app será criado automaticamente.
                  </p>

                  {form.is_entregador && (
                    <div className="space-y-4 pt-2 border-t">
                      <div className="space-y-2">
                        <Label>CNH</Label>
                        <Input value={form.cnh} onChange={e => setForm({...form, cnh: e.target.value})} placeholder="Número da CNH" />
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <Image className="h-3.5 w-3.5" />
                          Foto do entregador
                        </Label>
                        <div className="flex items-center gap-3">
                          {form.foto_url && !fotoFile && (
                            <img src={form.foto_url} alt={form.nome} className="h-14 w-14 rounded-full object-cover" />
                          )}
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Use JPG, PNG ou WebP até 2MB.</p>
                      </div>

                      {/* Login credentials - only show if no user linked yet */}
                      {(() => {
                        const existingEntregador = editId ? getEntregadorForFuncionario(editId) : null;
                        const hasUser = !!existingEntregador?.user_id;

                        if (hasUser) {
                          return (
                            <div className="flex items-center gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
                              <UserCheck className="h-4 w-4 text-primary" />
                              <span className="text-sm text-primary">Acesso ao app já configurado</span>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3 p-3 rounded-md bg-accent/30 border border-accent/50">
                            <p className="text-sm font-medium flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Credenciais de Acesso ao App
                            </p>
                            <p className="text-xs text-muted-foreground">
                              O entregador usará essas credenciais para acessar o app de entregas.
                            </p>
                            <div className="space-y-2">
                              <Label>Email de Login *</Label>
                              <Input
                                value={form.login_email}
                                onChange={e => setForm({...form, login_email: e.target.value})}
                                type="email"
                                placeholder="entregador@empresa.com"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="flex items-center gap-1">
                                <Lock className="h-3.5 w-3.5" />
                                Senha *
                              </Label>
                              <Input
                                value={form.login_password}
                                onChange={e => setForm({...form, login_password: e.target.value})}
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                              />
                            </div>
                          </div>
                        );
                      })()}

                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <CreditCard className="h-3.5 w-3.5" />
                          Maquininha Fixa
                        </Label>
                        <Select value={form.terminal_id} onValueChange={(v) => setForm({...form, terminal_id: v === "none" ? "" : v})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma maquininha (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {terminais.map(t => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.nome}{t.numero_serie ? ` (${t.numero_serie})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editId ? "Atualizar" : "Salvar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-xl md:text-2xl font-bold">{funcionarios.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Entregadores</CardTitle>
              <Truck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><div className="text-xl md:text-2xl font-bold">{totalEntregadores}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Internos</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-xl md:text-2xl font-bold">{funcionarios.length - totalEntregadores}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Folha Mensal</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-xl md:text-2xl font-bold">R$ {totalSalarios.toLocaleString("pt-BR")}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-base">Equipe</CardTitle>
                <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="todos" className="text-xs px-3 h-7">Todos</TabsTrigger>
                    <TabsTrigger value="entregadores" className="text-xs px-3 h-7">Entregadores</TabsTrigger>
                    <TabsTrigger value="vendedores" className="text-xs px-3 h-7">Vendedores</TabsTrigger>
                    <TabsTrigger value="internos" className="text-xs px-3 h-7">Internos</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-10 w-full sm:w-[250px] h-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? <p className="text-muted-foreground">Carregando...</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="hidden md:table-cell">Telefone</TableHead>
                    <TableHead className="hidden lg:table-cell">Admissão</TableHead>
                    <TableHead className="hidden lg:table-cell">Salário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden lg:table-cell">Acesso App</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(f => {
                    const entregador = getEntregadorForFuncionario(f.id);
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.nome}</TableCell>
                        <TableCell>{f.cargo || "-"}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {f.telefone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{f.telefone}</span> : "-"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {f.data_admissao ? new Date(f.data_admissao).toLocaleDateString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          R$ {(f.salario || 0).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {entregador ? (
                              <Badge variant="default" className="gap-1 text-xs">
                                <Truck className="h-3 w-3" />
                                Entregador
                              </Badge>
                            ) : !((f as any).is_vendedor) ? (
                              <Badge variant="secondary" className="text-xs">Interno</Badge>
                            ) : null}
                            {(f as any).is_vendedor && (
                              <Badge className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700">
                                <Target className="h-3 w-3" />
                                Vendedor
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {entregador?.user_id ? (
                            <Badge variant="outline" className="gap-1 text-xs text-primary">
                              <UserCheck className="h-3 w-3" />
                              Configurado
                            </Badge>
                          ) : entregador ? (
                            <span className="text-muted-foreground text-xs">Sem acesso</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenUnidades(f)}
                                  >
                                    <Building2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Associar a filiais</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(f)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum funcionário encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {unidadesDialog && (
        <FuncionarioUnidadesDialog
          open={!!unidadesDialog}
          onOpenChange={(o) => !o && setUnidadesDialog(null)}
          userId={unidadesDialog.userId}
          funcionarioNome={unidadesDialog.nome}
        />
      )}
    </MainLayout>
  );
}
