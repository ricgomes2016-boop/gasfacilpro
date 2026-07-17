import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, ShieldAlert, ShieldX, FileSignature, RefreshCw, Download, ExternalLink, Loader2 } from "lucide-react";
import { useUnidade } from "@/contexts/UnidadeContext";
import {
  diagnosticarCertificado,
  gerarPdfAmostraAssinado,
  type DiagnosticoResultado,
} from "@/services/digitalSignature/signPdfClient";
import { toast } from "sonner";

export default function AssinaturaDigitalDiagnostico() {
  const { unidadeAtual } = useUnidade();
  const [loading, setLoading] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [diag, setDiag] = useState<DiagnosticoResultado | null>(null);
  const [ultimaResposta, setUltimaResposta] = useState<any>(null);

  async function rodar() {
    if (!unidadeAtual?.id) return;
    setLoading(true);
    const r = await diagnosticarCertificado(unidadeAtual.id);
    setDiag(r);
    setUltimaResposta(r.raw);
    setLoading(false);
  }

  useEffect(() => {
    rodar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeAtual?.id]);

  async function gerarAmostra() {
    if (!unidadeAtual?.id) return;
    setGerando(true);
    const t = toast.loading("Gerando PDF de teste assinado...");
    const r = await gerarPdfAmostraAssinado(unidadeAtual.id);
    toast.dismiss(t);
    setUltimaResposta(r.raw);
    setGerando(false);
    if (!r.ok) {
      toast.error(`Falha: ${r.mensagem || r.motivo || "erro desconhecido"}`);
      return;
    }
    toast.success(`Assinado por ${r.titular || "certificado A1"}`);
    const blob = new Blob([r.pdf as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teste-assinatura-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const d = diag?.diagnostico;
  const statusOk = diag?.ok && d && !d.vencido;
  const fmtData = (s?: string) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Diagnóstico de Assinatura Digital</h1>
        <p className="text-sm text-muted-foreground">
          Valida o certificado A1 (e-CNPJ) cadastrado para a unidade <b>{unidadeAtual?.nome || "—"}</b> e
          permite gerar um PDF de teste já assinado.
        </p>
      </div>

      {/* Bloco 1: Status do certificado */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : statusOk ? (
                <ShieldCheck className="h-5 w-5 text-success" />
              ) : d?.vencido ? (
                <ShieldX className="h-5 w-5 text-destructive" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-warning" />
              )}
              Status do certificado
            </CardTitle>
            <CardDescription>
              {loading ? "Verificando..." : statusOk ? "Certificado válido e pronto para uso" : diag?.mensagem || "Certificado indisponível"}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={rodar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Reverificar
          </Button>
        </CardHeader>
        <CardContent>
          {!loading && !d && (
            <Alert variant="destructive">
              <AlertTitle>{diag?.motivo || "Sem dados"}</AlertTitle>
              <AlertDescription>
                {diag?.mensagem || "Cadastre o .pfx + senha em Configurações › Unidades."}
                <div className="mt-2">
                  <Button asChild variant="outline" size="sm">
                    <a href="/config/unidades">Abrir Unidades</a>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          {d && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <Field label="Titular" value={d.titular || "—"} />
              <Field label="CNPJ" value={d.cnpj || "(não detectado)"} />
              <Field label="Emissor" value={d.emissor} />
              <Field
                label="ICP-Brasil"
                value={
                  d.cadeia_icp_brasil ? (
                    <Badge className="bg-success hover:bg-success">Sim</Badge>
                  ) : (
                    <Badge variant="secondary">Não detectado</Badge>
                  )
                }
              />
              <Field label="Válido a partir" value={fmtData(d.validade_inicio)} />
              <Field
                label="Válido até"
                value={
                  <span className={d.vencido ? "text-destructive font-semibold" : d.dias_para_vencer < 30 ? "text-warning font-semibold" : ""}>
                    {fmtData(d.validade_fim)} ({d.vencido ? "vencido" : `${d.dias_para_vencer} dias`})
                  </span>
                }
              />
              <Field label="Serial" value={<code className="text-xs break-all">{d.serial}</code>} />
              <Field label="Tamanho da chave" value={`${d.tamanho_chave || "?"} bits`} />
              <Field label="Algoritmo" value={d.algoritmo} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloco 2: Teste de assinatura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Teste de assinatura
          </CardTitle>
          <CardDescription>
            Gera e baixa um PDF de 1 página com a assinatura digital aplicada usando este certificado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={gerarAmostra} disabled={!statusOk || gerando} className="gap-2">
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Gerar PDF de teste assinado
          </Button>

          <Alert>
            <AlertTitle>Como validar a assinatura</AlertTitle>
            <AlertDescription className="space-y-2 text-sm">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Abra o PDF baixado no <b>Adobe Acrobat Reader</b> (recomendado).</li>
                <li>Clique no painel <b>Assinaturas</b> (ícone de caneta na lateral).</li>
                <li>Confira: <b>Assinado por {d?.titular || "<seu titular>"}</b>, motivo, data e local.</li>
                <li>
                  Se aparecer "validade desconhecida", clique com o direito sobre a assinatura ›{" "}
                  <i>Mostrar propriedades da assinatura</i> › <i>Mostrar certificado do signatário</i> › aba{" "}
                  <i>Confiança</i> › <b>Adicionar à lista de identidades confiáveis</b>. Faça isso 1 vez para a Raiz ICP-Brasil.
                </li>
              </ol>
              <div className="pt-2">
                <a
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                  href="https://validar.iti.gov.br/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Verificar no validador oficial do ITI <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Bloco 3: Logs */}
      {ultimaResposta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Última resposta da função (debug)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-72">
              {JSON.stringify(
                { ...ultimaResposta, pdfBase64Assinado: ultimaResposta?.pdfBase64Assinado ? "[…base64 omitido…]" : undefined },
                null,
                2,
              )}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
