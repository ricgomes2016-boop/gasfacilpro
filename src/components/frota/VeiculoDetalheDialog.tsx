import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Fuel, Wrench, FileWarning, DollarSign, Calendar, TrendingUp, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VeiculoDetalheDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  veiculo: {
    id: string;
    placa: string;
    modelo: string;
    marca: string | null;
    ano: number | null;
    km_atual: number | null;
    valor_fipe: number | null;
    crlv_vencimento?: string | null;
    seguro_vencimento?: string | null;
    seguro_empresa?: string | null;
  } | null;
}

interface Manutencao {
  id: string; tipo: string; descricao: string; oficina: string; data: string; valor: number; status: string;
}
interface Abastecimento {
  id: string; data: string; litros: number; valor: number; km: number; motorista: string; posto: string | null;
}
interface Multa {
  id: string; data_infracao: string; descricao: string; valor: number; pontos: number; status: string; responsavel: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string | null) {
  if (!d) return "—";
  const date = parseISO(d);
  return isValid(date) ? format(date, "dd/MM/yyyy") : "—";
}

export function VeiculoDetalheDialog({ open, onOpenChange, veiculo }: VeiculoDetalheDialogProps) {
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [multas, setMultas] = useState<Multa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !veiculo) return;
    setLoading(true);
    Promise.all([
      supabase.from("manutencoes").select("id, tipo, descricao, oficina, data, valor, status").eq("veiculo_id", veiculo.id).order("data", { ascending: false }).limit(50),
      supabase.from("abastecimentos").select("id, data, litros, valor, km, motorista, posto").eq("veiculo_id", veiculo.id).order("data", { ascending: false }).limit(50),
      supabase.from("multas_frota").select("id, data_infracao, descricao, valor, pontos, status, responsavel").eq("veiculo_id", veiculo.id).order("data_infracao", { ascending: false }).limit(50),
    ]).then(([m, a, mu]) => {
      setManutencoes((m.data || []) as Manutencao[]);
      setAbastecimentos((a.data || []) as Abastecimento[]);
      setMultas((mu.data || []) as Multa[]);
      setLoading(false);
    });
  }, [open, veiculo?.id]);

  // === ALERTAS ===
  const alertas = useMemo(() => {
    if (!veiculo) return [];
    const list: { tipo: string; msg: string; nivel: "critico" | "atencao" | "ok" }[] = [];
    const hoje = new Date();

    const checkDate = (label: string, dateStr: string | null | undefined) => {
      if (!dateStr) {
        list.push({ tipo: label, msg: `${label} sem data definida`, nivel: "atencao" });
        return;
      }
      const d = parseISO(dateStr);
      if (!isValid(d)) return;
      const dias = differenceInDays(d, hoje);
      if (dias < 0) list.push({ tipo: label, msg: `${label} vencido há ${Math.abs(dias)} dias`, nivel: "critico" });
      else if (dias <= 30) list.push({ tipo: label, msg: `${label} vence em ${dias} dias`, nivel: "atencao" });
      else list.push({ tipo: label, msg: `${label} válido até ${formatDate(dateStr)}`, nivel: "ok" });
    };

    checkDate("CRLV", veiculo.crlv_vencimento);
    checkDate("Seguro", veiculo.seguro_vencimento);

    return list;
  }, [veiculo]);

  // === TCO ===
  const tco = useMemo(() => {
    const totalCombustivel = abastecimentos.reduce((s, a) => s + Number(a.valor), 0);
    const totalManutencao = manutencoes.reduce((s, m) => s + Number(m.valor), 0);
    const totalMultas = multas.reduce((s, m) => s + Number(m.valor), 0);
    const total = totalCombustivel + totalManutencao + totalMultas;
    const kmTotal = abastecimentos.length > 1
      ? Math.max(...abastecimentos.map(a => a.km)) - Math.min(...abastecimentos.map(a => a.km))
      : 0;
    const litrosTotal = abastecimentos.reduce((s, a) => s + Number(a.litros), 0);
    const kmPorLitro = litrosTotal > 0 && kmTotal > 0 ? (kmTotal / litrosTotal) : 0;
    const custoPorKm = kmTotal > 0 ? total / kmTotal : 0;

    return { totalCombustivel, totalManutencao, totalMultas, total, kmPorLitro, custoPorKm, kmTotal };
  }, [abastecimentos, manutencoes, multas]);

  // === HISTÓRICO UNIFICADO ===
  const historico = useMemo(() => {
    const items: { data: string; tipo: string; descricao: string; valor: number }[] = [];
    manutencoes.forEach(m => items.push({ data: m.data, tipo: "Manutenção", descricao: `${m.tipo} - ${m.descricao}`, valor: m.valor }));
    abastecimentos.forEach(a => items.push({ data: a.data, tipo: "Combustível", descricao: `${a.litros}L - ${a.posto || a.motorista}`, valor: a.valor }));
    multas.forEach(m => items.push({ data: m.data_infracao, tipo: "Multa", descricao: m.descricao, valor: m.valor }));
    items.sort((a, b) => b.data.localeCompare(a.data));
    return items;
  }, [manutencoes, abastecimentos, multas]);

  if (!veiculo) return null;

  const alertNivelColor = (n: string) => {
    if (n === "critico") return "bg-destructive/10 text-destructive border-destructive/30";
    if (n === "atencao") return "bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700";
    return "bg-green-50 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-lg">{veiculo.placa}</span>
            <span className="text-muted-foreground font-normal">— {veiculo.marca} {veiculo.modelo} {veiculo.ano || ""}</span>
          </DialogTitle>
          <DialogDescription>Detalhes, alertas, custos e histórico do veículo</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground py-8 text-center">Carregando dados...</p>
        ) : (
          <Tabs defaultValue="alertas" className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="alertas" className="gap-1">
                <AlertTriangle className="h-4 w-4" /> Alertas
                {alertas.filter(a => a.nivel !== "ok").length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{alertas.filter(a => a.nivel !== "ok").length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tco" className="gap-1"><DollarSign className="h-4 w-4" /> TCO</TabsTrigger>
              <TabsTrigger value="historico" className="gap-1"><Calendar className="h-4 w-4" /> Histórico</TabsTrigger>
            </TabsList>

            {/* ALERTAS */}
            <TabsContent value="alertas" className="space-y-3 mt-4">
              {alertas.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhum alerta</p>
              ) : (
                alertas.map((a, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${alertNivelColor(a.nivel)}`}>
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{a.tipo}</p>
                      <p className="text-sm">{a.msg}</p>
                    </div>
                  </div>
                ))
              )}
              {veiculo.seguro_empresa && (
                <p className="text-xs text-muted-foreground">Seguradora: {veiculo.seguro_empresa}</p>
              )}
            </TabsContent>

            {/* TCO */}
            <TabsContent value="tco" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Fuel className="h-3 w-3" /> Combustível</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <p className="text-lg font-bold">{formatCurrency(tco.totalCombustivel)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Wrench className="h-3 w-3" /> Manutenção</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <p className="text-lg font-bold">{formatCurrency(tco.totalManutencao)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><FileWarning className="h-3 w-3" /> Multas</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <p className="text-lg font-bold">{formatCurrency(tco.totalMultas)}</p>
                  </CardContent>
                </Card>
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> TCO Total</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <p className="text-lg font-bold text-primary">{formatCurrency(tco.total)}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card>
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs text-muted-foreground">KM/L Médio</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <p className="text-lg font-bold">{tco.kmPorLitro > 0 ? tco.kmPorLitro.toFixed(1) : "—"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs text-muted-foreground">Custo/KM</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <p className="text-lg font-bold">{tco.custoPorKm > 0 ? formatCurrency(tco.custoPorKm) : "—"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs text-muted-foreground">KM Rodados</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <p className="text-lg font-bold">{tco.kmTotal > 0 ? tco.kmTotal.toLocaleString("pt-BR") : "—"}</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* HISTÓRICO */}
            <TabsContent value="historico" className="mt-4">
              {historico.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum registro encontrado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.slice(0, 50).map((h, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap">{formatDate(h.data)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {h.tipo === "Combustível" && <Fuel className="h-3 w-3" />}
                            {h.tipo === "Manutenção" && <Wrench className="h-3 w-3" />}
                            {h.tipo === "Multa" && <FileWarning className="h-3 w-3" />}
                            {h.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{h.descricao}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(h.valor))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
