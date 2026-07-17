import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Upload, Loader2, CheckCircle2, AlertCircle, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  empresa_id: string;
  unidade_id_padrao?: string | null;
  destino?: "auto" | "xml" | "despesa" | "financeiro";
  onConcluido?: () => void;
  label?: string;
  variant?: "default" | "outline";
}

interface ResultadoArquivo {
  nome: string;
  tipo?: string;
  unidade_nome?: string;
  status?: string;
  erro?: string;
  valor?: number;
  cnpj_dest?: string;
  confianca?: number;
}

const accept = ".zip,.xml,.pdf,.ofx,.csv,.xlsx,.xls";

export function ImportacaoInteligente({ empresa_id, unidade_id_padrao, destino = "auto", onConcluido, label = "Importação Inteligente IA", variant = "outline" }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [resultados, setResultados] = useState<ResultadoArquivo[]>([]);
  const [resumo, setResumo] = useState<{ criados: number; duplicados: number; erros: number } | null>(null);

  const fileToBase64 = (file: File) => new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!empresa_id) { toast.error("Selecione uma empresa"); return; }

    setOpen(true);
    setProcessing(true);
    setResultados([]);
    setResumo({ criados: 0, duplicados: 0, erros: 0 });

    let totCriados = 0, totDup = 0, totErr = 0;
    const todos: ResultadoArquivo[] = [];

    for (const file of Array.from(files)) {
      try {
        if (file.size > 25 * 1024 * 1024) {
          todos.push({ nome: file.name, erro: "Arquivo > 25MB" });
          totErr++; continue;
        }
        const base64 = await fileToBase64(file);
        const { data, error } = await supabase.functions.invoke("importar-inteligente", {
          body: {
            fileBase64: base64,
            fileName: file.name,
            fileMime: file.type,
            empresa_id,
            unidade_id_padrao,
            destino,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const arr: ResultadoArquivo[] = data.resultados || [];
        todos.push(...arr);
        totCriados += data.criados || 0;
        totDup += data.duplicados || 0;
        totErr += data.erros || 0;
        setResultados([...todos]);
        setResumo({ criados: totCriados, duplicados: totDup, erros: totErr });
      } catch (e: any) {
        console.error("erro IA import:", e);
        todos.push({ nome: file.name, erro: e.message });
        totErr++;
        setResultados([...todos]);
        setResumo({ criados: totCriados, duplicados: totDup, erros: totErr });
      }
    }

    setProcessing(false);
    if (totCriados > 0) toast.success(`${totCriados} registro(s) importado(s) pela IA`);
    if (totErr > 0) toast.error(`${totErr} arquivo(s) com erro`);
    onConcluido?.();
    if (fileRef.current) fileRef.current.value = "";
  };

  const confiancaBadge = (c?: number) => {
    if (c == null) return null;
    const pct = Math.round(c * 100);
    const color = pct >= 80 ? "bg-success/20 text-success border-success"
      : pct >= 50 ? "bg-warning/20 text-warning border-warning"
      : "bg-destructive/20 text-destructive border-destructive";
    return <Badge variant="outline" className={color}>{pct}%</Badge>;
  };

  return (
    <>
      <input ref={fileRef} type="file" accept={accept} multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      <Button
        variant={variant}
        onClick={() => fileRef.current?.click()}
        disabled={!empresa_id}
        className={variant === "outline" ? "border-[hsl(280,60%,50%)] text-[hsl(280,70%,70%)] hover:bg-[hsl(280,60%,15%)]" : ""}
        title="ZIP de XMLs, PDFs, OFX, CSV ou planilhas — IA roteia por CNPJ"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !processing && setOpen(o)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[hsl(280,70%,70%)]" />
              Importação Inteligente
            </DialogTitle>
            <DialogDescription>
              A IA analisa cada arquivo, identifica o CNPJ destinatário e roteia automaticamente para a loja correta.
            </DialogDescription>
          </DialogHeader>

          {processing && (
            <div className="flex items-center justify-center py-6 gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processando arquivos com IA...
            </div>
          )}

          {resumo && (
            <div className="flex gap-2 flex-wrap">
              <Badge className="bg-success text-white"><CheckCircle2 className="h-3 w-3 mr-1" /> Criados: {resumo.criados}</Badge>
              <Badge variant="outline">Duplicados: {resumo.duplicados}</Badge>
              {resumo.erros > 0 && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Erros: {resumo.erros}</Badge>}
            </div>
          )}

          <div className="flex-1 overflow-auto border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0 z-10">
                <tr>
                  <th className="p-2 text-left">Arquivo</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Loja detectada</th>
                  <th className="p-2 text-left">CNPJ</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-center">Confiança</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 max-w-[200px] truncate" title={r.nome}>{r.nome}</td>
                    <td className="p-2 uppercase text-muted-foreground">{r.tipo ?? "—"}</td>
                    <td className="p-2">{r.unidade_nome ?? <span className="text-warning">não detectada</span>}</td>
                    <td className="p-2 font-mono text-[10px]">{r.cnpj_dest ?? "—"}</td>
                    <td className="p-2 text-right">{r.valor ? `R$ ${Number(r.valor).toFixed(2)}` : "—"}</td>
                    <td className="p-2 text-center">{confiancaBadge(r.confianca)}</td>
                    <td className="p-2">
                      {r.erro ? <span className="text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{r.erro}</span>
                        : r.status === "revisao" ? <span className="text-warning flex items-center gap-1"><FileWarning className="h-3 w-3" />Revisar</span>
                        : r.status === "duplicado" ? <span className="text-muted-foreground">já existia</span>
                        : <span className="text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />OK</span>}
                    </td>
                  </tr>
                ))}
                {resultados.length === 0 && !processing && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Selecione arquivos para começar</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-3">
            {!processing && resumo && (resumo.criados > 0 || resumo.duplicados > 0) && (
              <p className="text-xs text-muted-foreground self-center mr-auto">
                ✓ Os registros já estão salvos no sistema.
              </p>
            )}
            <Button
              onClick={() => { onConcluido?.(); setOpen(false); }}
              disabled={processing}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
