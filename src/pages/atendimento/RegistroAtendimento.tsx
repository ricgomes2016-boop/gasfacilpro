import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, CalendarDays, CheckCircle2, Clock3, MessageCircle, Phone, PhoneCall, RefreshCw, Search, ShoppingCart, User, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Periodo = "hoje" | "ontem" | "7dias" | "todos";
type FiltroCanal = "todos" | "telefone" | "whatsapp" | "ia" | "manual";
type FiltroStatus = "todos" | "novo" | "em_atendimento" | "pedido_criado" | "perdido" | "finalizado" | "sem_resposta";

type Chamada = {
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
  clientes?: {
    id: string;
    nome: string;
    telefone: string | null;
    endereco: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
  } | null;
  pedidos?: {
    id: string;
    numero_sequencial: number | null;
    endereco_entrega: string | null;
    valor_total: number | null;
    status: string | null;
    forma_pagamento: string | null;
  } | null;
};

const canalConfig = {
  telefone: { label: "Telefone", icon: Phone, className: "bg-sky-50 text-sky-700 border-sky-200" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ia: { label: "Bia IA", icon: Bot, className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  manual: { label: "Manual", icon: User, className: "bg-slate-50 text-slate-700 border-slate-200" },
};

const statusConfig = {
  novo: { label: "Novo", className: "bg-blue-50 text-blue-700 border-blue-200" },
  em_atendimento: { label: "Em atendimento", className: "bg-amber-50 text-amber-700 border-amber-200" },
  pedido_criado: { label: "Pedido criado", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  perdido: { label: "Perdido", className: "bg-red-50 text-red-700 border-red-200" },
  finalizado: { label: "Finalizado", className: "bg-slate-100 text-slate-700 border-slate-200" },
  sem_resposta: { label: "Sem resposta", className: "bg-rose-50 text-rose-700 border-rose-200" },
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
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function normalizeDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

function getCanal(chamada: Chamada): keyof typeof canalConfig {
  const tipo = (chamada.tipo || "").toLowerCase();
  const obs = (chamada.observacoes || "").toLowerCase();
  if (tipo === "whatsapp") return "whatsapp";
  if (obs.includes("bia") || obs.includes("elevenlabs") || obs.includes("twilio") || obs.includes("ia")) return "ia";
  if (tipo === "manual") return "manual";
  return "telefone";
}

function getStatus(chamada: Chamada): keyof typeof statusConfig {
  const raw = (chamada.status || "").toLowerCase();
  if (chamada.pedido_gerado_id) return "pedido_criado";
  if (["perdida", "perdido", "erro"].includes(raw)) return "perdido";
  if (["retornar", "em_atendimento", "recebida"].includes(raw)) return raw === "recebida" ? "novo" : "em_atendimento";
  if (["atendida", "concluida", "finalizado"].includes(raw)) return "finalizado";
  if (["sem_resposta", "nao_atendida"].includes(raw)) return "sem_resposta";
  return "novo";
}

function enderecoCliente(chamada: Chamada) {
  const pedidoEndereco = chamada.pedidos?.endereco_entrega;
  if (pedidoEndereco) return pedidoEndereco;
  const cliente = chamada.clientes;
  const partes = [cliente?.endereco, cliente?.numero, cliente?.bairro, cliente?.cidade].filter(Boolean);
  return partes.join(", ");
}

function nomeCliente(chamada: Chamada) {
  return chamada.clientes?.nome || chamada.cliente_nome || "Nao identificado";
}

function inPeriodo(createdAt: string, periodo: Periodo) {
  const date = new Date(createdAt);
  if (periodo === "todos") return true;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const seteDias = new Date(hoje);
  seteDias.setDate(seteDias.getDate() - 7);

  if (periodo === "hoje") return date >= hoje && date < amanha;
  if (periodo === "ontem") return date >= ontem && date < hoje;
  return date >= seteDias;
}

export default function RegistroAtendimento() {
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const [records, setRecords] = useState<Chamada[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [canal, setCanal] = useState<FiltroCanal>("todos");
  const [status, setStatus] = useState<FiltroStatus>("todos");
  const [busca, setBusca] = useState("");
  const [semPedido, setSemPedido] = useState(false);
  const [naoIdentificados, setNaoIdentificados] = useState(false);

  const carregar = async () => {
    if (!empresa?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from("chamadas_recebidas")
        .select("*, clientes(id,nome,telefone,endereco,numero,bairro,cidade), pedidos(id,numero_sequencial,endereco_entrega,valor_total,status,forma_pagamento)")
        .eq("empresa_id", empresa.id)
        .order("created_at", { ascending: false })
        .limit(300);

      if (unidadeAtual?.id) {
        query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRecords((data || []) as Chamada[]);
    } catch (error: any) {
      toast.error(`Erro ao carregar atendimentos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id, unidadeAtual?.id]);

  const filtered = useMemo(() => {
    const term = busca.trim().toLowerCase();
    const digits = normalizeDigits(term);

    return records.filter((record) => {
      const recordCanal = getCanal(record);
      const recordStatus = getStatus(record);
      const texto = [
        nomeCliente(record),
        record.telefone,
        record.did,
        enderecoCliente(record),
        record.observacoes,
        record.pedidos?.numero_sequencial,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!inPeriodo(record.created_at, periodo)) return false;
      if (canal !== "todos" && recordCanal !== canal) return false;
      if (status !== "todos" && recordStatus !== status) return false;
      if (semPedido && record.pedido_gerado_id) return false;
      if (naoIdentificados && record.cliente_id) return false;
      if (term && !texto.includes(term) && !(digits && normalizeDigits(record.telefone).includes(digits))) return false;
      return true;
    });
  }, [records, periodo, canal, status, busca, semPedido, naoIdentificados]);

  const kpis = useMemo(() => {
    const hoje = records.filter((record) => inPeriodo(record.created_at, "hoje"));
    return [
      { label: "Atendimentos hoje", value: hoje.length, icon: PhoneCall, className: "bg-blue-50 text-blue-700" },
      { label: "Ligacoes perdidas", value: hoje.filter((record) => getStatus(record) === "perdido").length, icon: Phone, className: "bg-red-50 text-red-700" },
      { label: "WhatsApp pendentes", value: hoje.filter((record) => getCanal(record) === "whatsapp" && !record.pedido_gerado_id).length, icon: MessageCircle, className: "bg-emerald-50 text-emerald-700" },
      { label: "Vendas geradas", value: records.filter((record) => record.pedido_gerado_id).length, icon: ShoppingCart, className: "bg-indigo-50 text-indigo-700" },
      { label: "Nao identificados", value: records.filter((record) => !record.cliente_id).length, icon: UserPlus, className: "bg-amber-50 text-amber-700" },
    ];
  }, [records]);

  const handleVender = (record: Chamada) => {
    const params = new URLSearchParams();
    if (record.cliente_id) params.set("cliente_id", record.cliente_id);
    if (record.telefone) params.set("telefone", normalizeDigits(record.telefone));
    if (!record.cliente_id && nomeCliente(record) !== "Nao identificado") params.set("nome", nomeCliente(record));
    navigate(`/vendas/nova?${params.toString()}`);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1480px] mx-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Atendimento</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Registro de atendimentos</h1>
          <p className="text-sm text-muted-foreground">Telefone, WhatsApp, Bia IA, cliente identificado e pedido gerado em uma tela unica.</p>
        </div>
        <Button variant="outline" className="gap-2 rounded-lg" onClick={carregar} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="rounded-lg border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${kpi.className}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold leading-none text-slate-950">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-lg border-slate-200 shadow-sm">
        <CardContent className="p-3 md:p-4 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-[auto_auto_auto_1fr] gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 col-span-2 lg:col-span-1">
              {[
                ["hoje", "Hoje"],
                ["ontem", "Ontem"],
                ["7dias", "7 dias"],
                ["todos", "Tudo"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`px-3 py-2 text-xs font-semibold rounded-md transition ${periodo === value ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                  onClick={() => setPeriodo(value as Periodo)}
                >
                  {label}
                </button>
              ))}
            </div>

            <Select value={canal} onValueChange={(v) => setCanal(v as FiltroCanal)}>
              <SelectTrigger className="rounded-lg h-11">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os canais</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="ia">Bia IA</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(v) => setStatus(v as FiltroStatus)}>
              <SelectTrigger className="rounded-lg h-11">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="em_atendimento">Em atendimento</SelectItem>
                <SelectItem value="pedido_criado">Pedido criado</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="sem_resposta">Sem resposta</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input className="h-11 rounded-lg pl-9" placeholder="Buscar por cliente, telefone, endereco ou pedido..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <Switch checked={semPedido} onCheckedChange={setSemPedido} />
              Apenas sem pedido
            </label>
            <label className="flex items-center gap-2 text-slate-600">
              <Switch checked={naoIdentificados} onCheckedChange={setNaoIdentificados} />
              Apenas nao identificados
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="font-bold text-slate-950">{filtered.length} registros</p>
            <p className="text-xs text-muted-foreground">Lista operacional com acoes rapidas</p>
          </div>
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Data/Hora</th>
                <th className="px-4 py-3 text-left">Canal</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Telefone/BINA</th>
                <th className="px-4 py-3 text-left">Endereco</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Resumo</th>
                <th className="px-4 py-3 text-left">Pedido</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-4 py-10 text-center text-muted-foreground" colSpan={9}>Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-4 py-10 text-center text-muted-foreground" colSpan={9}>Nenhum atendimento encontrado.</td></tr>
              ) : filtered.map((record) => {
                const recordCanal = canalConfig[getCanal(record)];
                const recordStatus = statusConfig[getStatus(record)];
                const CanalIcon = recordCanal.icon;
                const endereco = enderecoCliente(record);
                return (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap font-medium text-slate-900">{formatDate(record.created_at)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${recordCanal.className}`}>
                        <CanalIcon className="h-3.5 w-3.5" />
                        {recordCanal.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 max-w-[190px]">
                      <p className="font-semibold text-slate-950 truncate">{nomeCliente(record)}</p>
                      {!record.cliente_id && <p className="text-xs text-amber-600">Cadastrar cliente</p>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap font-mono text-slate-600">{formatPhone(record.telefone)}</td>
                    <td className="px-4 py-4 max-w-[230px] text-slate-600 truncate">{endereco || "-"}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${recordStatus.className}`}>{recordStatus.label}</span>
                    </td>
                    <td className="px-4 py-4 max-w-[240px] text-slate-600 truncate">{record.observacoes || "-"}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {record.pedido_gerado_id ? (
                        <button onClick={() => navigate("/vendas/pedidos")} className="text-primary font-semibold hover:underline">
                          #{record.pedidos?.numero_sequencial || record.pedido_gerado_id.slice(0, 6)}
                        </button>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {!record.pedido_gerado_id && (
                          <Button size="icon" className="h-8 w-8 rounded-lg" title="Vender" onClick={() => handleVender(record)}>
                            <ShoppingCart className="h-4 w-4" />
                          </Button>
                        )}
                        {!record.cliente_id && (
                          <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" title="Cadastrar cliente" onClick={() => navigate(`/clientes/cadastro?telefone=${encodeURIComponent(record.telefone || "")}&nome=${encodeURIComponent(record.cliente_nome || "")}`)}>
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        )}
                        {getCanal(record) === "whatsapp" ? (
                          <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" title="Abrir WhatsApp" onClick={() => navigate(`/chat?telefone=${encodeURIComponent(record.telefone || "")}`)}>
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" title="Ver ligacao" onClick={() => navigate(`/atendimento/ligacao-ia?chamada=${record.id}`)}>
                            <PhoneCall className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum atendimento encontrado.</div>
          ) : filtered.map((record) => {
            const recordCanal = canalConfig[getCanal(record)];
            const recordStatus = statusConfig[getStatus(record)];
            const CanalIcon = recordCanal.icon;
            const endereco = enderecoCliente(record);
            return (
              <div key={record.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-950 leading-tight">{nomeCliente(record)}</p>
                    <p className="text-xs text-slate-500 mt-1">{endereco || "Endereco nao informado"}</p>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold ${recordStatus.className}`}>{recordStatus.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-600"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(record.created_at)}</span>
                  <span className="font-mono text-slate-600">{formatPhone(record.telefone)}</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-semibold ${recordCanal.className}`}>
                    <CanalIcon className="h-3.5 w-3.5" /> {recordCanal.label}
                  </span>
                  <span className="text-slate-600">{record.pedido_gerado_id ? `Pedido #${record.pedidos?.numero_sequencial || record.pedido_gerado_id.slice(0, 6)}` : "Sem pedido"}</span>
                </div>
                {record.observacoes && <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{record.observacoes}</p>}
                <div className="flex justify-end gap-2">
                  {!record.pedido_gerado_id && <Button size="sm" className="rounded-lg gap-2" onClick={() => handleVender(record)}><ShoppingCart className="h-4 w-4" /> Vender</Button>}
                  <Button size="sm" variant="outline" className="rounded-lg gap-2" onClick={() => navigate(`/atendimento/ligacao-ia?chamada=${record.id}`)}><PhoneCall className="h-4 w-4" /> Detalhes</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
