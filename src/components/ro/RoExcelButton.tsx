import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  unidadeId: string | undefined;
  unidadeNome?: string;
  ano: number;
  mes: number;
}

export function RoExcelButton({ unidadeId, unidadeNome, ano, mes }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!unidadeId) {
      toast.error("Selecione uma unidade");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-ro-excel", {
        body: { unidade_id: unidadeId, ano, mes: mes + 1 },
      });
      if (error) throw error;
      const base64 = (data as any)?.file;
      if (!base64) throw new Error("Arquivo vazio");
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RO_${(unidadeNome || "Unidade").replace(/\s+/g, "_")}_${ano}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Planilha R.O. gerada");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Falha ao gerar Excel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" className="h-10 sm:h-8 text-xs min-w-0" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />}
      Excel
    </Button>
  );
}
