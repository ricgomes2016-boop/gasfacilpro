import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, CheckCircle, Building2 } from "lucide-react";
import { PixQRCode } from "@/components/pix/PixQRCode";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";

interface ChavePix {
  id: string;
  nome: string;
  banco: string;
  chave_pix: string;
}

interface PixKeySelectorModalProps {
  open: boolean;
  onClose: () => void;
  valor: number;
  beneficiario?: string;
  unidadeId?: string;
  preferredBank?: string;
  onSelect: (chavePix: string, contaBancariaId: string) => void;
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function PixKeySelectorModal({
  open,
  onClose,
  valor,
  beneficiario,
  unidadeId: externalUnidadeId,
  preferredBank = "itau",
  onSelect,
}: PixKeySelectorModalProps) {
  const [chaves, setChaves] = useState<ChavePix[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { unidadeAtual } = useUnidade();

  const resolvedUnidadeId = externalUnidadeId || unidadeAtual?.id;

  useEffect(() => {
    if (!open || !resolvedUnidadeId) return;
    setLoading(true);
    supabase
      .from("contas_bancarias")
      .select("id, nome, banco, chave_pix")
      .eq("unidade_id", resolvedUnidadeId)
      .eq("ativo", true)
      .not("chave_pix", "is", null)
      .then(({ data }) => {
        const items = (data || []).filter((c: any) => c.chave_pix) as ChavePix[];
        setChaves(items);
        const preferred = preferredBank
          ? items.find((item) => {
              const target = normalizeText(preferredBank);
              return normalizeText(`${item.banco} ${item.nome}`).includes(target);
            })
          : null;
        if (preferred) setSelected(preferred.id);
        else if (items.length === 1) setSelected(items[0].id);
        else setSelected(null);
        setLoading(false);
      });
  }, [open, resolvedUnidadeId, preferredBank]);

  const selectedChave = chaves.find((c) => c.id === selected);

  const handleConfirm = () => {
    if (selectedChave) {
      onSelect(selectedChave.chave_pix, selectedChave.id);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Selecionar Chave PIX
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total */}
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <p className="text-xs text-muted-foreground">Valor</p>
            <p className="text-2xl font-bold text-primary">
              R$ {valor.toFixed(2)}
            </p>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground text-sm py-4">Carregando chaves...</p>
          ) : chaves.length === 0 ? (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
              Nenhuma chave PIX cadastrada nas contas bancárias desta unidade.
            </div>
          ) : (
            <>
              {/* Lista de chaves */}
              <div className="space-y-2">
                {chaves.map((chave) => (
                  <button
                    key={chave.id}
                    onClick={() => setSelected(chave.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selected === chave.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-semibold text-sm">{chave.nome}</p>
                          <p className="text-xs text-muted-foreground">{chave.banco}</p>
                        </div>
                      </div>
                      {selected === chave.id && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <p className="text-xs font-mono text-muted-foreground mt-1 truncate">
                      {chave.chave_pix}
                    </p>
                  </button>
                ))}
              </div>

              {/* QR Code da chave selecionada */}
              {selectedChave && (
                <PixQRCode
                  chavePix={selectedChave.chave_pix}
                  valor={valor}
                  beneficiario={beneficiario}
                />
              )}
            </>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!selectedChave}
              onClick={handleConfirm}
            >
              Confirmar PIX
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
