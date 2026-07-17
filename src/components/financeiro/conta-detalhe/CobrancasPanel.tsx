import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, Plus, ExternalLink, Copy, Search, Loader2, FileText, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { EmitirBoletoAsaasDialog } from "@/components/financeiro/EmitirBoletoAsaasDialog";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  contaId: string;
  unidadeId: string | null;
  accentColor: string;
  provider: "asaas" | "pagbank" | "itau";
}

type StatusFilter = "todas" | "pendente" | "pago" | "vencido";

interface CobrancaRow {
  id: string;
  cliente: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
  asaas_charge_id: string | null;
  linha_digitavel: string | null;
  boleto_url: string | null;
  pix_qrcode: string | null;
  pix_copia_cola: string | null;
  parcela_atual: number | null;
  total_parcelas: number | null;
  pedido_id: string | null;
  seu_numero: string | null;
}

export default function CobrancasPanel({ contaId, unidadeId, accentColor, provider }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusFilter>("todas");
  const [busca, setBusca] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);
  const [emitirConta, setEmitirConta] = useState<CobrancaRow | null>(null);

  const { data: cobrancas = [], isLoading } = useQuery({
    queryKey: ["cobrancas-conta", contaId, unidadeId, status],
    queryFn: async () => {
      let q = supabase
        .from("contas_receber")
        .select("id,cliente,descricao,valor,vencimento,status,asaas_charge_id,linha_digitavel,boleto_url,pix_qrcode,pix_copia_cola,parcela_atual,total_parcelas,pedido_id,seu_numero")
        .not("asaas_charge_id", "is", null)
        .order("vencimento", { ascending: false })
        .limit(200);
      if (unidadeId) q = q.eq("unidade_id", unidadeId);
      if (status !== "todas") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CobrancaRow[];
    },
  });

  const filtradas = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return cobrancas;
    return cobrancas.filter(c =>
      (c.cliente || "").toLowerCase().includes(term) ||
      (c.descricao || "").toLowerCase().includes(term) ||
      (c.seu_numero || "").toLowerCase().includes(term),
    );
  }, [cobrancas, busca]);

  const kpis = useMemo(() => {
    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();
    let emitidoMes = 0, recebido = 0, aberto = 0, vencido = 0;
    cobrancas.forEach(c => {
      const v = Number(c.valor || 0);
      const venc = new Date(c.vencimento);
      if (venc.getMonth() === mesAtual && venc.getFullYear() === anoAtual) emitidoMes += v;
      if (c.status === "pago") recebido += v;
      else if (c.status === "pendente") {
        aberto += v;
        if (venc < now) vencido += v;
      }
    });
    return { emitidoMes, recebido, aberto, vencido };
  }, [cobrancas]);

  const copy = async (text?: string | null) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const renderStatusBadge = (s: string, venc: string) => {
    const vencida = s === "pendente" && new Date(venc) < new Date();
    if (s === "pago") return <Badge className="bg-success">Pago</Badge>;
    if (vencida) return <Badge variant="destructive">Vencido</Badge>;
    if (s === "cancelado") return <Badge variant="outline">Cancelado</Badge>;
    return <Badge variant="secondary">Pendente</Badge>;
  };

  const tipoCobranca = (c: CobrancaRow) =>
    c.pix_copia_cola ? "PIX" : c.linha_digitavel || c.boleto_url ? "Boleto" : "Pendente";

  return (
    <div className="space-y-4">
      {/* Header / Ação */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5" style={{ color: accentColor }} />
              <div>
                <h3 className="font-semibold leading-tight">Cobranças</h3>
                <p className="text-xs text-muted-foreground">Boletos e Pix emitidos via {provider === "asaas" ? "Asaas" : "PagBank"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => qc.invalidateQueries({ queryKey: ["cobrancas-conta", contaId] })}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />Atualizar
              </Button>
              <Button
                size="sm"
                onClick={() => setNovaOpen(true)}
                style={{ background: accentColor, color: "#fff" }}
              >
                <Plus className="h-4 w-4 mr-1" />Nova cobrança
              </Button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Emitido (mês)", value: kpis.emitidoMes, color: accentColor },
              { label: "Recebido", value: kpis.recebido, color: "#16a34a" },
              { label: "Em aberto", value: kpis.aberto, color: "#64748b" },
              { label: "Vencido", value: kpis.vencido, color: "#dc2626" },
            ].map(k => (
              <div key={k.label} className="rounded-lg border bg-card p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: k.color }}>
                  R$ {k.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Tabs value={status} onValueChange={v => setStatus(v as StatusFilter)} className="sm:flex-1">
              <TabsList className="w-full grid grid-cols-4 h-9">
                <TabsTrigger value="todas" className="text-xs">Todas</TabsTrigger>
                <TabsTrigger value="pendente" className="text-xs">Pendentes</TabsTrigger>
                <TabsTrigger value="pago" className="text-xs">Pagas</TabsTrigger>
                <TabsTrigger value="vencido" className="text-xs">Vencidas</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                className="pl-8 h-9"
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardContent className="pt-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />Carregando cobranças...
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma cobrança encontrada.</p>
              <Button size="sm" variant="outline" onClick={() => setNovaOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Emitir primeira cobrança
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtradas.map(c => {
                const tipo = tipoCobranca(c);
                return (
                  <div
                    key={c.id}
                    className="border rounded-lg p-3 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm truncate">{c.cliente || "Sem cliente"}</p>
                          {renderStatusBadge(c.status, c.vencimento)}
                          <Badge variant="outline" className="text-[10px] gap-1">
                            {tipo === "PIX" ? <QrCode className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                            {tipo}
                          </Badge>
                          {c.total_parcelas && c.total_parcelas > 1 && (
                            <Badge variant="outline" className="text-[10px]">
                              {c.parcela_atual}/{c.total_parcelas}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.descricao}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Vence em {format(new Date(c.vencimento), "dd/MM/yyyy")}
                          {c.seu_numero && ` • #${c.seu_numero}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm">
                          R$ {Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex items-center gap-1 justify-end mt-1">
                          {c.boleto_url && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Abrir fatura"
                              asChild
                            >
                              <a href={c.boleto_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          {c.linha_digitavel && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Copiar linha digitável"
                              onClick={() => copy(c.linha_digitavel)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {c.pix_copia_cola && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="Copiar Pix copia-e-cola"
                              onClick={() => copy(c.pix_copia_cola)}
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setEmitirConta(c)}
                          >
                            Reemitir
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Nova Cobrança */}
      <NovaCobrancaDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        unidadeId={unidadeId}
        userId={user?.id}
        accentColor={accentColor}
        onCreated={(row) => {
          setNovaOpen(false);
          qc.invalidateQueries({ queryKey: ["cobrancas-conta", contaId] });
          // Abre dialog Asaas para emitir
          setEmitirConta(row as any);
        }}
      />

      {/* Dialog Emitir Asaas */}
      {emitirConta && (
        <EmitirBoletoAsaasDialog
          open={!!emitirConta}
          onOpenChange={(o) => !o && setEmitirConta(null)}
          conta={{
            id: emitirConta.id,
            cliente: emitirConta.cliente,
            descricao: emitirConta.descricao,
            valor: Number(emitirConta.valor),
            vencimento: emitirConta.vencimento,
            pedido_id: emitirConta.pedido_id,
            asaas_charge_id: emitirConta.asaas_charge_id,
            linha_digitavel: emitirConta.linha_digitavel,
            boleto_url: emitirConta.boleto_url,
            pix_qrcode: emitirConta.pix_qrcode,
            pix_copia_cola: emitirConta.pix_copia_cola,
            seu_numero: emitirConta.seu_numero,
          }}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["cobrancas-conta", contaId] })}
        />
      )}
    </div>
  );
}

/** Dialog para criar uma nova cobrança (cria contas_receber e depois abre dialog Asaas) */
function NovaCobrancaDialog({
  open, onOpenChange, unidadeId, userId, accentColor, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unidadeId: string | null;
  userId?: string;
  accentColor: string;
  onCreated: (row: any) => void;
}) {
  const [cliente, setCliente] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(() => format(new Date(Date.now() + 3 * 86400000), "yyyy-MM-dd"));
  const [salvando, setSalvando] = useState(false);

  const reset = () => {
    setCliente(""); setDescricao(""); setValor("");
    setVencimento(format(new Date(Date.now() + 3 * 86400000), "yyyy-MM-dd"));
  };

  const salvar = async () => {
    const v = parseFloat((valor || "").replace(",", "."));
    if (!cliente.trim()) return toast.error("Informe o cliente");
    if (!v || v <= 0) return toast.error("Valor inválido");
    if (!vencimento) return toast.error("Informe o vencimento");

    setSalvando(true);
    const { data, error } = await supabase
      .from("contas_receber")
      .insert({
        cliente: cliente.trim(),
        descricao: descricao.trim() || `Cobrança ${cliente.trim()}`,
        valor: v,
        vencimento,
        status: "pendente",
        unidade_id: unidadeId,
        origem: "cobranca_avulsa",
      } as any)
      .select()
      .maybeSingle();
    setSalvando(false);
    if (error || !data) {
      toast.error("Erro ao criar cobrança");
      console.error(error);
      return;
    }
    toast.success("Cobrança criada — agora emita no provedor");
    reset();
    onCreated(data);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
          <DialogDescription>
            Preencha os dados básicos. Depois você poderá emitir o boleto ou Pix.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Pedido #1234" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$) *</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento *</Label>
              <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} style={{ background: accentColor, color: "#fff" }}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Continuar para emissão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
