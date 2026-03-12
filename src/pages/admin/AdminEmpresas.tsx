import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Building2, Search, SearchCheck, MapPin, FileText } from "lucide-react";
import { format } from "date-fns";
import { formatCNPJ, formatPhone, formatCEP } from "@/hooks/useInputMasks";

interface Empresa {
  id: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  plano: string;
  plano_max_usuarios: number;
  plano_max_unidades: number;
  ativo: boolean;
  created_at: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  bairro: string | null;
  numero: string | null;
  complemento: string | null;
  inscricao_estadual: string | null;
  regime_tributacao: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
}

const PLANOS = [
  { key: "starter", label: "Starter", maxUsuarios: 5, maxUnidades: 1 },
  { key: "pro", label: "Pro", maxUsuarios: 15, maxUnidades: 3 },
  { key: "enterprise", label: "Enterprise", maxUsuarios: 50, maxUnidades: 10 },
];

const REGIMES_TRIBUTACAO = [
  { key: "simples_nacional", label: "Simples Nacional" },
  { key: "lucro_presumido", label: "Lucro Presumido" },
  { key: "lucro_real", label: "Lucro Real" },
  { key: "mei", label: "MEI" },
];

export default function AdminEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  // Form fields
  const [nome, setNome] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [plano, setPlano] = useState("starter");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [regimeTributacao, setRegimeTributacao] = useState("");

  const fetchEmpresas = async () => {
    const { data, error } = await supabase
      .from("empresas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { console.error(error); return; }
    setEmpresas((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEmpresas(); }, []);

  const resetForm = () => {
    setNome(""); setRazaoSocial(""); setNomeFantasia(""); setCnpj("");
    setEmail(""); setTelefone(""); setPlano("starter");
    setEndereco(""); setNumero(""); setComplemento(""); setBairro("");
    setCidade(""); setEstado(""); setCep("");
    setInscricaoEstadual(""); setRegimeTributacao("");
    setEditing(null);
  };

  const openEdit = (emp: Empresa) => {
    setEditing(emp);
    setNome(emp.nome);
    setRazaoSocial(emp.razao_social || "");
    setNomeFantasia(emp.nome_fantasia || "");
    setCnpj(emp.cnpj || "");
    setEmail(emp.email || "");
    setTelefone(emp.telefone || "");
    setPlano(emp.plano);
    setEndereco(emp.endereco || "");
    setNumero(emp.numero || "");
    setComplemento(emp.complemento || "");
    setBairro(emp.bairro || "");
    setCidade(emp.cidade || "");
    setEstado(emp.estado || "");
    setCep(emp.cep || "");
    setInscricaoEstadual(emp.inscricao_estadual || "");
    setRegimeTributacao(emp.regime_tributacao || "");
    setDialogOpen(true);
  };

  const openNew = () => { resetForm(); setDialogOpen(true); };

  const generateSlug = (name: string) =>
    name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);

  const buscarCnpj = async () => {
    const cnpjClean = cnpj.replace(/\D/g, "");
    if (cnpjClean.length !== 14) {
      toast.error("Digite um CNPJ completo (14 dígitos)");
      return;
    }
    setBuscandoCnpj(true);
    try {
      const { data, error } = await supabase.functions.invoke("consulta-cnpj", {
        body: { cnpj: cnpjClean },
      });
      if (error) throw error;
      if (data.error) {
        toast.error(data.error);
        return;
      }

      // Auto-fill fields
      if (data.razao_social) setRazaoSocial(data.razao_social);
      if (data.nome_fantasia) {
        setNomeFantasia(data.nome_fantasia);
        if (!nome) setNome(data.nome_fantasia);
      }
      if (data.email) setEmail(data.email);
      if (data.telefone) setTelefone(data.telefone);
      if (data.endereco) setEndereco(data.endereco);
      if (data.numero) setNumero(data.numero);
      if (data.complemento) setComplemento(data.complemento);
      if (data.bairro) setBairro(data.bairro);
      if (data.cidade) setCidade(data.cidade);
      if (data.estado) setEstado(data.estado);
      if (data.cep) setCep(data.cep);

      toast.success("CNPJ encontrado! Dados preenchidos automaticamente.");
    } catch (error: any) {
      console.error("Erro ao buscar CNPJ:", error);
      toast.error("Erro ao consultar CNPJ. Tente novamente.");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const planoConfig = PLANOS.find((p) => p.key === plano) || PLANOS[0];
    const payload = {
      nome,
      cnpj: cnpj || null,
      email: email || null,
      telefone: telefone || null,
      plano,
      plano_max_usuarios: planoConfig.maxUsuarios,
      plano_max_unidades: planoConfig.maxUnidades,
      razao_social: razaoSocial || null,
      nome_fantasia: nomeFantasia || null,
      endereco: endereco || null,
      numero: numero || null,
      complemento: complemento || null,
      bairro: bairro || null,
      cidade: cidade || null,
      estado: estado || null,
      cep: cep || null,
      inscricao_estadual: inscricaoEstadual || null,
      regime_tributacao: regimeTributacao || null,
    };

    try {
      if (editing) {
        const { error } = await supabase.from("empresas").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Empresa atualizada!");
      } else {
        const { error } = await supabase.from("empresas").insert({
          ...payload,
          slug: generateSlug(nome),
        });
        if (error) throw error;
        toast.success("Empresa criada!");
      }
      setDialogOpen(false); resetForm(); fetchEmpresas();
    } catch (error: any) { toast.error("Erro: " + error.message); }
    finally { setSaving(false); }
  };

  const toggleAtivo = async (emp: Empresa) => {
    const { error } = await supabase.from("empresas").update({ ativo: !emp.ativo }).eq("id", emp.id);
    if (error) { toast.error("Erro ao alterar status"); return; }
    toast.success(emp.ativo ? "Empresa desativada" : "Empresa reativada");
    fetchEmpresas();
  };

  const filtered = empresas.filter((e) =>
    e.nome.toLowerCase().includes(search.toLowerCase()) ||
    (e.cnpj && e.cnpj.includes(search))
  );

  const planoBadgeVariant = (p: string) => {
    if (p === "enterprise") return "default";
    if (p === "pro") return "secondary";
    return "outline";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Empresas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {empresas.length} {empresas.length === 1 ? "empresa cadastrada" : "empresas cadastradas"} na plataforma.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity">
                <Plus className="h-4 w-4 mr-2" />
                Nova Empresa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] p-0">
              <DialogHeader className="px-6 pt-6 pb-2">
                <DialogTitle>{editing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
                <DialogDescription>
                  {editing ? "Altere os dados da empresa." : "Cadastre uma nova empresa na plataforma."}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[calc(90vh-120px)] px-6 pb-6">
                <div className="space-y-6">
                  {/* CNPJ + Busca automática */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <SearchCheck className="h-4 w-4 text-primary" />
                      CNPJ
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={cnpj}
                        onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={buscarCnpj}
                        disabled={buscandoCnpj || cnpj.replace(/\D/g, "").length !== 14}
                        className="shrink-0"
                      >
                        {buscandoCnpj ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-1.5" />
                            Buscar
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Digite o CNPJ e clique em Buscar para preencher automaticamente
                    </p>
                  </div>

                  <Separator />

                  {/* Dados da Empresa */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                      <Building2 className="h-4 w-4" />
                      Dados da Empresa
                    </h3>
                    <div className="space-y-2">
                      <Label>Razão Social</Label>
                      <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Razão social conforme CNPJ" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome Fantasia</Label>
                        <Input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} placeholder="Nome fantasia" />
                      </div>
                      <div className="space-y-2">
                        <Label>Nome no Sistema *</Label>
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome exibido na plataforma" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="contato@empresa.com" />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input
                          value={telefone}
                          onChange={(e) => setTelefone(formatPhone(e.target.value))}
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Endereço */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                      <MapPin className="h-4 w-4" />
                      Endereço
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label>Logradouro</Label>
                        <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, Avenida..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Número</Label>
                        <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Nº" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Complemento</Label>
                        <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Sala, Andar..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Bairro</Label>
                        <Input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Cidade</Label>
                        <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" />
                      </div>
                      <div className="space-y-2">
                        <Label>Estado</Label>
                        <Input value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} placeholder="UF" maxLength={2} />
                      </div>
                      <div className="space-y-2">
                        <Label>CEP</Label>
                        <Input
                          value={cep}
                          onChange={(e) => setCep(formatCEP(e.target.value))}
                          placeholder="00000-000"
                          maxLength={9}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Fiscal */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                      <FileText className="h-4 w-4" />
                      Dados Fiscais
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Inscrição Estadual</Label>
                        <Input value={inscricaoEstadual} onChange={(e) => setInscricaoEstadual(e.target.value)} placeholder="Inscrição Estadual" />
                      </div>
                      <div className="space-y-2">
                        <Label>Regime de Tributação</Label>
                        <Select value={regimeTributacao} onValueChange={setRegimeTributacao}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {REGIMES_TRIBUTACAO.map((r) => (
                              <SelectItem key={r.key} value={r.key}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Plano */}
                  <div className="space-y-2">
                    <Label>Plano</Label>
                    <Select value={plano} onValueChange={setPlano}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLANOS.map((p) => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.label} ({p.maxUsuarios} usuários, {p.maxUnidades} unidades)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {editing ? "Salvar Alterações" : "Criar Empresa"}
                  </Button>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/80"
          />
        </div>

        {/* Table */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Nome</TableHead>
                  <TableHead className="font-semibold">CNPJ</TableHead>
                  <TableHead className="font-semibold">Plano</TableHead>
                  <TableHead className="font-semibold">Limites</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Criada em</TableHead>
                  <TableHead className="text-right font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      {search ? "Nenhuma empresa encontrada." : "Nenhuma empresa cadastrada."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div>{emp.nome}</div>
                            {emp.cidade && emp.estado && (
                              <div className="text-xs text-muted-foreground">{emp.cidade}/{emp.estado}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{emp.cnpj || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={planoBadgeVariant(emp.plano)} className="capitalize text-xs">
                          {emp.plano}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {emp.plano_max_usuarios} usr · {emp.plano_max_unidades} und
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.ativo ? "default" : "destructive"} className="text-xs">
                          {emp.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(emp.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(emp)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleAtivo(emp)} className="text-xs">
                            {emp.ativo ? "Desativar" : "Reativar"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
