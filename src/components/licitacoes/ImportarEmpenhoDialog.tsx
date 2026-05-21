import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { Upload, Loader2, FileText } from "lucide-react";

export interface EmpenhoExtraidoItem {
  produto_descricao: string;
  produto_id_sugerido: string | null;
  quantidade: number;
  valor_unitario: number;
}

export interface EmpenhoExtraido {
  numero_empenho: string;
  data_empenho: string | null;
  orgao_nome: string;
  parceiro_id_sugerido: string | null;
  // Legacy single-item fields (primeiro item)
  produto_descricao: string;
  produto_id_sugerido: string | null;
  quantidade: number;
  valor_unitario: number;
  // Multi-item
  itens?: EmpenhoExtraidoItem[];
  observacoes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onParsed: (dados: EmpenhoExtraido) => void;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export function ImportarEmpenhoDialog({ open, onClose, onParsed }: Props) {
  const { unidadeAtual } = useUnidade() as any;
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > MAX_SIZE) {
      toast.error("Arquivo muito grande (máx 5MB)");
      return;
    }
    const okTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!okTypes.includes(file.type)) {
      toast.error("Formato não suportado. Use PDF, PNG ou JPG.");
      return;
    }
    setFileName(file.name);
    setLoading(true);
    try {
      const [b64, parceirosRes, produtosRes] = await Promise.all([
        fileToBase64(file),
        (supabase as any).from("vale_gas_parceiros").select("id, nome").eq("ativo", true),
        unidadeAtual?.id
          ? (supabase as any).from("produtos").select("id, nome").eq("ativo", true).eq("unidade_id", unidadeAtual.id)
          : (supabase as any).from("produtos").select("id, nome").eq("ativo", true),
      ]);

      const { data, error } = await supabase.functions.invoke("extrair-empenho-ia", {
        body: {
          fileBase64: b64,
          mimeType: file.type,
          parceiros: parceirosRes.data || [],
          produtos: produtosRes.data || [],
        },
      });
      if (error) throw error;
      if (!data?.ok) {
        toast.error(data?.erro || "Não foi possível extrair o empenho");
        setLoading(false);
        return;
      }
      toast.success("Dados extraídos! Revise antes de salvar.");
      onParsed(data.dados as EmpenhoExtraido);
      setLoading(false);
      setFileName("");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao processar arquivo");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Importar Empenho com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie o PDF ou foto da Nota de Empenho. A IA vai ler e preencher o cadastro para você revisar.
          </p>

          <div
            onClick={() => !loading && inputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/40 transition-colors"
          >
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Analisando documento com IA...</p>
                {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Clique para selecionar</p>
                <p className="text-xs text-muted-foreground">PDF, PNG ou JPG (máx 5MB)</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
