/**
 * Painel lateral "Dados do contato" — estilo WhatsApp Web.
 * Abre ao clicar no avatar/nome no header do chat.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Search, BellOff, Bell, UserCog, UserPlus, Trash2, ExternalLink, RefreshCw, X, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const LS_MUTE_PREFIX = "wa_muted_";

interface MediaItem {
  id: string;
  url: string;
  type?: string;
  created_at: string;
}

interface PedidoRow {
  id: string;
  status: string | null;
  valor_total: number | null;
  created_at: string;
}

interface ContactDetailsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversaId: string | null;
  unidadeId?: string | null;
  contactName: string;
  phone: string | null;
  photoUrl: string | null;
  profileSyncStatus: "idle" | "syncing" | "offline";
  cliente: { id: string; nome: string } | null;
  onEditCliente: () => void;
  onLinkCliente: () => void;
  onDeleteConversa: () => void;
  onRefreshPhoto: () => void;
}

function formatPhone(raw: string | null) {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length >= 12) {
    return `+${d.slice(0, d.length - 10)} ${d.slice(-10, -8)} ${d.slice(-8, -4)}-${d.slice(-4)}`;
  }
  return raw;
}

export function ContactDetailsPanel({
  open, onOpenChange, conversaId, unidadeId, contactName, phone, photoUrl,
  profileSyncStatus, cliente, onEditCliente, onLinkCliente, onDeleteConversa, onRefreshPhoto,
}: ContactDetailsPanelProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [muted, setMuted] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [clienteEndereco, setClienteEndereco] = useState<string>("");
  const [avatarErr, setAvatarErr] = useState(false);

  useEffect(() => {
    setAvatarErr(false);
  }, [photoUrl]);

  useEffect(() => {
    if (!conversaId) return;
    setMuted(localStorage.getItem(LS_MUTE_PREFIX + conversaId) === "1");
  }, [conversaId]);

  // Carrega pedidos + endereço quando vinculado
  useEffect(() => {
    if (!open || !cliente?.id) { setPedidos([]); setClienteEndereco(""); return; }
    let cancelled = false;
    (async () => {
      const [{ data: peds }, { data: cli }] = await Promise.all([
        supabase
          .from("pedidos")
          .select("id, status, valor_total, created_at")
          .eq("cliente_id", cliente.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("clientes")
          .select("endereco, numero, bairro, cidade")
          .eq("id", cliente.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setPedidos((peds as PedidoRow[]) || []);
      if (cli) {
        const parts = [cli.endereco, cli.numero, cli.bairro, cli.cidade].filter(Boolean);
        setClienteEndereco(parts.join(", "));
      } else {
        setClienteEndereco("");
      }
    })();
    return () => { cancelled = true; };
  }, [open, cliente?.id]);

  // Carrega mídias da conversa
  useEffect(() => {
    if (!open || !conversaId) { setMedia([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ai_mensagens")
        .select("id, created_at, metadata")
        .eq("conversa_id", conversaId)
        .not("metadata", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      const items: MediaItem[] = [];
      for (const m of data || []) {
        const meta: any = m.metadata;
        if (meta?.media_url) {
          items.push({ id: m.id, url: meta.media_url, type: meta.media_type || meta.mime_type, created_at: m.created_at });
        }
      }
      setMedia(items);
    })();
    return () => { cancelled = true; };
  }, [open, conversaId]);

  const imageMedia = useMemo(
    () => media.filter((m) => (m.type || "").toString().startsWith("image")).slice(0, 4),
    [media]
  );

  const toggleMute = () => {
    if (!conversaId) return;
    const next = !muted;
    setMuted(next);
    if (next) localStorage.setItem(LS_MUTE_PREFIX + conversaId, "1");
    else localStorage.removeItem(LS_MUTE_PREFIX + conversaId);
    toast({ title: next ? "Notificações silenciadas" : "Notificações ativadas" });
  };

  const initials = (contactName || "??").slice(0, 2).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="p-0 w-full sm:max-w-[400px] bg-[#f0f2f5] flex flex-col gap-0 [&>button]:hidden"
      >
        {/* Header */}
        <div className="h-[108px] bg-[#00a884] text-white flex items-end px-4 pb-3 gap-4 flex-shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-full hover:bg-white/10 -mb-1"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-lg font-medium pb-0.5">Dados do contato</span>
        </div>

        {/* Scroll */}
        <div className="flex-1 overflow-y-auto">
          {/* Avatar grande */}
          <div className="bg-white px-6 py-8 flex flex-col items-center text-center">
            {photoUrl && !avatarErr ? (
              <img
                src={photoUrl}
                alt={contactName}
                onError={() => setAvatarErr(true)}
                className="w-44 h-44 rounded-full object-cover bg-[#dfe5e7]"
              />
            ) : (
              <div className="w-44 h-44 rounded-full bg-[#dfe5e7] flex items-center justify-center">
                <span className="text-[#8696a0] text-5xl font-medium">{initials}</span>
              </div>
            )}
            <h2 className="mt-4 text-[#111b21] text-2xl font-normal">{contactName}</h2>
            <p className="text-[#667781] text-base mt-1">{formatPhone(phone)}</p>
            <p className={cn(
              "text-xs mt-1",
              profileSyncStatus === "offline" ? "text-[#b54708]" : "text-[#667781]"
            )}>
              {profileSyncStatus === "syncing" && "atualizando foto…"}
              {profileSyncStatus === "offline" && "sem conexão com WhatsApp"}
              {profileSyncStatus === "idle" && "disponível"}
            </p>

            {/* Ações rápidas */}
            <div className="flex gap-2 mt-6 w-full">
              <button
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-[#f5f6f6] text-[#008069]"
                onClick={() => toast({ title: "Em breve", description: "Busca dentro da conversa" })}
              >
                <Search className="h-5 w-5" />
                <span className="text-xs">Buscar</span>
              </button>
              <button
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-[#f5f6f6] text-[#008069]"
                onClick={toggleMute}
              >
                {muted ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                <span className="text-xs">{muted ? "Ativar" : "Silenciar"}</span>
              </button>
              <button
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-[#f5f6f6] text-[#008069]"
                onClick={() => {
                  onOpenChange(false);
                  if (cliente) onEditCliente();
                  else onLinkCliente();
                }}
              >
                {cliente ? <UserCog className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                <span className="text-xs">{cliente ? "Editar" : "Vincular"}</span>
              </button>
            </div>
          </div>

          {/* Cadastro */}
          <Section title="Cadastro">
            {cliente ? (
              <div className="px-4 py-3 space-y-2">
                <p className="text-[#111b21] text-sm font-medium">{cliente.nome}</p>
                {clienteEndereco && (
                  <p className="text-[#667781] text-xs">{clienteEndereco}</p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#008069] hover:text-[#006b58] hover:bg-[#f5f6f6] px-0 h-8"
                  onClick={() => navigate(`/clientes?focus=${cliente.id}`)}
                >
                  Ver no cadastro <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="px-4 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { onOpenChange(false); onLinkCliente(); }}
                  className="w-full"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Vincular ao cadastro
                </Button>
              </div>
            )}
          </Section>

          {/* Pedidos recentes */}
          {cliente && (
            <Section title="Pedidos recentes">
              {pedidos.length === 0 ? (
                <p className="px-4 py-3 text-xs text-[#667781]">Nenhum pedido registrado.</p>
              ) : (
                <ul className="divide-y divide-[#e9edef]">
                  {pedidos.map((p) => (
                    <li key={p.id}>
                      <button
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#f5f6f6] text-left"
                        onClick={() => navigate(`/pedidos?id=${p.id}`)}
                      >
                        <div>
                          <p className="text-sm text-[#111b21]">
                            R$ {Number(p.valor_total || 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-[#667781]">
                            {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#e9edef] text-[#667781] uppercase">
                          {p.status || "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {/* Mídia */}
          <Section title={`Mídia, links e docs (${media.length})`}>
            {media.length === 0 ? (
              <p className="px-4 py-3 text-xs text-[#667781]">Sem mídia compartilhada.</p>
            ) : (
              <div className="px-4 py-3">
                <div className="grid grid-cols-4 gap-1">
                  {imageMedia.length > 0 ? (
                    imageMedia.map((m) => (
                      <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="aspect-square bg-[#e9edef] rounded overflow-hidden">
                        <img src={m.url} alt="" className="w-full h-full object-cover" />
                      </a>
                    ))
                  ) : (
                    <div className="col-span-4 flex items-center gap-2 text-xs text-[#667781]">
                      <FileText className="h-4 w-4" /> {media.length} arquivo(s) trocado(s)
                    </div>
                  )}
                </div>
              </div>
            )}
          </Section>

          {/* Ações */}
          <Section title="Ações">
            <div className="px-4 py-3 space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-[#111b21] hover:bg-[#f5f6f6]"
                onClick={onRefreshPhoto}
                disabled={profileSyncStatus === "syncing"}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", profileSyncStatus === "syncing" && "animate-spin")} />
                Atualizar foto do perfil
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => { onOpenChange(false); onDeleteConversa(); }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Apagar conversa
              </Button>
            </div>
          </Section>

          <div className="h-4" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white mt-2">
      <div className="px-4 pt-3 pb-1 text-xs font-medium text-[#008069]">{title}</div>
      {children}
    </div>
  );
}
