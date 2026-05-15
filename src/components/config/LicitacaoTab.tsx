import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveDialog as Dialog,
  ResponsiveDialogContent as DialogContent,
  ResponsiveDialogHeader as DialogHeader,
  ResponsiveDialogTitle as DialogTitle,
  ResponsiveDialogFooter as DialogFooter,
  ResponsiveDialogDescription as DialogDescription,
} from "@/components/ui/responsive-dialog";
import { Plus, Download, FileText, Pencil, Trash2, Package, Loader2, AlertCircle, ShieldCheck, ShieldAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAssinaturaDigital } from "@/hooks/useAssinaturaDigital";
import { assinarPdfRemoto } from "@/services/digitalSignature/signPdfClient";
import {
  renderAnexo05, renderAnexo06, renderAnexo11,
  renderCartaProposta, renderPropostaPreco, renderEtiquetaEnvelope,
  ITENS_PADRAO, type DadosAnexos, type ItemProposta, type EmpresaInfo, type LicitacaoHeader, type Representante,
} from "@/lib/licitacao/templates";
import { montarZipLicitacao } from "@/lib/licitacao/zip";

const MODALIDADES = [
  { value: "presencial", label: "Pregão Presencial" },
  { value: "eletronico", label: "Pregão Eletrônico" },
];

function emptyDados(): DadosAnexos {
  return {
    porte: "ME",
    representante: { nome: "", cpf: "", rg: "", cargo: "Proprietário", endereco: "", telefone: "", celular: "" },
    banco: { banco: "Banco do Brasil", agencia: "", conta: "" },
    validade_proposta_dias: 60,
    itens: ITENS_PADRAO,
  };
}

