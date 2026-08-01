import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Bot, Check, ChevronLeft, Clock, Cloud, MessageCircle, Phone, PhoneCall, RefreshCw, Route, Settings2, ShoppingCart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type ChamadaIA = {
  id: string;
  telefone: string | null;
  did: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  tipo: string | null;
  status: string | null;
  duracao_segundos: number | null;
  observacoes: string | null;
  pedido_gerado_id: string | null;
  empresa_id: string | null;
  unidade_id: string | null;
  created_at: string;
  pedidos?: {
    id: string;
    numero_sequencial: number | null;
    valor_total: number | null;
    status: string | null;
    endereco_entrega: string | null;
    forma_pagamento: string | null;
    observacoes: string | null;
    created_at: string | null;
  } | null;
  unidades?: {
    id: string;
    nome: string;
  } | null;
};

type DidRouting = {
  id: string;
  did: string;
  provedor: string;
  ativo: boolean;
  observacao: string | null;
  unidade_id: string | null;
  unidades?: { nome: string; tipo: string } | null;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  recebida: { label: "Recebida", className: "bg-blue-50 text-blue-700 border-blue-200" },
  atendida: { label: "Atendida", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  concluida: { label: "Concluida", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  retornar: { label: "Retornar", className: "bg-amber-50 text-amber-700 border-amber-200" },
  perdida: { label: "Perdida", className: "bg-red-50 text-red-700 border-red-200" },
  erro: { label: "Erro", className: "bg-red-50 text-red-700 border-red-200" },
};

function formatPhone(phone?: string | null) {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  const br = digits.startsWith("55") ? digits.slice(2) : digits;
  if (br.length === 11) return `(${br.slice(0, 2)}) ${br.slice(2, 7)}-${br.slice(7)}`;
  if (br.length === 10) return `(${br.slice(0, 2)}) ${br.slice(2, 6)}-${br.slice(6)}`;
  return phone;
}

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return "-";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function isToday(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isVoiceIA(call: ChamadaIA) {
  const tipo = (call.tipo || "").toLowerCase();
  const obs = (call.observacoes || "").toLowerCase();
  return tipo !== "whatsapp" || obs.includes("bia") || obs.includes("twilio") || obs.includes("elevenlabs") || obs.includes("ia");
}

function statusFor(call: ChamadaIA) {
  return statusConfig[(call.status || "").toLowerCase()] || statusConfig.recebida;
}

export default function LigacaoIA() {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const [searchParams] = useSearchParams();
  const [ligacoes, setLigacoes] = useState<ChamadaIA[]>([]);
  const [didRoutes, setDidRoutes] = useState<DidRouting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChamadaIA | null>(null);

  const carregar = async () => {
    if (!empresa?.id) return;
    setLoading(true);
    try {
      const callsQuery = supabase
        .from("chamadas_recebidas")
        .select("*, pedidos(id,numero_sequencial,valor_total,status,endereco_entrega,forma_pagamento,observacoes,created_at), unidades(id,nome)")
        .eq("empresa_id", empresa.id)
        .order("created_at", { ascending: false })
        .limit(120);

      const routesQuery = supabase
        .from("did_empresa_routing")
        .select("id,did,provedor,ativo,observacao,unidade_id, unidades(nome,tipo)")
        .eq("empresa_id", empresa.id)
        .order("ativo", { ascending: false })
        .order("did");

      const [{ data: calls, error: callsError }, { data: routes, error: routesError }] = await Promise.all([callsQuery, routesQuery]);
      if (callsError) throw callsError;
      if (routesError) throw routesError;

      setLigacoes(((calls || []) as ChamadaIA[]).filter(isVoiceIA));
      setDidRoutes((routes || []) as DidRouting[]);
    } catch (error: any) {
      toast.error(`Erro ao carregar ligacoes IA: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id, unidadeAtual?.id]);

  useEffect(() => {
    const chamadaId = searchParams.get("chamada");
    if (!chamadaId || ligacoes.length === 0) return;
    const found = ligacoes.find((call) => call.id === chamadaId);
    if (found) setSelected(found);
  }, [searchParams, ligacoes]);

  const stats = useMemo(() => {
    const todayCalls = ligacoes.filter((call) => isToday(call.created_at));
    const pedidos = ligacoes.filter((call) => call.pedido_gerado_id).length;
    const conversion = ligacoes.length ? Math.round((pedidos / ligacoes.length) * 100) : 0;
    const totalSeconds = ligacoes.reduce((sum, call) => sum + Number(call.duracao_segundos || 0), 0);
    const avgSeconds = ligacoes.length ? Math.round(totalSeconds / ligacoes.length) : 0;

    return [
      { label: "Ligacoes hoje", value: todayCalls.length, icon: PhoneCall, className: "bg-blue-50 text-blue-700" },
      { label: "Pedidos criados", value: pedidos, icon: ShoppingCart, className: "bg-emerald-50 text-emerald-700" },
      { label: "Taxa de conversao", value: `${conversion}%`, icon: Route, className: "bg-indigo-50 text-indigo-700" },
      { label: "Tempo medio", value: formatDuration(avgSeconds), icon: Clock, className: "bg-amber-50 text-amber-700" },
    ];
  }, [ligacoes]);

  const activeRoutes = didRoutes.filter((route) => route.ativo);
  const selectedRoute = unidadeAtual?.id
    ? activeRoutes.find((route) => route.unidade_id === unidadeAtual.id) || activeRoutes[0]
    : activeRoutes[0];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1280px] mx-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Atendimento telefonico</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary" />
            Ligacao IA Bia
          </h1>
          <p className="text-sm text-muted-foreground">Chamadas Twilio, reconhecimento por BINA, pedidos criados e historico da conversa.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="gap-2 rounded-lg" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Link to="/config/regras-bia">
            <Button className="gap-2 rounded-lg w-full sm:w-auto">
              <Settings2 className="h-4 w-4" />
              Configurar Bia
            </Button>
          </Link>
        </div>
      </div>

      <Card className="rounded-lg border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${selectedRoute ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {selectedRoute ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-950">{selectedRoute ? "Twilio conectado ao roteamento da empresa" : "Roteamento Twilio nao encontrado"}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRoute
                      ? `${formatPhone(selectedRoute.did)} · ${selectedRoute.provedor} · ${selectedRoute.unidades?.nome || "todas as lojas"}`
                      : "Cadastre o DID em did_empresa_routing para a Bia direcionar chamadas para a empresa correta."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                    <Cloud className="h-3.5 w-3.5" /> Supabase
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                    <Bot className="h-3.5 w-3.5" /> ElevenLabs/Bia
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                    <Phone className="h-3.5 w-3.5" /> Twilio DID
                  </span>
                </div>
              </div>
              {activeRoutes.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeRoutes.map((route) => (
                    <span key={route.id} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                      {formatPhone(route.did)} · {route.unidades?.nome || "Todas"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="rounded-lg border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${stat.className}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold leading-none text-slate-950">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-lg border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="font-bold text-slate-950">Historico de ligacoes</p>
            <p className="text-xs text-muted-foreground">Clique em uma ligacao para ver detalhes da Bia</p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Carregando...</div>
        ) : ligacoes.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <PhoneCall className="h-7 w-7 text-slate-500" />
            </div>
            <p className="font-bold text-slate-950">Nenhuma ligacao registrada ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Depois que a Twilio encaminhar chamadas para a Bia, elas aparecem aqui automaticamente.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Data/Hora</th>
                    <th className="px-4 py-3 text-left">Telefone</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Resumo</th>
                    <th className="px-4 py-3 text-left">Valor</th>
                    <th className="px-4 py-3 text-left">Pedido</th>
                    <th className="px-4 py-3 text-left">Loja</th>
                    <th className="px-4 py-3 text-left">Duracao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ligacoes.map((call) => {
                    const st = statusFor(call);
                    return (
                      <tr key={call.id} className="cursor-pointer hover:bg-slate-50/80 transition-colors" onClick={() => setSelected(call)}>
                        <td className="px-4 py-4 whitespace-nowrap font-medium text-slate-900">{formatDate(call.created_at)}</td>
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-slate-700">{formatPhone(call.telefone)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${st.className}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-4 max-w-[280px] truncate text-slate-600">{call.observacoes || "-"}</td>
                        <td className="px-4 py-4 whitespace-nowrap font-bold text-slate-950">{call.pedidos?.valor_total ? formatCurrency(call.pedidos.valor_total) : "-"}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-primary font-semibold">
                          {call.pedido_gerado_id ? `#${call.pedidos?.numero_sequencial || call.pedido_gerado_id.slice(0, 6)}` : "-"}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-slate-600">{call.unidades?.nome || unidadeAtual?.nome || "-"}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-slate-600">{formatDuration(call.duracao_segundos)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {ligacoes.map((call) => {
                const st = statusFor(call);
                return (
                  <button key={call.id} className="w-full text-left p-4 space-y-2" onClick={() => setSelected(call)}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">{formatPhone(call.telefone)}</p>
                        <p className="text-xs text-slate-500">{formatDate(call.created_at)}</p>
                      </div>
                      <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${st.className}`}>{st.label}</span>
                    </div>
                    {call.observacoes && <p className="text-sm text-slate-600 line-clamp-2">{call.observacoes}</p>}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{call.pedido_gerado_id ? `Pedido #${call.pedidos?.numero_sequencial || call.pedido_gerado_id.slice(0, 6)}` : "Sem pedido"}</span>
                      <span>{formatDuration(call.duracao_segundos)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-primary" />
              Detalhes da ligacao IA
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-lg font-bold text-slate-950">{formatPhone(selected.telefone)}</p>
                  <p className="text-sm text-slate-500">{formatDate(selected.created_at)}</p>
                </div>
                <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusFor(selected).className}`}>{statusFor(selected).label}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Cliente</p>
                  <p className="font-semibold text-slate-950 truncate">{selected.cliente_nome || "Nao identificado"}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">DID Twilio</p>
                  <p className="font-semibold text-slate-950 truncate">{formatPhone(selected.did)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Duracao</p>
                  <p className="font-semibold text-slate-950">{formatDuration(selected.duracao_segundos)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Atendente</p>
                  <p className="font-semibold text-slate-950">Bia</p>
                </div>
              </div>

              {selected.pedido_gerado_id && (
                <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
                    <ShoppingCart className="h-4 w-4" />
                    Pedido gerado pela ligacao
                  </p>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Numero</p>
                      <p className="font-semibold text-slate-950">#{selected.pedidos?.numero_sequencial || selected.pedido_gerado_id.slice(0, 6)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Valor</p>
                      <p className="font-semibold text-slate-950">{formatCurrency(selected.pedidos?.valor_total)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Pagamento</p>
                      <p className="font-semibold text-slate-950">{selected.pedidos?.forma_pagamento || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Status</p>
                      <p className="font-semibold text-slate-950">{selected.pedidos?.status || "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-slate-500">Endereco</p>
                      <p className="font-semibold text-slate-950">{selected.pedidos?.endereco_entrega || "-"}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4" />
                  Resumo / transcricao
                </p>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 whitespace-pre-wrap min-h-[96px]">
                  {selected.observacoes || "Sem observacoes registradas para esta chamada."}
                </div>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" className="rounded-lg gap-2" onClick={() => setSelected(null)}>
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <Button variant="ghost" className="rounded-lg gap-2" onClick={() => setSelected(null)}>
                  <X className="h-4 w-4" />
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
