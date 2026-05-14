/**
 * Dialog "Nova conversa" — estilo WhatsApp Web
 * - Busca clientes existentes (autocomplete)
 * - Permite digitar um número novo
 * - Cria/recupera a conversa em ai_conversas e retorna o id
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Phone, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClienteRow {
  id: string;
  nome: string;
  telefone: string | null;
  endereco?: string | null;
  bairro?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (conversaId: string) => void;
}

// Stable namespace UUID from existing webhook logic: `whatsapp_<digits>` → uuid v5-ish via SHA-1
async function generateUUIDFromString(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(hash)).slice(0, 16);
  // Force version 4 / variant bits so it's a valid uuid
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 || d.length === 11) d = "55" + d; // adiciona DDI Brasil
  return d;
}

export function NovaConversaDialog({ open, onOpenChange, onCreated }: Props) {
  const { empresa } = useEmpresa();
  const { toast } = useToast();
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ClienteRow[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [novoTel, setNovoTel] = useState("");

  useEffect(() => {
    if (!open) {
      setTermo("");
      setNovoTel("");
      setResultados([]);
    }
  }, [open]);

  // Busca clientes (debounced)
  useEffect(() => {
    if (!open || !empresa?.id) return;
    const t = termo.trim();
    if (t.length < 2) {
      setResultados([]);
      return;
    }
    const handle = setTimeout(async () => {
      setBuscando(true);
      const { data, error } = await supabase.rpc("autocomplete_clientes_v2", {
        _empresa_id: empresa.id,
        _termo: t,
        _limite: 15,
      });
      if (!error) setResultados((data || []) as ClienteRow[]);
      setBuscando(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [termo, open, empresa?.id]);

  const telDigitado = useMemo(() => normalizePhone(novoTel), [novoTel]);
  const podeCriarNovo = telDigitado.length >= 12;

  const abrirConversa = async (telefone: string, titulo: string) => {
    const phone = normalizePhone(telefone);
    if (!phone) {
      toast({ title: "Telefone inválido", variant: "destructive" });
      return;
    }
    if (!empresa?.id) {
      toast({ title: "Empresa não identificada", variant: "destructive" });
      return;
    }
    setCriando(true);
    try {
      const conversaId = await generateUUIDFromString(`whatsapp_${phone}`);

      // upsert (empresa_id obrigatório pela RLS de tenant)
      const { error } = await supabase
        .from("ai_conversas")
        .upsert(
          {
            id: conversaId,
            user_id: "00000000-0000-0000-0000-000000000000",
            titulo: titulo || phone,
            telefone: phone,
            empresa_id: empresa.id,
          },
          { onConflict: "id" }
        );
      if (error) throw error;

      onCreated(conversaId);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao criar conversa", description: e.message, variant: "destructive" });
    } finally {
      setCriando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 bg-[#00a884] text-white">
          <DialogTitle className="text-white text-base font-medium">
            Nova conversa
          </DialogTitle>
        </DialogHeader>

        {/* Busca de cliente */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar cliente por nome ou telefone..."
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              className="pl-9 text-base"
            />
          </div>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {buscando && (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
            </div>
          )}
          {!buscando && termo.length >= 2 && resultados.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          )}
          {!buscando &&
            resultados.map((c) => (
              <button
                key={c.id}
                disabled={!c.telefone || criando}
                onClick={() => abrirConversa(c.telefone || "", c.nome)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors border-b disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-[#dfe5e7] flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-[#8696a0]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{c.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.telefone || "sem telefone"}
                    {c.endereco ? ` · ${c.endereco}` : ""}
                  </p>
                </div>
              </button>
            ))}
        </div>

        {/* Novo número */}
        <div className="p-3 border-t bg-muted/30 space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> Ou enviar para um número novo
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Ex: 54 99969 2765"
              value={novoTel}
              onChange={(e) => setNovoTel(e.target.value)}
              className="text-base"
              inputMode="tel"
            />
            <Button
              disabled={!podeCriarNovo || criando}
              onClick={() => abrirConversa(telDigitado, telDigitado)}
              className="bg-[#00a884] hover:bg-[#008f72]"
            >
              {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">
            ⚠️ A Meta só permite enviar mensagem livre se o cliente tiver conversado nas
            últimas 24h. Fora desse prazo, é necessário um <b>template aprovado</b>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