export function LicitacaoTab() {
  const { unidadeAtual } = useUnidade();
  const { user } = useAuth();
  const qc = useQueryClient();
  const assinatura = useAssinaturaDigital();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState<null | "ident" | "anexo06" | "anexo11" | "itens">(null);
  const [generating, setGenerating] = useState(false);

  const [novaForm, setNovaForm] = useState({ numero: "", modalidade: "presencial", orgao: "", data: "", objeto: "" });

  const { data: licitacoes = [] } = useQuery({
    queryKey: ["licitacoes", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("licitacoes").select("*").order("created_at", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: unidadeFull } = useQuery({
    queryKey: ["unidade-full", unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return null;
      const { data } = await supabase.from("unidades").select("*").eq("id", unidadeAtual.id).maybeSingle();
      return data;
    },
    enabled: !!unidadeAtual?.id,
  });

  const { data: certidoes = [] } = useQuery({
    queryKey: ["certidoes_empresa", unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];
      const { data } = await supabase.from("certidoes_empresa").select("*").eq("unidade_id", unidadeAtual.id);
      return data || [];
    },
    enabled: !!unidadeAtual?.id,
  });

  const selecionada = useMemo(
    () => (licitacoes as any[]).find((l) => l.id === selectedId) || null,
    [licitacoes, selectedId]
  );

  const dados: DadosAnexos = useMemo(() => {
    const base = emptyDados();
    if (!selecionada?.dados_anexos) return base;
    return { ...base, ...(selecionada.dados_anexos as DadosAnexos) };
  }, [selecionada]);

  const empresa: EmpresaInfo | null = useMemo(() => {
    if (!unidadeFull) return null;
    return {
      razao_social: unidadeFull.razao_social || unidadeFull.nome,
      cnpj: unidadeFull.cnpj || "",
      inscricao_estadual: unidadeFull.inscricao_estadual,
      endereco: unidadeFull.endereco || "",
      bairro: unidadeFull.bairro,
      cidade: unidadeFull.cidade || "",
      estado: unidadeFull.estado || "",
      cep: unidadeFull.cep,
      telefone: unidadeFull.telefone,
      email: unidadeFull.email,
    };
  }, [unidadeFull]);

  const lic: LicitacaoHeader | null = useMemo(() => {
    if (!selecionada) return null;
    return {
      numero_pregao: selecionada.numero,
      modalidade: selecionada.modalidade?.includes("eletronico") ? "eletronico" : "presencial",
      orgao: selecionada.orgao,
      data_pregao: selecionada.data_publicacao || selecionada.data_abertura?.slice(0, 10) || "",
      cidade_assinatura: empresa?.cidade,
    };
  }, [selecionada, empresa]);

  const criarMut = useMutation({
    mutationFn: async () => {
      if (!user || !unidadeAtual) throw new Error("Sem unidade");
      const { data, error } = await supabase.from("licitacoes").insert({
        numero: novaForm.numero,
        modalidade: novaForm.modalidade === "eletronico" ? "pregao_eletronico" : "pregao_presencial",
        orgao: novaForm.orgao,
        data_publicacao: novaForm.data || null,
        objeto: novaForm.objeto,
        unidade_id: unidadeAtual.id,
        responsavel_id: user.id,
        dados_anexos: emptyDados() as any,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["licitacoes"] });
      setSelectedId(d.id);
      setNovaOpen(false);
      setNovaForm({ numero: "", modalidade: "presencial", orgao: "", data: "", objeto: "" });
      toast.success("Licitação criada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar"),
  });

  const updateMut = useMutation({
    mutationFn: async (patch: Partial<DadosAnexos>) => {
      if (!selecionada) return;
      const novo = { ...dados, ...patch };
      const { error } = await supabase.from("licitacoes").update({ dados_anexos: novo as any }).eq("id", selecionada.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licitacoes"] });
      setEditorOpen(null);
      toast.success("Salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editIdentMut = useMutation({
    mutationFn: async (patch: { numero: string; modalidade: string; orgao: string; data: string; objeto: string }) => {
      if (!selecionada) return;
      const { error } = await supabase.from("licitacoes").update({
        numero: patch.numero,
        modalidade: patch.modalidade === "eletronico" ? "pregao_eletronico" : "pregao_presencial",
        orgao: patch.orgao,
        data_publicacao: patch.data || null,
        objeto: patch.objeto,
      }).eq("id", selecionada.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licitacoes"] });
      setEditorOpen(null);
      toast.success("Cabeçalho atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("licitacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["licitacoes"] });
      setSelectedId(null);
      toast.success("Removida");
    },
  });

  function baixarPdf(name: string, gen: () => any) {
    if (!empresa || !lic || !dados.representante) {
      toast.error("Preencha cabeçalho, identificação e representante primeiro");
      return;
    }
    try {
      const doc = gen();
      doc.save(`${name}_Pregao_${lic.numero_pregao.replace(/\//g, "-")}.pdf`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function gerarPastaCompleta() {
    if (!empresa || !lic || !dados.representante || !dados.banco || !dados.itens) {
      toast.error("Complete os dados antes de gerar a pasta");
      return;
    }
    setGenerating(true);
    try {
      const rep = dados.representante;
      const banco = dados.banco;
      const itens = dados.itens;
      const fora = [
        { name: "ANEXO_05", doc: renderAnexo05(empresa, lic, rep) },
        { name: "ANEXO_06", doc: renderAnexo06(empresa, lic, rep, dados.porte || "ME") },
        { name: "ANEXO_11", doc: renderAnexo11(empresa, lic, rep, banco) },
      ];
      const env1 = [
        { name: "Carta_Proposta", doc: renderCartaProposta(empresa, lic, rep, banco, itens, dados.validade_proposta_dias || 60) },
        { name: "Proposta_de_Preco", doc: renderPropostaPreco(empresa, lic, rep, itens) },
      ];
      const certs = (certidoes as any[]).filter((c) => c.arquivo_url).map((c) => ({
        tipo: c.tipo, arquivo_url: c.arquivo_url, arquivo_nome: c.arquivo_nome,
      }));
      const blob = await montarZipLicitacao(
        lic.numero_pregao,
        fora,
        env1,
        renderEtiquetaEnvelope(empresa, lic, 2, "Documentos de Habilitação"),
        renderEtiquetaEnvelope(empresa, lic, 1, "Proposta de Preço"),
        certs
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Pregao_${lic.numero_pregao.replace(/\//g, "-")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Pasta gerada");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  }

  const repOk = !!dados.representante?.nome && !!dados.representante?.cpf && !!dados.representante?.rg;
  const bancoOk = !!dados.banco?.agencia && !!dados.banco?.conta;
  const itensOk = (dados.itens?.length || 0) > 0;

  return (
    <div className="space-y-4">
      {/* Lista + nova */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <Select value={selectedId || undefined} onValueChange={setSelectedId}>
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Selecione uma licitação..." />
          </SelectTrigger>
          <SelectContent>
            {(licitacoes as any[]).map((l) => (
              <SelectItem key={l.id} value={l.id}>
                Pregão {l.numero} — {l.orgao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          {selecionada && (
            <Button variant="outline" size="icon" onClick={() => deleteMut.mutate(selecionada.id)} title="Excluir">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
          <Button onClick={() => setNovaOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Licitação
          </Button>
        </div>
      </div>

      {!selecionada ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione ou crie uma licitação para começar a montar os anexos.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cabeçalho */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                <span>Pregão {selecionada.numero}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditorOpen("ident")} className="gap-2">
                    <Pencil className="h-4 w-4" /> Editar Cabeçalho
                  </Button>
                  <Button onClick={gerarPastaCompleta} disabled={generating} className="gap-2">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                    Gerar Pasta Completa (ZIP)
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">Órgão:</span> {selecionada.orgao}</div>
              <div><span className="text-muted-foreground">Modalidade:</span> {selecionada.modalidade}</div>
              <div><span className="text-muted-foreground">Data:</span> {selecionada.data_publicacao || "—"}</div>
              <div><span className="text-muted-foreground">Empresa:</span> {empresa?.razao_social}</div>
              {selecionada.objeto && <div className="col-span-full"><span className="text-muted-foreground">Objeto:</span> {selecionada.objeto}</div>}
            </CardContent>
          </Card>

          {/* Dados gerais */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Dados do Representante & Banco</CardTitle>
              <div className="flex gap-2">
                <Badge variant={repOk ? "default" : "destructive"}>{repOk ? "Representante OK" : "Falta dados"}</Badge>
                <Badge variant={bancoOk ? "default" : "destructive"}>{bancoOk ? "Banco OK" : "Falta dados"}</Badge>
                <Button size="sm" variant="outline" onClick={() => setEditorOpen("anexo11")}><Pencil className="h-4 w-4 mr-1" />Editar</Button>
              </div>
            </CardHeader>
            <CardContent className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>{dados.representante?.nome || "—"} ({dados.representante?.cargo})</div>
              <div>CPF: {dados.representante?.cpf || "—"} | RG: {dados.representante?.rg || "—"}</div>
              <div>{dados.banco?.banco} • Ag: {dados.banco?.agencia || "—"} • C/C: {dados.banco?.conta || "—"}</div>
              <div>Porte: <Badge variant="secondary">{dados.porte}</Badge> <Button size="sm" variant="link" className="h-auto p-0 ml-2" onClick={() => setEditorOpen("anexo06")}>alterar</Button></div>
            </CardContent>
          </Card>

          {/* Fora do envelope */}
          <SecaoAnexos titulo="Fora do Envelope">
            <AnexoCard nome="ANEXO 05 — Cumprimento dos Requisitos" pronto={repOk}
              onBaixar={() => baixarPdf("ANEXO_05", () => renderAnexo05(empresa!, lic!, dados.representante!))}
            />
            <AnexoCard nome="ANEXO 06 — Declaração ME/EPP" pronto={repOk}
              onEditar={() => setEditorOpen("anexo06")}
              onBaixar={() => baixarPdf("ANEXO_06", () => renderAnexo06(empresa!, lic!, dados.representante!, dados.porte || "ME"))}
            />
            <AnexoCard nome="ANEXO 11 — Informações Contratuais" pronto={repOk && bancoOk}
              onEditar={() => setEditorOpen("anexo11")}
              onBaixar={() => baixarPdf("ANEXO_11", () => renderAnexo11(empresa!, lic!, dados.representante!, dados.banco!))}
            />
          </SecaoAnexos>

          {/* Envelope 1 */}
          <SecaoAnexos titulo="Envelope 1 — Proposta de Preço">
            <AnexoCard nome="ANEXO 10 — Carta-Proposta" pronto={repOk && bancoOk && itensOk}
              onEditar={() => setEditorOpen("itens")}
              onBaixar={() => baixarPdf("Carta_Proposta", () => renderCartaProposta(empresa!, lic!, dados.representante!, dados.banco!, dados.itens!, dados.validade_proposta_dias || 60))}
            />
            <AnexoCard nome="Proposta de Preço (tabela de itens)" pronto={itensOk}
              onEditar={() => setEditorOpen("itens")}
              onBaixar={() => baixarPdf("Proposta_de_Preco", () => renderPropostaPreco(empresa!, lic!, dados.representante!, dados.itens!))}
            />
            <AnexoCard nome="Etiqueta do Envelope 1" pronto
              onBaixar={() => baixarPdf("Etiqueta_Envelope_1", () => renderEtiquetaEnvelope(empresa!, lic!, 1, "Proposta de Preço"))}
            />
          </SecaoAnexos>

          {/* Envelope 2 */}
          <SecaoAnexos titulo="Envelope 2 — Documentos de Habilitação">
            <div className="col-span-full flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>As certidões (CND Federal, Estadual, Municipal, Trabalhista, FGTS, ANP, Sintegra) são reaproveitadas da aba <b>Certidões e Vencimentos</b>. Anexos 07–09 podem ser enviados na aba <b>Documentos</b>.</span>
            </div>
            <AnexoCard nome="Etiqueta do Envelope 2" pronto
              onBaixar={() => baixarPdf("Etiqueta_Envelope_2", () => renderEtiquetaEnvelope(empresa!, lic!, 2, "Documentos de Habilitação"))}
            />
            {(certidoes as any[]).filter((c) => c.arquivo_url).map((c) => (
              <Card key={c.id} className="p-3 flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{c.tipo.toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">Anexada via Certidões</p>
                </div>
                <Badge variant="default">Pronta</Badge>
              </Card>
            ))}
          </SecaoAnexos>
        </>
      )}

      {/* Nova licitação */}
      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Licitação</DialogTitle>
            <DialogDescription>Preencha o cabeçalho do pregão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nº do Pregão *</Label><Input value={novaForm.numero} onChange={(e) => setNovaForm({ ...novaForm, numero: e.target.value })} placeholder="046/2021" /></div>
            <div>
              <Label>Modalidade</Label>
              <Select value={novaForm.modalidade} onValueChange={(v) => setNovaForm({ ...novaForm, modalidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODALIDADES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Órgão *</Label><Input value={novaForm.orgao} onChange={(e) => setNovaForm({ ...novaForm, orgao: e.target.value })} placeholder="Município de Cornélio Procópio - PR" /></div>
            <div><Label>Data do pregão</Label><Input type="date" value={novaForm.data} onChange={(e) => setNovaForm({ ...novaForm, data: e.target.value })} /></div>
            <div><Label>Objeto</Label><Textarea rows={2} value={novaForm.objeto} onChange={(e) => setNovaForm({ ...novaForm, objeto: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaOpen(false)}>Cancelar</Button>
            <Button onClick={() => criarMut.mutate()} disabled={!novaForm.numero || !novaForm.orgao || criarMut.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor Anexo 06 (porte) */}
      <Dialog open={editorOpen === "anexo06"} onOpenChange={(o) => !o && setEditorOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Porte da empresa</DialogTitle></DialogHeader>
          <Select value={dados.porte} onValueChange={(v) => updateMut.mutate({ porte: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ME">Microempresa (ME)</SelectItem>
              <SelectItem value="EPP">Empresa de Pequeno Porte (EPP)</SelectItem>
            </SelectContent>
          </Select>
        </DialogContent>
      </Dialog>

      {/* Editor representante + banco */}
      <RepBancoEditor
        open={editorOpen === "anexo11"}
        onClose={() => setEditorOpen(null)}
        dados={dados}
        onSave={(rep, banco) => updateMut.mutate({ representante: rep, banco })}
      />

      {/* Editor identificação */}
      <IdentEditor
        open={editorOpen === "ident"}
        onClose={() => setEditorOpen(null)}
        licitacao={selecionada}
        onSave={(p) => editIdentMut.mutate(p)}
      />

      {/* Editor itens */}
      <ItensEditor
        open={editorOpen === "itens"}
        onClose={() => setEditorOpen(null)}
        itens={dados.itens || []}
        validadeDias={dados.validade_proposta_dias || 60}
        onSave={(itens, validade) => updateMut.mutate({ itens, validade_proposta_dias: validade })}
      />
    </div>
  );
}

function SecaoAnexos({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</CardContent>
    </Card>
  );
}

function AnexoCard({ nome, pronto, onEditar, onBaixar }: { nome: string; pronto: boolean; onEditar?: () => void; onBaixar: () => void; }) {
  return (
    <Card className="p-3 flex items-center gap-3">
      <FileText className="h-5 w-5 text-primary" />
      <div className="flex-1 text-sm font-medium">{nome}</div>
      <Badge variant={pronto ? "default" : "destructive"}>{pronto ? "Pronto" : "Falta dados"}</Badge>
      {onEditar && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEditar}><Pencil className="h-4 w-4" /></Button>}
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onBaixar} disabled={!pronto}><Download className="h-4 w-4" /></Button>
    </Card>
  );
}

function RepBancoEditor({ open, onClose, dados, onSave }: any) {
  const [rep, setRep] = useState<Representante>(dados.representante || { nome: "", cpf: "", rg: "" });
  const [banco, setBanco] = useState(dados.banco || { banco: "Banco do Brasil", agencia: "", conta: "" });
  // Reset on open
  useMemo(() => {
    if (open) {
      setRep(dados.representante || { nome: "", cpf: "", rg: "" });
      setBanco(dados.banco || { banco: "Banco do Brasil", agencia: "", conta: "" });
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Representante e Conta Bancária</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nome *</Label><Input value={rep.nome} onChange={(e) => setRep({ ...rep, nome: e.target.value })} /></div>
          <div><Label>Cargo</Label><Input value={rep.cargo} onChange={(e) => setRep({ ...rep, cargo: e.target.value })} /></div>
          <div><Label>CPF *</Label><Input value={rep.cpf} onChange={(e) => setRep({ ...rep, cpf: e.target.value })} /></div>
          <div><Label>RG *</Label><Input value={rep.rg} onChange={(e) => setRep({ ...rep, rg: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={rep.telefone} onChange={(e) => setRep({ ...rep, telefone: e.target.value })} /></div>
          <div className="col-span-2"><Label>Endereço</Label><Input value={rep.endereco} onChange={(e) => setRep({ ...rep, endereco: e.target.value })} /></div>
          <div><Label>Celular</Label><Input value={rep.celular} onChange={(e) => setRep({ ...rep, celular: e.target.value })} /></div>
          <div className="col-span-2 border-t pt-3 mt-2 font-medium text-sm">Conta Bancária</div>
          <div className="col-span-2"><Label>Banco</Label><Input value={banco.banco} onChange={(e) => setBanco({ ...banco, banco: e.target.value })} /></div>
          <div><Label>Agência *</Label><Input value={banco.agencia} onChange={(e) => setBanco({ ...banco, agencia: e.target.value })} /></div>
          <div><Label>Conta *</Label><Input value={banco.conta} onChange={(e) => setBanco({ ...banco, conta: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(rep, banco)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItensEditor({ open, onClose, itens, validadeDias, onSave }: any) {
  const [list, setList] = useState<ItemProposta[]>(itens);
  const [validade, setValidade] = useState<number>(validadeDias);
  useMemo(() => { if (open) { setList(itens); setValidade(validadeDias); } }, [open]);

  function update(idx: number, field: keyof ItemProposta, value: any) {
    const next = [...list];
    (next[idx] as any)[field] = field === "especificacao" || field === "unidade" ? value : Number(value) || 0;
    setList(next);
  }
  function add() {
    setList([...list, { item: list.length + 1, especificacao: "", quantidade: 0, unidade: "UN", valor_unit: 0 }]);
  }
  function remove(idx: number) {
    setList(list.filter((_, i) => i !== idx).map((it, i) => ({ ...it, item: i + 1 })));
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Itens da Proposta</DialogTitle></DialogHeader>
        <div className="flex items-center gap-3 mb-2">
          <Label className="shrink-0">Validade (dias):</Label>
          <Input type="number" className="w-24" value={validade} onChange={(e) => setValidade(Number(e.target.value) || 60)} />
          <Button size="sm" variant="outline" onClick={add} className="ml-auto"><Plus className="h-4 w-4 mr-1" />Item</Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {list.map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-1 text-center text-sm font-medium">{it.item}</div>
              <Input className="col-span-5" value={it.especificacao} onChange={(e) => update(idx, "especificacao", e.target.value)} placeholder="Especificação" />
              <Input className="col-span-1" type="number" value={it.quantidade} onChange={(e) => update(idx, "quantidade", e.target.value)} placeholder="Qtd" />
              <Input className="col-span-1" value={it.unidade} onChange={(e) => update(idx, "unidade", e.target.value)} placeholder="Un" />
              <Input className="col-span-2" type="number" step="0.01" value={it.valor_unit} onChange={(e) => update(idx, "valor_unit", e.target.value)} placeholder="V. Unit" />
              <div className="col-span-1 text-xs text-muted-foreground text-right">{(it.quantidade * it.valor_unit).toFixed(2)}</div>
              <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8" onClick={() => remove(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(list, validade)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IdentEditor({ open, onClose, licitacao, onSave }: any) {
  const [form, setForm] = useState({ numero: "", modalidade: "presencial", orgao: "", data: "", objeto: "" });
  useMemo(() => {
    if (open && licitacao) {
      setForm({
        numero: licitacao.numero || "",
        modalidade: licitacao.modalidade?.includes("eletronico") ? "eletronico" : "presencial",
        orgao: licitacao.orgao || "",
        data: licitacao.data_publicacao || "",
        objeto: licitacao.objeto || "",
      });
    }
  }, [open, licitacao]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Cabeçalho da Licitação</DialogTitle>
          <DialogDescription>Atualize número do pregão, modalidade, órgão, data e objeto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Nº do Pregão *</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="046/2021" /></div>
          <div>
            <Label>Modalidade</Label>
            <Select value={form.modalidade} onValueChange={(v) => setForm({ ...form, modalidade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="presencial">Pregão Presencial</SelectItem>
                <SelectItem value="eletronico">Pregão Eletrônico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Órgão *</Label><Input value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} placeholder="Município de Cornélio Procópio - PR" /></div>
          <div><Label>Data do pregão</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
          <div><Label>Objeto</Label><Textarea rows={3} value={form.objeto} onChange={(e) => setForm({ ...form, objeto: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={!form.numero || !form.orgao}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
