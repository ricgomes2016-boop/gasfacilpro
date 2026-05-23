/**
 * WhatsApp Inbox - Visual idêntico ao WhatsApp Web real
 * 
 * Design:
 * - Sidebar esquerda com lista de conversas (fundo #f0f2f5)
 * - Header verde com avatar e info do contato
 * - Bolhas de mensagem: verde claro (enviadas) e brancas (recebidas)
 * - Background com padrão doodle do WhatsApp
 * - Barra de input com ícones
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, Search, MessageSquare, ArrowLeft, Bot, Headset, User, Smile, Paperclip, Mic, SquarePen, X, Trash2, FileText, Download, MoreVertical, UserPlus, UserCog, CheckCircle2, AlertCircle, Zap, Users, Archive, ShoppingCart, History, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppNotifications } from "@/contexts/WhatsAppNotificationContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { NovaConversaDialog } from "./NovaConversaDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import type { ClienteForm } from "@/hooks/useClientes";
import { ContactDetailsPanel } from "./ContactDetailsPanel";

interface Conversa {
  id: string;
  titulo: string;
  updated_at: string;
  telefone: string | null;
  foto_url?: string | null;
  foto_atualizada_em?: string | null;
  unidade_id?: string | null;
  last_message?: string | null;
  last_role?: string | null;
  last_message_at?: string | null;
}

interface MensagemMetadata {
  media_url?: string;
  media_type?: "image" | "audio" | "video" | "document";
  mime_type?: string;
  filename?: string;
  [k: string]: any;
}

interface Mensagem {
  id: string;
  role: string;
  content: string;
  created_at: string;
  conversa_id: string;
  metadata?: MensagemMetadata | null;
  status?: "pending" | "sent" | "delivered" | "read" | "failed" | null;
  error_message?: string | null;
}

interface WhatsAppInboxProps {
  className?: string;
}

// Avatar with safe fallback to initials
function ChatAvatar({ url, name, size = "md" }: { url?: string | null; name: string; size?: "sm" | "md" }) {
  const [errored, setErrored] = useState(false);
  const sizeClass = size === "sm" ? "w-10 h-10 text-sm" : "w-12 h-12 text-sm";
  if (url && !errored) {
    return (
      <img
        src={url}
        alt={name}
        onError={() => setErrored(true)}
        className={cn(sizeClass, "rounded-full object-cover bg-[#dfe5e7] flex-shrink-0")}
      />
    );
  }
  return (
    <div className={cn(sizeClass, "rounded-full bg-[#dfe5e7] flex items-center justify-center flex-shrink-0")}>
      <span className="text-[#8696a0] font-medium">{(name || "??").slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

export function WhatsAppInbox({ className }: WhatsAppInboxProps) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "bia" | "human">("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  const [storeAvatar, setStoreAvatar] = useState<string | null>(null);
  const [unitIntegration, setUnitIntegration] = useState<{ numero: string | null; provedor: string | null; ativo: boolean } | null>(null);
  const [profileSyncStatus, setProfileSyncStatus] = useState<"idle" | "syncing" | "offline">("idle");
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { unreadByConversation, setSelectedConversaId, markAsRead } = useWhatsAppNotifications();
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();

  // Ações por conversa
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<Array<{ id: string; nome: string; telefone: string | null }>>([]);
  const [editClienteOpen, setEditClienteOpen] = useState(false);
  const [editClienteData, setEditClienteData] = useState<{ id: string; form: ClienteForm } | null>(null);
  const [clienteByConv, setClienteByConv] = useState<Record<string, { id: string; nome: string } | null>>({});
  const [contactPanelOpen, setContactPanelOpen] = useState(false);

  // Sync selection with global context
  useEffect(() => {
    setSelectedConversaId(selectedId);
    if (selectedId) markAsRead(selectedId);
  }, [selectedId, setSelectedConversaId, markAsRead]);

  useEffect(() => () => { setSelectedConversaId(null); }, [setSelectedConversaId]);

  // Carrega foto da loja (e dispara refresh em background)
  useEffect(() => {
    if (!unidadeAtual?.id) { setStoreAvatar(null); setUnitIntegration(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("integracoes_whatsapp")
        .select("loja_foto_url, numero_telefone, provedor, provedor_tipo, ativo, status_conexao")
        .eq("unidade_id", unidadeAtual.id)
        .eq("ativo", true)
        .order("loja_foto_atualizada_em", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setStoreAvatar(data?.loja_foto_url || null);
      setUnitIntegration(
        data
          ? {
              numero: data.numero_telefone || null,
              provedor: data.provedor || data.provedor_tipo || null,
              ativo: data.ativo ?? false,
            }
          : null
      );

      // Atualiza em background (não bloqueia UI)
      supabase.functions.invoke("whatsapp-refresh-profile", {
        body: { unidade_id: unidadeAtual.id },
      }).then(({ data: r }: any) => {
        if (!cancelled && r?.loja_foto_url) setStoreAvatar(r.loja_foto_url);
      }).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [unidadeAtual?.id]);

  useEffect(() => {
    const fetchConversas = async () => {
      let query = supabase
        .from("ai_conversas")
        .select("id, titulo, updated_at, telefone, foto_url, foto_atualizada_em, unidade_id, empresa_id")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(200);

      // Escopa por empresa do usuário (quando disponível)
      if (empresa?.id) {
        query = query.eq("empresa_id", empresa.id);
      }

      // Se há unidade selecionada, mostra conversas dessa unidade OU sem unidade (legado)
      if (unidadeAtual?.id) {
        query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      }

      const { data } = await query;

      const convs = (data || []) as Conversa[];

      if (convs.length) {
        const ids = convs.map((c) => c.id);
        const { data: msgs } = await supabase
          .from("ai_mensagens")
          .select("conversa_id, role, content, created_at")
          .in("conversa_id", ids)
          .order("created_at", { ascending: false })
          .limit(500);
        const lastByConv = new Map<string, { role: string; content: string }>();
        (msgs || []).forEach((m: any) => {
          if (!lastByConv.has(m.conversa_id)) {
            lastByConv.set(m.conversa_id, { role: m.role, content: m.content });
          }
        });
        convs.forEach((c) => {
          const last = lastByConv.get(c.id);
          c.last_message = last?.content || null;
          c.last_role = last?.role || null;
        });
      }

      setConversas(convs);
      setLoading(false);
    };
    setLoading(true);
    fetchConversas();

    const channel = supabase
      .channel("inbox-conversas-shared")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_conversas" }, () => {
        fetchConversas();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ai_mensagens" }, () => {
        fetchConversas();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [unidadeAtual?.id, empresa?.id]);

  // Background fetch profile photos for conversations missing foto_url (queued, throttled)
  useEffect(() => {
    if (!conversas.length) return;
    const STALE_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const pending = conversas.filter((c) => {
      if (!c.foto_url) return true;
      if (!c.foto_atualizada_em) return false;
      return now - new Date(c.foto_atualizada_em).getTime() > STALE_MS;
    }).slice(0, 60);
    if (!pending.length) return;
    let cancelled = false;
    (async () => {
      for (const c of pending) {
        if (cancelled) return;
        const uid = c.unidade_id || unidadeAtual?.id;
        if (!uid) continue;
        try {
          const { data: r }: any = await supabase.functions.invoke("whatsapp-refresh-profile", {
            body: { unidade_id: uid, conversa_id: c.id },
          });
          if (!cancelled && r?.contato_foto_url) {
            setConversas((prev) => prev.map((x) => x.id === c.id ? { ...x, foto_url: r.contato_foto_url } : x));
          }
        } catch { /* ignore */ }
        await new Promise((res) => setTimeout(res, 350));
      }
    })();
    return () => { cancelled = true; };
    // Only react to changes in the set of conversation ids — não reexecutar quando outras props mudam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversas.map((c) => c.id).join(","), unidadeAtual?.id]);

  useEffect(() => {
    if (!selectedId) { setMensagens([]); return; }

    const fetchMensagens = async () => {
      const { data } = await supabase
        .from("ai_mensagens")
        .select("id, role, content, created_at, conversa_id, metadata, status, error_message")
        .eq("conversa_id", selectedId)
        .order("created_at", { ascending: true });
      setMensagens((data || []) as Mensagem[]);
    };
    fetchMensagens();

    // Atualiza foto do contato em background
    const conv = conversas.find((c) => c.id === selectedId);
    const uid = conv?.unidade_id || unidadeAtual?.id;
    if (uid) {
      setProfileSyncStatus("syncing");
      supabase.functions.invoke("whatsapp-refresh-profile", {
        body: { unidade_id: uid, conversa_id: selectedId },
      }).then(({ data: r, error }: any) => {
        if (error || r?.ok === false) {
          setProfileSyncStatus("offline");
          return;
        }
        setProfileSyncStatus("idle");
        if (r?.contato_foto_url) {
          setConversas((prev) => prev.map((x) =>
            x.id === selectedId ? { ...x, foto_url: r.contato_foto_url } : x
          ));
        }
      }).catch(() => setProfileSyncStatus("offline"));
    } else {
      setProfileSyncStatus("idle");
    }

    const channel = supabase
      .channel(`inbox-msgs-shared-${selectedId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "ai_mensagens",
        filter: `conversa_id=eq.${selectedId}`,
      }, (payload) => {
        setMensagens((prev) => [...prev, payload.new as Mensagem]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const handleSend = async () => {
    if (!newMsg.trim() || !selectedId) return;
    setSending(true);
    try {
      const conv = conversas.find((c) => c.id === selectedId);
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { conversa_id: selectedId, content: newMsg.trim(), unidade_id: conv?.unidade_id || null },
      });
      if (error) {
        toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      } else if (data?.error) {
        toast({ title: "Erro WhatsApp", description: data.error, variant: "destructive" });
      } else {
        setNewMsg("");
      }
    } catch (err: any) {
      toast({ title: "Erro de conexão", description: err.message || "Falha ao enviar", variant: "destructive" });
    }
    setSending(false);
  };

  // ===== UPLOAD DE ARQUIVO =====
  const detectMediaType = (file: File): "image" | "audio" | "video" | "document" => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("audio/")) return "audio";
    if (file.type.startsWith("video/")) return "video";
    return "document";
  };

  const uploadAndSendBlob = async (blob: Blob, filename: string, mediaType: "image" | "audio" | "video" | "document", mimeType: string) => {
    if (!selectedId) return;
    const conv = conversas.find((c) => c.id === selectedId);
    if (!conv) return;

    // empresa_id via profile
    const { data: profile } = await supabase.from("profiles")
      .select("empresa_id").eq("user_id", (await supabase.auth.getUser()).data.user?.id || "").maybeSingle();
    const empresaId = profile?.empresa_id;
    if (!empresaId) {
      toast({ title: "Sem empresa", description: "Não foi possível identificar a empresa do usuário", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const path = `${empresaId}/${selectedId}/${Date.now()}-${filename.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("chat-anexos").upload(path, blob, { contentType: mimeType, upsert: false });
      if (upErr) throw upErr;

      const { data: signed } = await supabase.storage.from("chat-anexos").createSignedUrl(path, 60 * 60 * 24 * 7);
      const mediaUrl = signed?.signedUrl;
      if (!mediaUrl) throw new Error("Falha ao gerar URL do arquivo");

      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          conversa_id: selectedId,
          unidade_id: conv.unidade_id || null,
          media_url: mediaUrl,
          media_type: mediaType,
          mime_type: mimeType,
          filename,
          content: newMsg.trim() || undefined,
        },
      });
      if (error || data?.error) {
        toast({ title: "Erro ao enviar", description: error?.message || data?.error, variant: "destructive" });
      } else {
        setNewMsg("");
      }
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message || "Falha ao enviar arquivo", variant: "destructive" });
    }
    setSending(false);
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 16 MB", variant: "destructive" });
      return;
    }
    await uploadAndSendBlob(file, file.name, detectMediaType(file), file.type || "application/octet-stream");
  };

  // ===== GRAVAÇÃO DE ÁUDIO =====
  const startRecording = async () => {
    if (!selectedId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) recordedChunksRef.current.push(ev.data); };
      recorder.onstop = () => { stream.getTracks().forEach((t) => t.stop()); };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = window.setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (e: any) {
      toast({ title: "Sem microfone", description: e.message || "Permita acesso ao microfone", variant: "destructive" });
    }
  };

  const stopRecording = (send: boolean) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      if (send && recordedChunksRef.current.length) {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        await uploadAndSendBlob(blob, `audio-${Date.now()}.webm`, "audio", "audio/webm");
      }
      recordedChunksRef.current = [];
    };
    recorder.stop();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Look up linked client by phone whenever a conversation is opened
  useEffect(() => {
    if (!selectedId) return;
    const conv = conversas.find((c) => c.id === selectedId);
    if (!conv?.telefone || !empresa?.id) {
      setClienteByConv((prev) => ({ ...prev, [selectedId]: null }));
      return;
    }
    if (clienteByConv[selectedId] !== undefined) return;
    const digits = (conv.telefone || "").replace(/\D/g, "");
    (async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .eq("empresa_id", empresa.id)
        .ilike("telefone", `%${digits.slice(-9)}%`)
        .limit(5);
      const match = (data || []).find((c) => (c.telefone || "").replace(/\D/g, "").endsWith(digits.slice(-9))) || null;
      setClienteByConv((prev) => ({ ...prev, [selectedId]: match ? { id: match.id, nome: match.nome } : null }));
    })();
  }, [selectedId, conversas, empresa?.id, clienteByConv]);

  // ===== Ações por conversa =====
  const handleDeleteConversa = async (conversaId: string) => {
    const userId = (await supabase.auth.getUser()).data.user?.id || null;
    const { error } = await supabase
      .from("ai_conversas")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId } as any)
      .eq("id", conversaId);
    if (error) {
      toast({ title: "Erro ao apagar", description: error.message, variant: "destructive" });
      return;
    }
    setConversas((prev) => prev.filter((c) => c.id !== conversaId));
    if (selectedId === conversaId) setSelectedId(null);
    setConfirmDeleteId(null);
    toast({ title: "Conversa apagada" });
  };

  const handleOpenLinkDialog = async () => {
    setLinkSearch("");
    setLinkResults([]);
    setLinkDialogOpen(true);
    if (empresa?.id) {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .eq("empresa_id", empresa.id)
        .eq("ativo", true)
        .order("nome")
        .limit(200);
      setLinkResults((data || []) as any);
    }
  };

  const searchLink = async (term: string) => {
    setLinkSearch(term);
    if (!empresa?.id) return;
    const t = term.trim();
    const digits = t.replace(/\D/g, "");
    const last8 = digits.slice(-8);
    const last9 = digits.slice(-9);

    let q = supabase
      .from("clientes")
      .select("id, nome, telefone")
      .eq("empresa_id", empresa.id)
      .eq("ativo", true)
      .limit(100);

    if (t) {
      if (digits.length >= 3) {
        // Busca por nome OU telefone (com dígitos completos, últimos 8 e últimos 9)
        const filters = [
          `nome.ilike.%${t}%`,
          `telefone.ilike.%${digits}%`,
        ];
        if (last8.length >= 8) filters.push(`telefone.ilike.%${last8}%`);
        if (last9.length >= 9) filters.push(`telefone.ilike.%${last9}%`);
        q = q.or(filters.join(","));
      } else {
        q = q.ilike("nome", `%${t}%`);
      }
    } else {
      q = q.order("nome");
    }

    const { data } = await q;
    setLinkResults((data || []) as any);
  };

  const linkClienteToConversa = async (clienteId: string, clienteNome: string) => {
    if (!selectedId) return;
    const conv = conversas.find((c) => c.id === selectedId);
    const phone = conv?.telefone;
    if (!phone) return;
    const { error } = await supabase.from("clientes").update({ telefone: phone }).eq("id", clienteId);
    if (error) {
      toast({ title: "Erro ao vincular", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("ai_conversas").update({ titulo: clienteNome }).eq("id", selectedId);
    setConversas((prev) => prev.map((c) => c.id === selectedId ? { ...c, titulo: clienteNome } : c));
    setClienteByConv((prev) => ({ ...prev, [selectedId]: { id: clienteId, nome: clienteNome } }));
    setLinkDialogOpen(false);
    toast({ title: "Cliente vinculado", description: clienteNome });
  };

  const openEditCliente = async () => {
    if (!selectedId) return;
    const link = clienteByConv[selectedId];
    if (!link) return;
    const { data } = await supabase.from("clientes").select("*").eq("id", link.id).maybeSingle();
    if (!data) {
      toast({ title: "Cliente não encontrado", variant: "destructive" });
      return;
    }
    setEditClienteData({
      id: link.id,
      form: {
        nome: data.nome || "",
        telefone: data.telefone || "",
        email: data.email || "",
        cpf: data.cpf || "",
        endereco: data.endereco || "",
        numero: data.numero || "",
        bairro: data.bairro || "",
        cidade: data.cidade || "",
        cep: data.cep || "",
        tipo: data.tipo || "residencial",
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
    setEditClienteOpen(true);
  };

  const saveClienteInline = async (form: ClienteForm, editId?: string): Promise<boolean> => {
    if (!editId) return false;
    const { error } = await supabase.from("clientes").update({
      nome: form.nome,
      telefone: form.telefone || null,
      email: form.email || null,
      cpf: form.cpf || null,
      endereco: form.endereco || null,
      numero: form.numero || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      cep: form.cep || null,
      tipo: form.tipo,
      latitude: form.latitude,
      longitude: form.longitude,
    }).eq("id", editId);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Cliente atualizado" });
    if (selectedId) setClienteByConv((prev) => ({ ...prev, [selectedId]: { id: editId, nome: form.nome } }));
    return true;
  };

  const filtered = conversas
    .filter((c) => c.titulo.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "unread") return (unreadByConversation[c.id] || 0) > 0;
      if (activeFilter === "bia") return c.last_role === "assistant";
      if (activeFilter === "human") return c.last_role === "human" || c.last_role === "user";
      return true;
    })
    .sort((a, b) => {
      const ua = unreadByConversation[a.id] || 0;
      const ub = unreadByConversation[b.id] || 0;
      if (ua !== ub) return ub - ua;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  // Métricas calculadas a partir dos dados já carregados
  const totalConversas = conversas.length;
  const totalNaoLidas = conversas.reduce((acc, c) => acc + (unreadByConversation[c.id] || 0), 0);
  const totalBia = conversas.filter((c) => c.last_role === "assistant").length;
  const totalHumano = conversas.filter((c) => c.last_role === "human").length;

  const selectedConversa = conversas.find((c) => c.id === selectedId);
  const isOutgoing = (role: string) => role === "assistant" || role === "human";

  // Provedor formatado para badge
  const provedorLabel = (() => {
    if (!unitIntegration?.provedor) return null;
    const p = unitIntegration.provedor.toLowerCase();
    if (p === "meta") return "Meta Oficial";
    if (p === "zapi") return "Z-API";
    return unitIntegration.provedor.toUpperCase();
  })();

  // Quick replies (apenas inserem texto, não enviam)
  const quickReplies = [
    { label: "💰 Preço do gás", text: "Olá! O valor do nosso botijão é R$ XX,XX com entrega rápida. Posso confirmar seu pedido?" },
    { label: "✅ Confirmar pedido", text: "Pedido confirmado! Em breve nosso entregador estará a caminho. 🚚" },
    { label: "🛵 Saiu para entrega", text: "Seu pedido já saiu para entrega! O entregador chegará em alguns minutos. 📍" },
    { label: "💳 Forma de pagamento", text: "Aceitamos dinheiro, PIX, débito e crédito na entrega. Qual prefere?" },
    { label: "👋 Encerrar", text: "Agradecemos o contato! Qualquer coisa estamos à disposição. 🙏" },
  ];
  const insertQuickReply = (text: string) => {
    setNewMsg((prev) => prev ? `${prev} ${text}` : text);
  };

  // Get last message for preview
  const getLastMessage = (conversaId: string) => {
    // We don't have this data readily available, so show time only
    return null;
  };

  return (
    <div className={cn("flex overflow-hidden", className)} style={{ backgroundColor: '#eae6df' }}>
      {/* Left Sidebar - Conversation List */}
      <aside
        className={cn(
          "flex flex-col bg-white border-r border-[#e9edef]",
          "w-full md:w-[340px] lg:w-[380px] flex-shrink-0",
          selectedId && "hidden md:flex"
        )}
      >
        {/* Sidebar Header */}
        <div className="bg-gradient-to-br from-[#f8faf9] to-[#f0f2f5] px-4 pt-3 pb-3 flex flex-col gap-3 border-b border-[#e9edef]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ChatAvatar url={storeAvatar} name={unidadeAtual?.nome || "Loja"} size="sm" />
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                  unitIntegration?.ativo ? "bg-[#25d366]" : "bg-[#b54708]"
                )}
                title={unitIntegration?.ativo ? "Conectado" : "Desconectado"}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[#111b21] truncate leading-tight">
                {unidadeAtual?.nome || "Selecione uma unidade"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {unitIntegration?.numero ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-[#25d366]/15 text-[#017561] border border-[#25d366]/25">
                      <CheckCircle2 className="h-3 w-3" />
                      Conectado
                    </span>
                    {provedorLabel && (
                      <span className="inline-flex items-center text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-[#6b3fa0]/10 text-[#6b3fa0] border border-[#6b3fa0]/20">
                        {provedorLabel}
                      </span>
                    )}
                    <span className="text-[11px] text-[#667781] truncate">{unitIntegration.numero}</span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md bg-[#fef0c7] text-[#b54708] border border-[#fdb022]/40">
                    <AlertCircle className="h-3 w-3" />
                    WhatsApp não conectado
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setNovaOpen(true)}
              title="Nova conversa"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00a884] text-white text-[12.5px] font-semibold shadow-sm shadow-[#00a884]/30 hover:bg-[#008f72] hover:shadow-md transition-all active:scale-95"
            >
              <SquarePen className="h-4 w-4" />
              <span className="hidden sm:inline">Nova</span>
            </button>
          </div>

          {/* Quick metrics - hidden on small mobile to save vertical space */}
          <div className="hidden sm:grid grid-cols-4 gap-1.5">
            <div className="flex flex-col items-center bg-white/70 rounded-lg py-1.5 px-1 border border-[#e9edef]">
              <span className="text-[13px] font-bold text-[#111b21] leading-none">{totalConversas}</span>
              <span className="text-[9.5px] text-[#667781] mt-0.5 uppercase tracking-wide">Total</span>
            </div>
            <div className="flex flex-col items-center bg-white/70 rounded-lg py-1.5 px-1 border border-[#25d366]/30">
              <span className="text-[13px] font-bold text-[#017561] leading-none">{totalNaoLidas}</span>
              <span className="text-[9.5px] text-[#017561] mt-0.5 uppercase tracking-wide">Não lidas</span>
            </div>
            <div className="flex flex-col items-center bg-white/70 rounded-lg py-1.5 px-1 border border-[#6b3fa0]/25">
              <span className="text-[13px] font-bold text-[#6b3fa0] leading-none">{totalBia}</span>
              <span className="text-[9.5px] text-[#6b3fa0] mt-0.5 uppercase tracking-wide">BIA</span>
            </div>
            <div className="flex flex-col items-center bg-white/70 rounded-lg py-1.5 px-1 border border-[#e9edef]">
              <span className="text-[13px] font-bold text-[#111b21] leading-none">{totalHumano}</span>
              <span className="text-[9.5px] text-[#667781] mt-0.5 uppercase tracking-wide">Humano</span>
            </div>
          </div>

          {/* Mobile-only compact summary chips */}
          <div className="flex sm:hidden items-center gap-1.5 text-[10.5px] font-semibold">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 border border-[#e9edef] text-[#54656f]">
              <span className="tabular-nums">{totalConversas}</span> conv.
            </span>
            {totalNaoLidas > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#25d366]/15 border border-[#25d366]/30 text-[#017561]">
                <span className="tabular-nums">{totalNaoLidas}</span> não lidas
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#6b3fa0]/10 border border-[#6b3fa0]/25 text-[#6b3fa0]">
              BIA <span className="tabular-nums">{totalBia}</span>
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-3 py-2 bg-white border-b border-[#e9edef] flex flex-col gap-2">
          <div className="relative flex items-center bg-[#f0f2f5] rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#00a884]/30 transition-all">
            <Search className="h-4 w-4 text-[#54656f] mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Pesquisar conversa, nome ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-[#3b4a54] placeholder-[#667781] outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-[#667781] hover:text-[#111b21]">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {([
              { id: "all", label: "Todas", icon: null },
              { id: "unread", label: "Não lidas", icon: null },
              { id: "bia", label: "BIA", icon: Bot },
              { id: "human", label: "Humano", icon: Headset },
            ] as const).map((f) => {
              const active = activeFilter === f.id;
              const Ic = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={cn(
                    "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11.5px] font-semibold whitespace-nowrap transition-all border",
                    active
                      ? "bg-[#00a884] text-white border-[#00a884] shadow-sm"
                      : "bg-white text-[#54656f] border-[#e9edef] hover:bg-[#f5f6f6]"
                  )}
                >
                  {Ic && <Ic className="h-3 w-3" />}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>


        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-pulse text-sm text-[#667781]">Carregando...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[#667781] gap-2">
              <MessageSquare className="h-8 w-8 opacity-30" />
              <span className="text-sm">Nenhuma conversa</span>
            </div>
          ) : (
            filtered.map((c) => {
              const unread = unreadByConversation[c.id] || 0;
              const isSelected = selectedId === c.id;
              const linked = clienteByConv[c.id];
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group relative w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all cursor-pointer border-l-[3px]",
                    isSelected
                      ? "bg-[#e7f5f0] border-l-[#00a884]"
                      : "border-l-transparent hover:bg-[#f5f6f6]"
                  )}
                  onClick={() => setSelectedId(c.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(c.id); } }}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <ChatAvatar url={c.foto_url} name={c.titulo} size="md" />
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#25d366] border-2 border-white" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn(
                        "text-[#111b21] text-[14.5px] truncate",
                        unread > 0 ? "font-semibold" : "font-medium"
                      )}>
                        {c.titulo}
                      </p>
                      <span className={cn(
                        "text-[11px] flex-shrink-0 tabular-nums",
                        unread > 0 ? "text-[#00a884] font-semibold" : "text-[#667781]"
                      )}>
                        {format(new Date(c.updated_at), "HH:mm")}
                      </span>
                    </div>

                    {c.telefone && (
                      <p className="text-[11px] text-[#8696a0] truncate leading-tight">{c.telefone}</p>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={cn(
                        "text-[13px] truncate flex-1",
                        unread > 0 ? "text-[#111b21] font-medium" : "text-[#667781]"
                      )}>
                        {c.last_role === "assistant" && <span className="text-[#6b3fa0] mr-1 font-semibold">BIA:</span>}
                        {c.last_role === "human" && <span className="text-[#00a884] mr-1 font-semibold">Você:</span>}
                        {c.last_message?.replace(/\[PEDIDO_CONFIRMADO\][\s\S]*?\[\/PEDIDO_CONFIRMADO\]/g, "").trim() || "Sem mensagens"}
                      </p>
                      {unread > 0 && (
                        <span className="bg-[#25d366] text-white text-[10.5px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 flex-shrink-0 shadow-sm">
                          {unread}
                        </span>
                      )}
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-1 mt-1">
                      {c.last_role === "assistant" && (
                        <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold px-1.5 py-px rounded bg-[#6b3fa0]/10 text-[#6b3fa0]">
                          <Bot className="h-2.5 w-2.5" />
                          BIA
                        </span>
                      )}
                      {c.last_role === "human" && (
                        <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold px-1.5 py-px rounded bg-[#00a884]/15 text-[#017561]">
                          <Headset className="h-2.5 w-2.5" />
                          Humano
                        </span>
                      )}
                      {linked && (
                        <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold px-1.5 py-px rounded bg-[#0288d1]/10 text-[#0277bd]">
                          <User className="h-2.5 w-2.5" />
                          Cliente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 p-1.5 rounded-full hover:bg-white transition self-start"
                        aria-label="Ações da conversa"
                      >
                        <MoreVertical className="h-4 w-4 text-[#54656f]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Arquivar conversa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Panel - Chat Area */}
      <div className={cn("flex-1 flex flex-col min-w-0", !selectedId && "hidden md:flex")}>
        {!selectedId ? (
          /* Empty State - Central de Atendimento */
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-[#f0f2f5] via-[#f5f7f6] to-[#e7f5f0] border-b-[6px] border-[#00a884] px-6">
            <div className="text-center space-y-5 max-w-2xl">
              <div className="mx-auto h-20 w-20 rounded-2xl bg-[#00a884]/15 flex items-center justify-center shadow-sm">
                <MessageSquare className="h-10 w-10 text-[#00a884]" />
              </div>
              <div className="space-y-2">
                <h2 className="text-[#111b21] text-2xl md:text-3xl font-semibold">Central de Atendimento WhatsApp</h2>
                <p className="text-[#54656f] text-sm md:text-base leading-relaxed max-w-md mx-auto">
                  Selecione uma conversa para atender, vender ou acompanhar pedidos.
                </p>
              </div>

              {/* Feature cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                {[
                  { icon: Bot, label: "Atendimento BIA", color: "text-[#6b3fa0]", bg: "bg-[#6b3fa0]/10" },
                  { icon: Headset, label: "Atendimento humano", color: "text-[#00a884]", bg: "bg-[#00a884]/10" },
                  { icon: ShoppingCart, label: "Pedidos pelo WhatsApp", color: "text-[#0288d1]", bg: "bg-[#0288d1]/10" },
                  { icon: History, label: "Histórico do cliente", color: "text-[#b54708]", bg: "bg-[#b54708]/10" },
                ].map((f) => (
                  <div key={f.label} className="bg-white rounded-xl p-3 border border-[#e9edef] shadow-sm hover:shadow-md transition-shadow">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mx-auto mb-2", f.bg)}>
                      <f.icon className={cn("h-4 w-4", f.color)} />
                    </div>
                    <p className="text-[11.5px] font-semibold text-[#111b21] leading-tight">{f.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="min-h-[64px] bg-gradient-to-r from-[#f0f2f5] to-[#f5f7f6] flex items-center px-3 md:px-4 gap-2 md:gap-3 border-b border-[#e9edef] flex-shrink-0 py-2">
              {/* Back button (mobile) */}
              <button
                className="md:hidden p-1.5 rounded-full hover:bg-white mr-0.5 flex-shrink-0"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft className="h-5 w-5 text-[#54656f]" />
              </button>

              {/* Contact Avatar + Info — clicável abre painel */}
              <button
                onClick={() => setContactPanelOpen(true)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left hover:bg-white/60 px-1.5 py-1 rounded-lg transition-colors"
              >
                <ChatAvatar url={selectedConversa?.foto_url} name={selectedConversa?.titulo || "??"} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-[#111b21] text-[15px] font-semibold truncate">
                      {selectedConversa?.titulo}
                    </p>
                    {selectedId && (clienteByConv[selectedId] ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-px rounded-full bg-[#0288d1]/15 text-[#0277bd] border border-[#0288d1]/25 flex-shrink-0">
                        <User className="h-2.5 w-2.5" />
                        Cliente vinculado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-px rounded-full bg-[#fef0c7] text-[#b54708] border border-[#fdb022]/40 flex-shrink-0">
                        <AlertCircle className="h-2.5 w-2.5" />
                        Não vinculado
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[11.5px] mt-0.5">
                    {selectedConversa?.telefone && (
                      <span className="text-[#54656f] font-medium tabular-nums">{selectedConversa.telefone}</span>
                    )}
                    <span className={cn(
                      "inline-flex items-center gap-1",
                      profileSyncStatus === "offline" ? "text-[#b54708]" : "text-[#667781]"
                    )}>
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        profileSyncStatus === "offline" ? "bg-[#b54708]" : profileSyncStatus === "syncing" ? "bg-[#fdb022] animate-pulse" : "bg-[#25d366]"
                      )} />
                      {profileSyncStatus === "syncing" && "atualizando…"}
                      {profileSyncStatus === "offline" && "sem conexão"}
                      {profileSyncStatus === "idle" && "online"}
                    </span>
                  </div>
                </div>
              </button>

              {/* Header Actions - Vincular/Editar atalho */}
              {selectedId && (clienteByConv[selectedId] ? (
                <button
                  onClick={openEditCliente}
                  title="Editar cliente"
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#e9edef] text-[12px] font-semibold text-[#54656f] hover:bg-[#f5f6f6] hover:border-[#0288d1]/40 hover:text-[#0277bd] transition-all"
                >
                  <UserCog className="h-3.5 w-3.5" />
                  Editar
                </button>
              ) : (
                <button
                  onClick={handleOpenLinkDialog}
                  title="Vincular cliente"
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#00a884] text-white text-[12px] font-semibold shadow-sm shadow-[#00a884]/25 hover:bg-[#008f72] transition-all"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Vincular
                </button>
              ))}

              <button
                onClick={() => setContactPanelOpen(true)}
                title="Ver detalhes"
                className="hidden sm:inline-flex p-2 rounded-full hover:bg-white transition-colors"
              >
                <User className="h-5 w-5 text-[#54656f]" />
              </button>
              <button className="hidden sm:inline-flex p-2 rounded-full hover:bg-white transition-colors" title="Buscar na conversa">
                <Search className="h-5 w-5 text-[#54656f]" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 rounded-full hover:bg-white transition-colors" aria-label="Mais opções">
                    <MoreVertical className="h-5 w-5 text-[#54656f]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {selectedId && clienteByConv[selectedId] ? (
                    <DropdownMenuItem onClick={openEditCliente}>
                      <UserCog className="h-4 w-4 mr-2" />
                      Editar cliente ({clienteByConv[selectedId]?.nome})
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={handleOpenLinkDialog}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Vincular ao cadastro
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => selectedId && setConfirmDeleteId(selectedId)}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Arquivar conversa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Messages Area - WhatsApp doodle background */}
            <div
              className="flex-1 overflow-y-auto px-4 md:px-12 lg:px-16 py-4"
              style={{
                backgroundColor: '#efeae2',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='40' height='40' patternUnits='userSpaceOnUse'%3E%3Cpath d='M20 5 L25 10 L20 15 L15 10 Z' fill='%23d4cfc6' opacity='0.3'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='400' height='400' fill='url(%23p)'/%3E%3C/svg%3E")`,
              }}
            >
              <div className="max-w-3xl mx-auto space-y-1">
                <AnimatePresence initial={false}>
                  {mensagens.map((msg, idx) => {
                    const outgoing = isOutgoing(msg.role);
                    const showDate = idx === 0 || 
                      format(new Date(msg.created_at), "yyyy-MM-dd") !== format(new Date(mensagens[idx-1].created_at), "yyyy-MM-dd");
                    
                    return (
                      <div key={msg.id}>
                        {/* Date separator */}
                        {showDate && (
                          <div className="flex justify-center my-3">
                            <span className="bg-white/90 text-[#54656f] text-[11px] px-3 py-1 rounded-lg shadow-sm">
                              {format(new Date(msg.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </span>
                          </div>
                        )}

                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.1 }}
                          className={cn("flex mb-0.5", outgoing ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "relative max-w-[65%] rounded-lg px-2.5 py-1.5 shadow-sm text-sm",
                              outgoing
                                ? msg.role === "assistant"
                                  ? "bg-[#d9fdd3] text-[#111b21]" // BIA - verde claro
                                  : "bg-[#d9fdd3] text-[#111b21]" // Operador - verde claro
                                : "bg-white text-[#111b21]" // Cliente - branco
                            )}
                            style={{
                              borderTopLeftRadius: outgoing ? '8px' : '0px',
                              borderTopRightRadius: outgoing ? '0px' : '8px',
                            }}
                          >
                            {/* Sender label for outgoing */}
                            {outgoing && (
                              <div className="flex items-center gap-1 mb-0.5">
                                {msg.role === "assistant" ? (
                                  <span className="text-[11px] font-medium text-[#6b3fa0]">
                                    <Bot className="h-3 w-3 inline mr-0.5" />
                                    BIA
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-[#00a884]">
                                    <Headset className="h-3 w-3 inline mr-0.5" />
                                    Operador
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Media content */}
                            {msg.metadata?.media_url && (
                              <div className="mb-1">
                                {msg.metadata.media_type === "image" ? (
                                  <a href={msg.metadata.media_url} target="_blank" rel="noreferrer">
                                    <img
                                      src={msg.metadata.media_url}
                                      alt={msg.metadata.filename || "imagem"}
                                      className="max-w-[280px] max-h-[320px] rounded-md object-cover"
                                    />
                                  </a>
                                ) : msg.metadata.media_type === "audio" ? (
                                  <audio controls src={msg.metadata.media_url} className="max-w-[260px]" />
                                ) : msg.metadata.media_type === "video" ? (
                                  <video controls src={msg.metadata.media_url} className="max-w-[280px] max-h-[320px] rounded-md" />
                                ) : (
                                  <a
                                    href={msg.metadata.media_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 bg-black/5 hover:bg-black/10 rounded-md p-2 text-[#111b21] no-underline"
                                  >
                                    <FileText className="h-5 w-5 text-[#54656f]" />
                                    <span className="text-[13px] truncate max-w-[180px]">{msg.metadata.filename || "arquivo"}</span>
                                    <Download className="h-4 w-4 text-[#54656f] ml-auto" />
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Message content */}
                            {msg.content && (
                              <p className="whitespace-pre-wrap break-words leading-[1.35] text-[14.2px]">
                                {msg.content}
                              </p>
                            )}

                            {/* Timestamp */}
                            <div className="flex items-center justify-end gap-1 -mb-0.5 mt-0.5">
                              <span className="text-[11px] text-[#667781]">
                                {format(new Date(msg.created_at), "HH:mm")}
                              </span>
                              {outgoing && (() => {
                                const s = msg.status || "sent";
                                if (s === "failed") {
                                  return <span title={msg.error_message || "Falha no envio"} className="text-red-500 text-[12px] leading-none">⚠</span>;
                                }
                                if (s === "pending") {
                                  return <span title="Pendente" className="text-[#667781] text-[11px]">🕒</span>;
                                }
                                const color = s === "read" ? "#53bdeb" : "#667781";
                                if (s === "sent") {
                                  return (
                                    <svg viewBox="0 0 16 11" width="16" height="11" style={{ color }}>
                                      <path fill="currentColor" d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.457.457 0 0 0-.336.153.462.462 0 0 0-.14.337c0 .13.046.24.14.337l2.357 2.526a.452.452 0 0 0 .336.14.501.501 0 0 0 .381-.178l6.484-8.001a.462.462 0 0 0 .102-.382.463.463 0 0 0-.102-.396z"/>
                                    </svg>
                                  );
                                }
                                // delivered / read = duplo check
                                return (
                                  <svg viewBox="0 0 16 11" width="16" height="11" style={{ color }}>
                                    <path fill="currentColor" d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.457.457 0 0 0-.336.153.462.462 0 0 0-.14.337c0 .13.046.24.14.337l2.357 2.526a.452.452 0 0 0 .336.14.501.501 0 0 0 .381-.178l6.484-8.001a.462.462 0 0 0 .102-.382.463.463 0 0 0-.102-.396zm-3.25 7.93l.56-.7 2.465 2.526a.452.452 0 0 0 .336.14.501.501 0 0 0 .381-.178l6.484-8.001a.462.462 0 0 0 .102-.382.463.463 0 0 0-.102-.396.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-.543-.565"/>
                                  </svg>
                                );
                              })()}
                            </div>

                            {/* Tail */}
                            <div
                              className={cn(
                                "absolute top-0 w-2 h-3",
                                outgoing ? "-right-2" : "-left-2"
                              )}
                            >
                              <svg viewBox="0 0 8 13" width="8" height="13">
                                {outgoing ? (
                                  <path fill="#d9fdd3" d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z"/>
                                ) : (
                                  <path fill="#fff" d="M6.467 3.568 0 12.193V1h5.188c1.77 0 2.338 1.156 1.279 2.568z"/>
                                )}
                              </svg>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Quick Replies */}
            <div className="bg-[#f0f2f5] px-3 pt-2 pb-1 border-t border-[#e9edef] flex items-center gap-1.5 overflow-x-auto flex-shrink-0">
              <Zap className="h-3.5 w-3.5 text-[#00a884] flex-shrink-0" />
              <span className="text-[10.5px] font-bold text-[#54656f] uppercase tracking-wide flex-shrink-0 mr-1">Respostas rápidas</span>
              {quickReplies.map((q) => (
                <button
                  key={q.label}
                  onClick={() => insertQuickReply(q.text)}
                  className="text-[11.5px] font-medium px-2.5 py-1 rounded-full bg-white border border-[#e9edef] text-[#54656f] hover:bg-[#e7f5f0] hover:border-[#00a884]/40 hover:text-[#017561] transition-all whitespace-nowrap"
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div className="bg-[#f0f2f5] px-2 sm:px-4 py-2 sm:py-2.5 flex items-end gap-1.5 sm:gap-2 flex-shrink-0">

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                onChange={handleFilePick}
              />

              {/* Emoji button (decorativo) - hidden on mobile to save space */}
              <button className="hidden sm:inline-flex p-2 rounded-full hover:bg-[#e9edef] transition-colors flex-shrink-0">
                <Smile className="h-6 w-6 text-[#54656f]" />
              </button>

              {/* Attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || recording}
                title="Anexar arquivo"
                className="p-2 rounded-full hover:bg-[#e9edef] transition-colors flex-shrink-0 disabled:opacity-50"
              >
                <Paperclip className="h-6 w-6 text-[#54656f] rotate-45" />
              </button>

              {/* Recording state */}
              {recording ? (
                <div className="flex-1 bg-white rounded-lg px-3 py-2.5 min-h-[42px] flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm text-[#3b4a54] flex-1">
                    Gravando... {Math.floor(recordingTime / 60).toString().padStart(2, "0")}:{(recordingTime % 60).toString().padStart(2, "0")}
                  </span>
                  <button
                    onClick={() => stopRecording(false)}
                    className="p-1.5 rounded-full hover:bg-[#e9edef]"
                    title="Cancelar"
                  >
                    <Trash2 className="h-5 w-5 text-red-500" />
                  </button>
                </div>
              ) : (
                <div className="flex-1 bg-white rounded-lg px-3 py-2.5 min-h-[42px] max-h-[120px] flex items-center">
                  <textarea
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite uma mensagem"
                    className="w-full bg-transparent text-[15px] text-[#3b4a54] placeholder-[#667781] outline-none resize-none leading-[1.35] max-h-[100px]"
                    rows={1}
                    style={{ height: 'auto', minHeight: '21px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 100) + 'px';
                    }}
                  />
                </div>
              )}

              {/* Send / Mic / Stop */}
              {recording ? (
                <button
                  onClick={() => stopRecording(true)}
                  className="p-2 rounded-full bg-[#00a884] hover:bg-[#008f72] transition-colors flex-shrink-0"
                  title="Enviar áudio"
                >
                  <Send className="h-6 w-6 text-white" />
                </button>
              ) : newMsg.trim() ? (
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="p-2 rounded-full hover:bg-[#e9edef] transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  <Send className="h-6 w-6 text-[#54656f]" />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={sending}
                  title="Gravar áudio"
                  className="p-2 rounded-full hover:bg-[#e9edef] transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  <Mic className="h-6 w-6 text-[#54656f]" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <NovaConversaDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        onCreated={(id) => setSelectedId(id)}
      />

      {/* Confirmação de apagar conversa */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar esta conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              A conversa será removida da sua caixa de entrada. O histórico permanecerá registrado para fins de auditoria e poderá ser recuperado pelo administrador, se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#00a884] hover:bg-[#008f72]"
              onClick={() => confirmDeleteId && handleDeleteConversa(confirmDeleteId)}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Vincular ao cadastro */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular ao cadastro</DialogTitle>
            <DialogDescription>
              Selecione um cliente para vincular ao telefone {selectedConversa?.telefone}.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={linkSearch}
            onChange={(e) => searchLink(e.target.value)}
            autoFocus
          />
          <div className="max-h-72 overflow-y-auto divide-y border rounded-md">
            {linkResults.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">Nenhum cliente encontrado</p>
            ) : (
              linkResults.map((cli) => (
                <button
                  key={cli.id}
                  className="w-full text-left p-3 hover:bg-muted transition"
                  onClick={() => linkClienteToConversa(cli.id, cli.nome)}
                >
                  <p className="font-medium text-sm">{cli.nome}</p>
                  {cli.telefone && <p className="text-xs text-muted-foreground">{cli.telefone}</p>}
                </button>
              ))
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setLinkDialogOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar cliente */}
      {editClienteData && (
        <ClienteFormDialog
          open={editClienteOpen}
          onOpenChange={setEditClienteOpen}
          initialData={editClienteData.form}
          editId={editClienteData.id}
          onSave={saveClienteInline}
        />
      )}

      {/* Painel "Dados do contato" */}
      <ContactDetailsPanel
        open={contactPanelOpen}
        onOpenChange={setContactPanelOpen}
        conversaId={selectedId}
        unidadeId={selectedConversa?.unidade_id || unidadeAtual?.id || null}
        contactName={selectedConversa?.titulo || ""}
        phone={selectedConversa?.telefone || null}
        photoUrl={selectedConversa?.foto_url || null}
        profileSyncStatus={profileSyncStatus}
        cliente={selectedId ? clienteByConv[selectedId] || null : null}
        onEditCliente={openEditCliente}
        onLinkCliente={handleOpenLinkDialog}
        onDeleteConversa={() => selectedId && setConfirmDeleteId(selectedId)}
        onRefreshPhoto={() => {
          const uid = selectedConversa?.unidade_id || unidadeAtual?.id;
          if (!uid || !selectedId) return;
          setProfileSyncStatus("syncing");
          supabase.functions.invoke("whatsapp-refresh-profile", {
            body: { unidade_id: uid, conversa_id: selectedId },
          }).then(({ data: r, error }: any) => {
            if (error || r?.ok === false) { setProfileSyncStatus("offline"); return; }
            setProfileSyncStatus("idle");
            if (r?.contato_foto_url) {
              setConversas((prev) => prev.map((x) =>
                x.id === selectedId ? { ...x, foto_url: r.contato_foto_url } : x
              ));
            }
          }).catch(() => setProfileSyncStatus("offline"));
        }}
      />
    </div>
  );
}
