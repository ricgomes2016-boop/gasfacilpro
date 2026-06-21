import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import {
  Send, Users, Loader2, Filter, UserMinus, Star, MapPin, Clock, AlertTriangle,
} from "lucide-react";
import { format, subDays, parseISO } from "date-fns";

const DISPATCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-dispatch`;

type Audience =
  | "inativos_30"
  | "inativos_60"
  | "ativos_recentes"
  | "top_fidelidade"
  | "novos_semana"
  | "bairro"
  | "todos";

const audienceLabels: Record<Audience, { label: string; icon: any; desc: string }> = {
  todos: { label: "Todos os clientes ativos", icon: Users, desc: "Toda a base com WhatsApp" },
  inativos_30: { label: "Inativos 30+ dias", icon: UserMinus, desc: "Sem pedido nos últimos 30 dias" },
  inativos_60: { label: "Inativos 60+ dias", icon: Clock, desc: "Sem pedido nos últimos 60 dias" },
  ativos_recentes: { label: "Ativos (últimos 30d)", icon: Users, desc: "Compraram nos últimos 30 dias" },
  top_fidelidade: { label: "Top fidelidade", icon: Star, desc: "Clientes com mais pedidos" },
  novos_semana: { label: "Novos da semana", icon: Users, desc: "Cadastrados nos últimos 7 dias" },
  bairro: { label: "Por bairro", icon: MapPin, desc: "Clientes de um bairro específico" },
};

const templates = [
  {
    nome: "Oferta especial",
    texto: "Olá {nome}! 🔥 Promoção relâmpago só hoje: gás P13 com R$ 5 OFF. Peça pelo WhatsApp!",
  },
  {
    nome: "Reativação inativos",
    texto: "Oi {nome}, sentimos sua falta! 💚 Voltou a precisar de gás? Temos um cupom especial pra você.",
  },
  {
    nome: "Aniversariante",
    texto: "🎂 Feliz aniversário, {nome}! Pra comemorar, você ganhou um vale-gás. Use até o fim do mês.",
  },
  {
    nome: "Recompra preditiva",
    texto: "Olá {nome}! Já passou {dias} dias do seu último pedido. Que tal garantir gás cheio antes que acabe? 🚚",
  },
];

export default function CampanhasWhatsApp() {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const empresaId = empresa?.id;
  const [audience, setAudience] = useState<Audience>("inativos_30");
  const [bairroFiltro, setBairroFiltro] = useState("");
  const [mensagem, setMensagem] = useState(templates[0].texto);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({ enviados: 0, total: 0, falhas: 0 });

  const { data: clientes = [] } = useQuery({
    queryKey: ["camp-whats-clientes", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, telefone, bairro, created_at, ativo")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .not("telefone", "is", null)
        .limit(5000);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["camp-whats-pedidos", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await supabase
        .from("pedidos")
        .select("cliente_id, created_at")
        .gte("created_at", subDays(new Date(), 90).toISOString())
        .limit(5000);
      return data || [];
    },
    enabled: !!empresaId,
  });

  const ultimoPedidoMap = useMemo(() => {
    const m = new Map<string, string>();
    const cnt = new Map<string, number>();
    pedidos.forEach((p: any) => {
      if (!p.cliente_id) return;
      const cur = m.get(p.cliente_id);
      if (!cur || p.created_at > cur) m.set(p.cliente_id, p.created_at);
      cnt.set(p.cliente_id, (cnt.get(p.cliente_id) || 0) + 1);
    });
    return { m, cnt };
  }, [pedidos]);

  const publico = useMemo(() => {
    const now = new Date();
    return clientes.filter((c: any) => {
      const tel = (c.telefone || "").replace(/\D/g, "");
      if (tel.length < 10) return false;
      const ultimo = ultimoPedidoMap.m.get(c.id);
      const ultimoDate = ultimo ? parseISO(ultimo) : null;
      const diasSemPedido = ultimoDate ? Math.floor((now.getTime() - ultimoDate.getTime()) / 86400000) : 9999;

      switch (audience) {
        case "todos": return true;
        case "inativos_30": return diasSemPedido >= 30;
        case "inativos_60": return diasSemPedido >= 60;
        case "ativos_recentes": return diasSemPedido <= 30;
        case "top_fidelidade": return (ultimoPedidoMap.cnt.get(c.id) || 0) >= 5;
        case "novos_semana": return c.created_at && parseISO(c.created_at) >= subDays(now, 7);
        case "bairro": return !bairroFiltro || (c.bairro || "").toLowerCase().includes(bairroFiltro.toLowerCase());
        default: return true;
      }
    });
  }, [clientes, ultimoPedidoMap, audience, bairroFiltro]);

  const formatarMensagem = (cliente: any) => {
    const ultimo = ultimoPedidoMap.m.get(cliente.id);
    const dias = ultimo ? Math.floor((Date.now() - parseISO(ultimo).getTime()) / 86400000) : 0;
    return mensagem
      .replace(/\{nome\}/g, (cliente.nome || "").split(" ")[0] || "cliente")
      .replace(/\{nome_completo\}/g, cliente.nome || "")
      .replace(/\{bairro\}/g, cliente.bairro || "")
      .replace(/\{dias\}/g, String(dias));
  };

  const enviar = async () => {
    if (!mensagem.trim()) { toast.error("Digite uma mensagem"); return; }
    if (publico.length === 0) { toast.error("Nenhum cliente no público selecionado"); return; }
    if (!confirm(`Confirma envio para ${publico.length} clientes via WhatsApp?`)) return;

    setEnviando(true);
    setProgresso({ enviados: 0, total: publico.length, falhas: 0 });

    const { data: { session } } = await supabase.auth.getSession();
    let enviados = 0;
    let falhas = 0;

    for (const c of publico) {
      try {
        const resp = await fetch(DISPATCH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            action: "whatsapp",
            content: formatarMensagem(c),
            phone: c.telefone,
            unidadeId: unidadeAtual?.id,
          }),
        });
        if (resp.ok) enviados++; else falhas++;
      } catch { falhas++; }
      setProgresso({ enviados, total: publico.length, falhas });
      await new Promise((r) => setTimeout(r, 800)); // throttle anti-ban
    }

    setEnviando(false);
    toast.success(`Campanha concluída: ${enviados} enviados, ${falhas} falhas`);
  };

  const Icon = audienceLabels[audience].icon;

  return (
    <MainLayout>
      <Header title="Campanhas WhatsApp" subtitle="Disparo segmentado para sua base de clientes" />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs">
              Use templates aprovados pelo WhatsApp Business e respeite o opt-in dos clientes. Disparos em massa para números não consentidos podem gerar bloqueio.
              Variáveis disponíveis: <code>{"{nome}"}</code>, <code>{"{bairro}"}</code>, <code>{"{dias}"}</code>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /> 1. Selecione o público</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.keys(audienceLabels) as Audience[]).map((k) => {
                const a = audienceLabels[k];
                const active = audience === k;
                const Ai = a.icon;
                return (
                  <button
                    key={k}
                    onClick={() => setAudience(k)}
                    className={`text-left p-3 rounded-lg border transition ${active ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                  >
                    <Ai className={`h-4 w-4 mb-1.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-xs font-semibold">{a.label}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{a.desc}</p>
                  </button>
                );
              })}
            </div>

            {audience === "bairro" && (
              <div>
                <Label>Filtro de bairro</Label>
                <Input value={bairroFiltro} onChange={(e) => setBairroFiltro(e.target.value)} placeholder="Ex.: Centro" />
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg">
              <Icon className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">{publico.length}</p>
              <p className="text-xs text-muted-foreground">clientes serão impactados</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2. Mensagem</CardTitle>
            <CardDescription>Use as variáveis para personalizar cada envio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select onValueChange={(v) => { const t = templates[Number(v)]; if (t) setMensagem(t.texto); }}>
              <SelectTrigger><SelectValue placeholder="Carregar template…" /></SelectTrigger>
              <SelectContent>{templates.map((t, i) => <SelectItem key={i} value={String(i)}>{t.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea rows={5} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            {publico[0] && (
              <div className="p-3 bg-muted/40 rounded-lg">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">PRÉ-VISUALIZAÇÃO ({publico[0].nome}):</p>
                <p className="text-sm whitespace-pre-wrap">{formatarMensagem(publico[0])}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">3. Enviar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {enviando && (
              <div className="space-y-1.5">
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progresso.total ? (progresso.enviados + progresso.falhas) / progresso.total * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{progresso.enviados + progresso.falhas} / {progresso.total} ({progresso.falhas} falhas)</p>
              </div>
            )}
            <Button onClick={enviar} disabled={enviando || publico.length === 0} size="lg" className="w-full gap-2">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Disparar para {publico.length} clientes
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
