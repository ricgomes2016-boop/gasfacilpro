import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building, MapPin, Phone, Mail, Edit, Loader2, Store, Smartphone, Clock,
  ShieldCheck, Upload, Eye, EyeOff, AlertTriangle, FileText, Calculator, Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Unidade } from "@/contexts/UnidadeContext";

type AnyUnidade = Unidade & Record<string, any>;

const REGIMES = [
  { v: "simples_nacional", l: "Simples Nacional" },
  { v: "lucro_presumido", l: "Lucro Presumido" },
  { v: "lucro_real", l: "Lucro Real" },
  { v: "mei", l: "MEI" },
];

const PROVEDORES = [
  { v: "nenhum", l: "Nenhum" },
  { v: "focus_nfe", l: "Focus NFe" },
  { v: "tecnospeed", l: "TecnoSpeed" },
  { v: "enotas", l: "eNotas" },
  { v: "nfe_io", l: "NFe.io" },
];

export default function UnidadesConfig() {
  const { toast } = useToast();
  const [unidades, setUnidades] = useState<AnyUnidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUnidade, setEditingUnidade] = useState<AnyUnidade | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSenhaCert, setShowSenhaCert] = useState(false);
  const [showCsc, setShowCsc] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [activeTab, setActiveTab] = useState("geral");

  useEffect(() => {
    fetchUnidades();
  }, []);

  const fetchUnidades = async () => {
    try {
      // NOTE: avoid select("*") because sensitive credential columns
      // (certificado_a1_senha, provedor_nfe_token, nfce_csc_token, contador_email,
      // contador_cpf_cnpj) have column-level SELECT revoked from `authenticated`.
      // They are loaded on demand via the get_unidade_credenciais RPC.
      const { data, error } = await supabase
        .from("unidades")
        .select(
          "id, nome, tipo, ativo, razao_social, nome_fantasia, cnpj, inscricao_estadual, inscricao_estadual_st, inscricao_municipal, cnae_principal, regime_tributario, telefone, email, endereco, bairro, cidade, estado, cep, chave_pix, bairros_atendidos, horario_abertura, horario_fechamento, certificado_a1_validade, certificado_a1_titular, nfe_ambiente, nfe_serie, nfe_proximo_numero, nfce_serie, nfce_proximo_numero, nfce_csc_id, cte_serie, cte_proximo_numero, cfop_padrao_venda, cfop_padrao_devolucao, natureza_operacao_padrao, aliquota_icms_padrao, aliquota_pis_padrao, aliquota_cofins_padrao, cst_csosn_padrao, contador_nome, contador_crc, contador_telefone, provedor_nfe, provedor_nfe_url, empresa_id, created_at, updated_at, gas_do_povo_habilitado, gas_do_povo_valor"
        )
        .eq("ativo", true)
        .order("tipo")
        .order("nome");
      if (error) throw error;
      setUnidades(
        (data || []).map((u: any) => ({
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

  const validateFiscal = (u: AnyUnidade): string[] => {
    const errs: string[] = [];
    const has = (v: any) => v !== null && v !== undefined && String(v).trim() !== "";

    const certConfigured = Boolean(u.certificado_a1_configurado || u.certificado_a1_path);
    const certAny = certConfigured || has(u.certificado_a1_senha) || has(u.certificado_a1_validade) || has(u.certificado_a1_titular);
    if (certAny) {
      if (!certConfigured) errs.push("Certificado A1: envie o arquivo .pfx ou .p12.");
      if (!has(u.certificado_a1_senha)) errs.push("Certificado A1: informe a senha.");
      if (!has(u.certificado_a1_validade)) errs.push("Certificado A1: informe a data de validade.");
      else {
        const d = new Date(u.certificado_a1_validade);
        if (isNaN(d.getTime())) errs.push("Certificado A1: data de validade inválida.");
        else if (d < new Date(new Date().toDateString())) errs.push("Certificado A1 está vencido — substitua antes de emitir notas.");
      }
    }

    const cscAny = has(u.nfce_csc_id) || has(u.nfce_csc_token);
    if (cscAny) {
      if (!has(u.nfce_csc_id)) errs.push("CSC NFC-e: informe o ID do CSC.");
      if (!has(u.nfce_csc_token)) errs.push("CSC NFC-e: informe o Token CSC.");
      else if (String(u.nfce_csc_token).trim().length < 16) {
        errs.push("CSC NFC-e: o Token deve ter no mínimo 16 caracteres.");
      }
    }

    if (has(u.provedor_nfe) && u.provedor_nfe !== "nenhum") {
      if (!has(u.provedor_nfe_url)) errs.push("Provedor de NFe: informe a URL da API.");
      else if (!/^https?:\/\//i.test(String(u.provedor_nfe_url))) errs.push("Provedor de NFe: URL deve começar com http:// ou https://.");
      if (!has(u.provedor_nfe_token)) errs.push("Provedor de NFe: informe o Token / API Key.");
    }

    if (u.nfe_ambiente === "producao") {
      if (!certConfigured || !has(u.certificado_a1_senha)) {
        errs.push("Ambiente Produção exige Certificado A1 e senha cadastrados.");
      }
      if (!has(u.cnpj)) errs.push("Ambiente Produção exige CNPJ da unidade.");
      if (!has(u.inscricao_estadual)) errs.push("Ambiente Produção exige Inscrição Estadual (use ISENTO se aplicável).");
      if (!has(u.regime_tributario)) errs.push("Ambiente Produção exige Regime Tributário definido.");
    }

    const intCheck = (label: string, val: any) => {
      if (!has(val)) return;
      const n = Number(val);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) errs.push(`${label} deve ser número inteiro ≥ 1.`);
    };
    intCheck("NFe - Série", u.nfe_serie);
    intCheck("NFe - Próximo nº", u.nfe_proximo_numero);
    intCheck("NFC-e - Série", u.nfce_serie);
    intCheck("NFC-e - Próximo nº", u.nfce_proximo_numero);
    intCheck("CT-e - Série", u.cte_serie);
    intCheck("CT-e - Próximo nº", u.cte_proximo_numero);

    return errs;
  };

  const handleSave = async () => {
    if (!editingUnidade) return;
    const u = editingUnidade;

    const errs = validateFiscal(u);
    if (errs.length > 0) {
      setActiveTab("fiscal");
      toast({
        title: "Configuração fiscal incompleta",
        description: errs.slice(0, 4).join(" • ") + (errs.length > 4 ? ` (+${errs.length - 4} pendência(s))` : ""),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        // Geral
        nome: u.nome,
        razao_social: u.razao_social || null,
        nome_fantasia: u.nome_fantasia || null,
        cnpj: u.cnpj || null,
        inscricao_estadual: u.inscricao_estadual || null,
        inscricao_estadual_st: u.inscricao_estadual_st || null,
        inscricao_municipal: u.inscricao_municipal || null,
        cnae_principal: u.cnae_principal || null,
        regime_tributario: u.regime_tributario || null,
        telefone: u.telefone || null,
        email: u.email || null,
        // Endereço
        endereco: u.endereco || null,
        bairro: u.bairro || null,
        cidade: u.cidade || null,
        estado: u.estado || null,
        cep: u.cep || null,
        // Operação
        chave_pix: u.chave_pix || null,
        bairros_atendidos: u.bairros_atendidos || null,
        horario_abertura: u.horario_abertura || "07:00",
        horario_fechamento: u.horario_fechamento || "18:00",
        // Certificado (path e senha tratados de forma restrita)
        certificado_a1_validade: u.certificado_a1_validade || null,
        certificado_a1_titular: u.certificado_a1_titular || null,
        // NFe / NFC-e / CT-e (tokens tratados via RPC)
        nfe_ambiente: u.nfe_ambiente || "homologacao",
        nfe_serie: numOrNull(u.nfe_serie),
        nfe_proximo_numero: numOrNull(u.nfe_proximo_numero),
        nfce_serie: numOrNull(u.nfce_serie),
        nfce_proximo_numero: numOrNull(u.nfce_proximo_numero),
        nfce_csc_id: u.nfce_csc_id || null,
        cte_serie: numOrNull(u.cte_serie),
        cte_proximo_numero: numOrNull(u.cte_proximo_numero),
        // Tributação
        cfop_padrao_venda: u.cfop_padrao_venda || null,
        cfop_padrao_devolucao: u.cfop_padrao_devolucao || null,
        natureza_operacao_padrao: u.natureza_operacao_padrao || null,
        aliquota_icms_padrao: numOrNull(u.aliquota_icms_padrao),
        aliquota_pis_padrao: numOrNull(u.aliquota_pis_padrao),
        aliquota_cofins_padrao: numOrNull(u.aliquota_cofins_padrao),
        cst_csosn_padrao: u.cst_csosn_padrao || null,
        // Contador (email e cpf_cnpj tratados via RPC)
        contador_nome: u.contador_nome || null,
        contador_crc: u.contador_crc || null,
        contador_telefone: u.contador_telefone || null,
        // Provedor (token tratado via RPC)
        provedor_nfe: u.provedor_nfe || null,
        provedor_nfe_url: u.provedor_nfe_url || null,
      };
      if (u.certificado_a1_path) {
        payload.certificado_a1_path = u.certificado_a1_path;
      }

      const { error } = await supabase.from("unidades").update(payload).eq("id", u.id);
      if (error) throw error;

      // Salva credenciais sensíveis via RPC restrita a admin/gestor
      const { error: credErr } = await supabase.rpc("update_unidade_credenciais", {
        _unidade_id: u.id,
        _certificado_a1_senha: u.certificado_a1_senha || null,
        _provedor_nfe_token: u.provedor_nfe_token || null,
        _nfce_csc_token: u.nfce_csc_token || null,
        _contador_email: u.contador_email || null,
        _contador_cpf_cnpj: u.contador_cpf_cnpj || null,
      });
      if (credErr) throw credErr;

      toast({ title: "Salvo!", description: `Dados de ${u.nome} atualizados.` });
      setEditingUnidade(null);
      fetchUnidades();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const numOrNull = (v: any) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const setField = (field: string, value: any) => {
    if (!editingUnidade) return;
    setEditingUnidade({ ...editingUnidade, [field]: value });
  };

  const handleUploadCertificado = async (file: File) => {
    if (!editingUnidade) return;
    if (!editingUnidade.empresa_id) {
      toast({ title: "Empresa não vinculada", description: "Esta unidade não tem empresa.", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pfx" && ext !== "p12") {
      toast({ title: "Formato inválido", description: "Envie um arquivo .pfx ou .p12", variant: "destructive" });
      return;
    }
    setUploadingCert(true);
    try {
      const path = `${editingUnidade.empresa_id}/${editingUnidade.id}/certificado.${ext}`;
      const { error } = await supabase.storage
        .from("certificados-fiscais")
        .upload(path, file, { upsert: true, contentType: "application/x-pkcs12" });
      if (error) throw error;
      setField("certificado_a1_path", path);
      setField("certificado_a1_configurado", true);
      toast({ title: "Certificado enviado", description: "Arquivo armazenado com segurança." });
    } catch (e: any) {
      toast({ title: "Falha no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploadingCert(false);
    }
  };

  const certVencido = editingUnidade?.certificado_a1_validade
    ? new Date(editingUnidade.certificado_a1_validade) < new Date()
    : false;

  return (
    <MainLayout>
      <Header title="Gestão de Unidades" subtitle="Visualize e edite os dados de cada loja" />
      <div className="p-3 sm:p-4 md:p-6">
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
                      <Button size="icon" variant="ghost" onClick={async () => {
                        setActiveTab("geral");
                        const { data: cred } = await (supabase as any).rpc("get_unidade_credenciais", { _unidade_id: unidade.id });
                        const c = Array.isArray(cred) ? cred[0] : cred;
                        setEditingUnidade({
                          ...unidade,
                          certificado_a1_senha: c?.certificado_a1_senha ?? "",
                          provedor_nfe_token: c?.provedor_nfe_token ?? "",
                          nfce_csc_token: c?.nfce_csc_token ?? "",
                          contador_email: c?.contador_email ?? "",
                          contador_cpf_cnpj: c?.contador_cpf_cnpj ?? "",
                          certificado_a1_configurado: Boolean(c?.certificado_a1_configurado),
                        });
                      }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {unidade.cnpj && <p className="text-muted-foreground">CNPJ: {unidade.cnpj}</p>}
                  {unidade.inscricao_estadual && (
                    <p className="text-muted-foreground">IE: {unidade.inscricao_estadual}</p>
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
                  <div className="flex flex-wrap gap-1 pt-1">
                    {unidade.certificado_a1_validade && (
                      <Badge variant="outline" className="gap-1">
                        <ShieldCheck className="h-3 w-3" /> Certificado A1
                      </Badge>
                    )}
                    {unidade.nfe_ambiente === "producao" && (
                      <Badge variant="default">NFe Produção</Badge>
                    )}
                    {unidade.regime_tributario && (
                      <Badge variant="secondary">
                        {REGIMES.find((r) => r.v === unidade.regime_tributario)?.l ?? unidade.regime_tributario}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!editingUnidade} onOpenChange={(open) => !open && setEditingUnidade(null)}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Editar {editingUnidade?.nome}
              </DialogTitle>
            </DialogHeader>
            {editingUnidade && (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="geral">Geral</TabsTrigger>
                  <TabsTrigger value="endereco">Endereço</TabsTrigger>
                  <TabsTrigger value="operacao">Operação</TabsTrigger>
                  <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                </TabsList>

                {/* GERAL */}
                <TabsContent value="geral" className="space-y-4 mt-4">
                  <div className="grid gap-2">
                    <Label>Nome da Unidade</Label>
                    <Input value={editingUnidade.nome} onChange={(e) => setField("nome", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Razão Social</Label>
                      <Input value={editingUnidade.razao_social || ""} onChange={(e) => setField("razao_social", e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Nome Fantasia</Label>
                      <Input value={editingUnidade.nome_fantasia || ""} onChange={(e) => setField("nome_fantasia", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>CNPJ</Label>
                      <Input value={editingUnidade.cnpj || ""} onChange={(e) => setField("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
                    </div>
                    <div className="grid gap-2">
                      <Label>CNAE Principal</Label>
                      <Input value={editingUnidade.cnae_principal || ""} onChange={(e) => setField("cnae_principal", e.target.value)} placeholder="0000-0/00" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label>Inscrição Estadual</Label>
                      <Input value={editingUnidade.inscricao_estadual || ""} onChange={(e) => setField("inscricao_estadual", e.target.value)} placeholder="ISENTO ou número" />
                    </div>
                    <div className="grid gap-2">
                      <Label>IE Substituto Tributário</Label>
                      <Input value={editingUnidade.inscricao_estadual_st || ""} onChange={(e) => setField("inscricao_estadual_st", e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Inscrição Municipal</Label>
                      <Input value={editingUnidade.inscricao_municipal || ""} onChange={(e) => setField("inscricao_municipal", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Regime Tributário</Label>
                    <Select
                      value={editingUnidade.regime_tributario || "nenhum"}
                      onValueChange={(v) => setField("regime_tributario", v === "nenhum" ? null : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Não definido</SelectItem>
                        {REGIMES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Telefone</Label>
                      <Input value={editingUnidade.telefone || ""} onChange={(e) => setField("telefone", e.target.value)} placeholder="(00) 0000-0000" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Email</Label>
                      <Input value={editingUnidade.email || ""} onChange={(e) => setField("email", e.target.value)} placeholder="email@exemplo.com" />
                    </div>
                  </div>
                </TabsContent>

                {/* ENDEREÇO */}
                <TabsContent value="endereco" className="space-y-4 mt-4">
                  <div className="grid gap-2">
                    <Label>Endereço</Label>
                    <Input value={editingUnidade.endereco || ""} onChange={(e) => setField("endereco", e.target.value)} placeholder="Rua, Número" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Bairro</Label>
                      <Input value={editingUnidade.bairro || ""} onChange={(e) => setField("bairro", e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>CEP</Label>
                      <Input value={editingUnidade.cep || ""} onChange={(e) => setField("cep", e.target.value)} placeholder="00000-000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Cidade</Label>
                      <Input value={editingUnidade.cidade || ""} onChange={(e) => setField("cidade", e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Estado</Label>
                      <Input value={editingUnidade.estado || ""} onChange={(e) => setField("estado", e.target.value)} placeholder="UF" maxLength={2} />
                    </div>
                  </div>
                </TabsContent>

                {/* OPERAÇÃO */}
                <TabsContent value="operacao" className="space-y-4 mt-4">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> Chave PIX</Label>
                    <Input
                      value={editingUnidade.chave_pix || ""}
                      onChange={(e) => setField("chave_pix", e.target.value)}
                      placeholder="CPF, CNPJ, email, telefone ou chave aleatória"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Horário de Atendimento (Bia IA)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-1">
                        <span className="text-xs text-muted-foreground">Abertura</span>
                        <Input type="time" value={editingUnidade.horario_abertura || "07:00"} onChange={(e) => setField("horario_abertura", e.target.value)} />
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs text-muted-foreground">Fechamento</span>
                        <Input type="time" value={editingUnidade.horario_fechamento || "18:00"} onChange={(e) => setField("horario_fechamento", e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Bairros Atendidos (Bia IA)</Label>
                    <Input
                      value={editingUnidade.bairros_atendidos || ""}
                      onChange={(e) => setField("bairros_atendidos", e.target.value)}
                      placeholder="Centro, Jardim América, Vila Nova"
                    />
                  </div>
                </TabsContent>

                {/* FISCAL */}
                <TabsContent value="fiscal" className="space-y-4 mt-4">
                  {/* Certificado A1 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" /> Certificado Digital A1
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2">
                        <Label>Arquivo (.pfx ou .p12)</Label>
                        <div className="flex gap-2">
                          <Input
                            type="file"
                            accept=".pfx,.p12"
                            onChange={(e) => e.target.files?.[0] && handleUploadCertificado(e.target.files[0])}
                            disabled={uploadingCert}
                          />
                          {uploadingCert && <Loader2 className="h-5 w-5 animate-spin self-center" />}
                        </div>
                        {(editingUnidade.certificado_a1_configurado || editingUnidade.certificado_a1_path) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Upload className="h-3 w-3" />
                            {editingUnidade.certificado_a1_path ? "Novo certificado pronto para salvar" : "Certificado A1 configurado"}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label>Senha do Certificado</Label>
                          <div className="flex gap-1">
                            <Input
                              type={showSenhaCert ? "text" : "password"}
                              value={editingUnidade.certificado_a1_senha || ""}
                              onChange={(e) => setField("certificado_a1_senha", e.target.value)}
                              autoComplete="off"
                            />
                            <Button type="button" size="icon" variant="ghost" onClick={() => setShowSenhaCert((s) => !s)}>
                              {showSenhaCert ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>Validade</Label>
                          <Input
                            type="date"
                            value={editingUnidade.certificado_a1_validade || ""}
                            onChange={(e) => setField("certificado_a1_validade", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Titular do Certificado</Label>
                        <Input
                          value={editingUnidade.certificado_a1_titular || ""}
                          onChange={(e) => setField("certificado_a1_titular", e.target.value)}
                          placeholder="Razão Social - CNPJ"
                        />
                      </div>
                      {editingUnidade.certificado_a1_validade && (
                        <Alert variant={certVencido ? "destructive" : "default"}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            {certVencido ? "Certificado vencido" : `Válido até ${new Date(editingUnidade.certificado_a1_validade).toLocaleDateString("pt-BR")}`}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>

                  {/* Ambiente + Numeração */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-primary" /> NFe / NFC-e / CT-e
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2">
                        <Label>Ambiente</Label>
                        <Select
                          value={editingUnidade.nfe_ambiente || "homologacao"}
                          onValueChange={(v) => setField("nfe_ambiente", v)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                            <SelectItem value="producao">Produção (válido fiscal)</SelectItem>
                          </SelectContent>
                        </Select>
                        {editingUnidade.nfe_ambiente === "producao" && (
                          <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>Notas emitidas terão validade fiscal real.</AlertDescription>
                          </Alert>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1">
                          <Label className="text-xs">NFe - Série</Label>
                          <Input type="number" value={editingUnidade.nfe_serie ?? ""} onChange={(e) => setField("nfe_serie", e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">NFe - Próximo nº</Label>
                          <Input type="number" value={editingUnidade.nfe_proximo_numero ?? ""} onChange={(e) => setField("nfe_proximo_numero", e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">NFC-e - Série</Label>
                          <Input type="number" value={editingUnidade.nfce_serie ?? ""} onChange={(e) => setField("nfce_serie", e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">NFC-e - Próximo nº</Label>
                          <Input type="number" value={editingUnidade.nfce_proximo_numero ?? ""} onChange={(e) => setField("nfce_proximo_numero", e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">CT-e - Série</Label>
                          <Input type="number" value={editingUnidade.cte_serie ?? ""} onChange={(e) => setField("cte_serie", e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">CT-e - Próximo nº</Label>
                          <Input type="number" value={editingUnidade.cte_proximo_numero ?? ""} onChange={(e) => setField("cte_proximo_numero", e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                        <div className="grid gap-2">
                          <Label>CSC ID (NFC-e)</Label>
                          <Input value={editingUnidade.nfce_csc_id || ""} onChange={(e) => setField("nfce_csc_id", e.target.value)} placeholder="ex: 000001" />
                        </div>
                        <div className="grid gap-2">
                          <Label>CSC Token (NFC-e)</Label>
                          <div className="flex gap-1">
                            <Input
                              type={showCsc ? "text" : "password"}
                              value={editingUnidade.nfce_csc_token || ""}
                              onChange={(e) => setField("nfce_csc_token", e.target.value)}
                              autoComplete="off"
                            />
                            <Button type="button" size="icon" variant="ghost" onClick={() => setShowCsc((s) => !s)}>
                              {showCsc ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tributação padrão */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-primary" /> Tributação padrão
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label>CFOP padrão de Venda</Label>
                          <Input value={editingUnidade.cfop_padrao_venda || ""} onChange={(e) => setField("cfop_padrao_venda", e.target.value)} placeholder="ex: 5656" />
                        </div>
                        <div className="grid gap-2">
                          <Label>CFOP padrão de Devolução</Label>
                          <Input value={editingUnidade.cfop_padrao_devolucao || ""} onChange={(e) => setField("cfop_padrao_devolucao", e.target.value)} placeholder="ex: 1202" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Natureza da Operação padrão</Label>
                        <Input
                          value={editingUnidade.natureza_operacao_padrao || ""}
                          onChange={(e) => setField("natureza_operacao_padrao", e.target.value)}
                          placeholder="Venda de mercadoria adquirida ou recebida de terceiros"
                        />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="grid gap-1">
                          <Label className="text-xs">ICMS %</Label>
                          <Input type="number" step="0.01" value={editingUnidade.aliquota_icms_padrao ?? ""} onChange={(e) => setField("aliquota_icms_padrao", e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">PIS %</Label>
                          <Input type="number" step="0.01" value={editingUnidade.aliquota_pis_padrao ?? ""} onChange={(e) => setField("aliquota_pis_padrao", e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">COFINS %</Label>
                          <Input type="number" step="0.01" value={editingUnidade.aliquota_cofins_padrao ?? ""} onChange={(e) => setField("aliquota_cofins_padrao", e.target.value)} />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">CST/CSOSN</Label>
                          <Input value={editingUnidade.cst_csosn_padrao || ""} onChange={(e) => setField("cst_csosn_padrao", e.target.value)} placeholder="ex: 102 ou 04" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Provedor */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Provedor de Emissão Fiscal
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2">
                        <Label>Provedor</Label>
                        <Select
                          value={editingUnidade.provedor_nfe || "nenhum"}
                          onValueChange={(v) => setField("provedor_nfe", v === "nenhum" ? null : v)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PROVEDORES.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>URL da API</Label>
                        <Input value={editingUnidade.provedor_nfe_url || ""} onChange={(e) => setField("provedor_nfe_url", e.target.value)} placeholder="https://..." />
                      </div>
                      <div className="grid gap-2">
                        <Label>Token / API Key</Label>
                        <Input
                          type="password"
                          value={editingUnidade.provedor_nfe_token || ""}
                          onChange={(e) => setField("provedor_nfe_token", e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contador */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building className="h-4 w-4 text-primary" /> Contador / Responsável Fiscal
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label>Nome</Label>
                          <Input value={editingUnidade.contador_nome || ""} onChange={(e) => setField("contador_nome", e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                          <Label>CPF/CNPJ</Label>
                          <Input value={editingUnidade.contador_cpf_cnpj || ""} onChange={(e) => setField("contador_cpf_cnpj", e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                          <Label>CRC</Label>
                          <Input value={editingUnidade.contador_crc || ""} onChange={(e) => setField("contador_crc", e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Telefone</Label>
                          <Input value={editingUnidade.contador_telefone || ""} onChange={(e) => setField("contador_telefone", e.target.value)} />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Email</Label>
                        <Input value={editingUnidade.contador_email || ""} onChange={(e) => setField("contador_email", e.target.value)} />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                  <Button variant="outline" onClick={() => setEditingUnidade(null)}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
