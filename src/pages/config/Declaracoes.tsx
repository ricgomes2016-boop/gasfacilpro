import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Download, FileText, RefreshCw, Save, Store, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import {
  DECLARACAO_VARIAVEIS,
  MODELOS_DECLARACAO_PRE_CONFIGURADOS,
  MODELO_DECLARACAO_PADRAO,
  gerarDeclaracoesPdf,
  type ModeloDeclaracao,
  renderDeclaracaoTexto,
} from "@/services/declaracaoPdfService";

const STORAGE_MODELOS_DECLARACAO = "modelos_declaracao_personalizados";

export default function Declaracoes() {
  const { unidades, unidadeAtual, loading } = useUnidade();
  const [titulo, setTitulo] = useState("Declaração");
  const [modelo, setModelo] = useState(MODELO_DECLARACAO_PADRAO);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState(MODELOS_DECLARACAO_PRE_CONFIGURADOS[0].id);
  const [modelosPersonalizados, setModelosPersonalizados] = useState<ModeloDeclaracao[]>(() => {
    try {
      const salvos = localStorage.getItem(STORAGE_MODELOS_DECLARACAO);
      if (!salvos) return [];
      const modelos = JSON.parse(salvos) as ModeloDeclaracao[];
      return modelos.filter((item) => item.origem === "personalizado" && item.id && item.nome);
    } catch {
      localStorage.removeItem(STORAGE_MODELOS_DECLARACAO);
      return [];
    }
  });

  const unidadesAtivas = useMemo(() => unidades.filter((u) => u.ativo !== false), [unidades]);
  const unidadesSelecionadas = useMemo(
    () => unidadesAtivas.filter((u) => selecionadas.has(u.id)),
    [unidadesAtivas, selecionadas]
  );
  const modelosDeclaracao = useMemo(
    () => [...MODELOS_DECLARACAO_PRE_CONFIGURADOS, ...modelosPersonalizados],
    [modelosPersonalizados]
  );
  const modeloSelecionado = useMemo(
    () => modelosDeclaracao.find((item) => item.id === modeloSelecionadoId) || MODELOS_DECLARACAO_PRE_CONFIGURADOS[0],
    [modeloSelecionadoId, modelosDeclaracao]
  );
  const podeRemoverModelo = modeloSelecionado.origem === "personalizado";

  const toggleUnidade = (id: string) => {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  useEffect(() => {
    if (!unidadeAtual?.id) return;
    setSelecionadas((atual) => {
      if (atual.size > 0 || !unidadesAtivas.some((u) => u.id === unidadeAtual.id)) return atual;
      return new Set([unidadeAtual.id]);
    });
  }, [unidadeAtual?.id, unidadesAtivas]);

  useEffect(() => {
    localStorage.setItem(STORAGE_MODELOS_DECLARACAO, JSON.stringify(modelosPersonalizados));
  }, [modelosPersonalizados]);

  const selecionarTodas = () => setSelecionadas(new Set(unidadesAtivas.map((u) => u.id)));
  const limparSelecao = () => setSelecionadas(new Set());
  const inserirVariavel = (variavel: string) => setModelo((atual) => `${atual}${atual.endsWith(" ") || atual.endsWith("\n") ? "" : " "}${variavel}`);

  const aplicarModelo = (id: string) => {
    const selecionado = modelosDeclaracao.find((item) => item.id === id);
    if (!selecionado) return;
    setModeloSelecionadoId(id);
    setTitulo(selecionado.titulo);
    setModelo(selecionado.texto);
  };

  const salvarModeloPersonalizado = () => {
    if (!titulo.trim() || !modelo.trim()) {
      toast.error("Informe título e texto antes de salvar o modelo");
      return;
    }
    const novoModelo: ModeloDeclaracao = {
      id: `personalizado-${Date.now()}`,
      nome: titulo.trim(),
      titulo: titulo.trim(),
      texto: modelo.trim(),
      origem: "personalizado",
    };
    setModelosPersonalizados((atuais) => [...atuais, novoModelo]);
    setModeloSelecionadoId(novoModelo.id);
    toast.success("Modelo personalizado salvo");
  };

  const removerModeloPersonalizado = () => {
    if (!podeRemoverModelo) return;
    setModelosPersonalizados((atuais) => atuais.filter((item) => item.id !== modeloSelecionadoId));
    aplicarModelo(MODELOS_DECLARACAO_PRE_CONFIGURADOS[0].id);
    toast.success("Modelo personalizado removido");
  };

  const validar = () => {
    if (unidadesSelecionadas.length === 0) {
      toast.error("Selecione ao menos uma matriz ou filial");
      return false;
    }
    if (!titulo.trim()) {
      toast.error("Informe o título da declaração");
      return false;
    }
    if (!modelo.trim()) {
      toast.error("Informe o texto da declaração");
      return false;
    }
    return true;
  };

  const handleGerarPdf = () => {
    if (!validar()) return;
    gerarDeclaracoesPdf(unidadesSelecionadas, titulo.trim(), modelo.trim());
  };

  return (
    <MainLayout>
      <Header title="Declarações" subtitle="Crie declarações personalizadas com dados automáticos de matriz e filiais" />
      <div className="p-3 sm:p-4 md:p-6 pb-12 md:pb-0 space-y-4 md:space-y-6">
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Matriz / Filiais</CardTitle>
                  <Badge variant="secondary">{unidadesSelecionadas.length} selecionada(s)</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selecionarTodas} disabled={unidadesAtivas.length === 0}>
                    Selecionar todas
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={limparSelecao} disabled={selecionadas.size === 0}>
                    Limpar
                  </Button>
                </div>

                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {loading ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Carregando unidades...</p>
                  ) : unidadesAtivas.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma unidade ativa encontrada.</p>
                  ) : (
                    unidadesAtivas.map((unidade) => (
                      <button
                        key={unidade.id}
                        type="button"
                        onClick={() => toggleUnidade(unidade.id)}
                        className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/40"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selecionadas.has(unidade.id)}
                            onClick={(event) => event.stopPropagation()}
                            onCheckedChange={() => toggleUnidade(unidade.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              {unidade.tipo === "matriz" ? <Building2 className="h-4 w-4 text-primary" /> : <Store className="h-4 w-4 text-muted-foreground" />}
                              <p className="font-medium text-sm truncate">{unidade.nome}</p>
                              <Badge variant={unidade.tipo === "matriz" ? "default" : "secondary"} className="shrink-0">
                                {unidade.tipo === "matriz" ? "Matriz" : "Filial"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{unidade.cnpj || "CNPJ não informado"}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[unidade.endereco, unidade.bairro, unidade.cidade && unidade.estado ? `${unidade.cidade}/${unidade.estado}` : unidade.cidade].filter(Boolean).join(" - ") || "Endereço não informado"}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Modelo personalizado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Modelo de declaração</Label>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <Select value={modeloSelecionadoId} onValueChange={aplicarModelo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelosDeclaracao.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.nome}{item.origem === "personalizado" ? " · personalizado" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={salvarModeloPersonalizado} className="gap-2">
                      <Save className="h-4 w-4" />
                      Salvar modelo
                    </Button>
                    <Button type="button" variant="ghost" onClick={removerModeloPersonalizado} disabled={!podeRemoverModelo} className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Título</Label>
                  <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Declaração" />
                </div>

                <div className="grid gap-2">
                  <Label>Texto da declaração</Label>
                  <Textarea value={modelo} onChange={(e) => setModelo(e.target.value)} rows={8} className="text-base md:text-sm" />
                </div>

                <div className="space-y-2">
                  <Label>Variáveis automáticas</Label>
                  <div className="flex flex-wrap gap-2">
                    {DECLARACAO_VARIAVEIS.map((variavel) => (
                      <Button key={variavel} type="button" variant="outline" size="sm" onClick={() => inserirVariavel(variavel)} className="h-8 text-xs">
                        {variavel}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col sm:flex-row gap-2 justify-between">
                  <Button type="button" variant="outline" onClick={() => aplicarModelo(modeloSelecionadoId)} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Restaurar modelo selecionado
                  </Button>
                  <Button type="button" variant="import" onClick={handleGerarPdf} className="gap-2">
                    <Download className="h-4 w-4" />
                    Gerar PDF
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Pré-visualização</CardTitle>
                  <Badge variant="outline">{unidadesSelecionadas.length || 0} página(s)</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {unidadesSelecionadas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center text-muted-foreground">
                    <Wand2 className="h-8 w-8 mb-2" />
                    <p className="text-sm">Selecione uma ou mais unidades para visualizar a declaração.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {unidadesSelecionadas.map((unidade) => (
                      <div key={unidade.id} className="rounded-lg border bg-background p-4 md:p-6 space-y-4">
                        <div className="text-center space-y-1">
                          <p className="font-bold text-lg uppercase">{unidade.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {[unidade.tipo === "matriz" ? "Matriz" : "Filial", unidade.cnpj && `CNPJ: ${unidade.cnpj}`, unidade.telefone && `Tel: ${unidade.telefone}`].filter(Boolean).join(" · ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {[unidade.endereco, unidade.bairro, unidade.cidade && unidade.estado ? `${unidade.cidade}/${unidade.estado}` : unidade.cidade, unidade.cep].filter(Boolean).join(" - ")}
                          </p>
                        </div>
                        <Separator />
                        <h2 className="text-center font-bold uppercase">{titulo || "Declaração"}</h2>
                        <div className="whitespace-pre-line text-sm leading-7 text-foreground">
                          {renderDeclaracaoTexto(modelo || MODELO_DECLARACAO_PADRAO, unidade)}
                        </div>
                        <div className="pt-10 text-center text-sm">
                          <div className="mx-auto mb-2 h-px w-64 bg-border" />
                          <p className="font-medium">{unidade.nome}</p>
                          {unidade.cnpj && <p className="text-muted-foreground">CNPJ: {unidade.cnpj}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
