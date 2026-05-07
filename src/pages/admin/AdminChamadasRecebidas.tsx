import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Phone, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

interface Empresa {
  id: string;
  nome: string;
}

interface Chamada {
  id: string;
  telefone: string | null;
  did: string | null;
  cliente_nome: string | null;
  tipo: string;
  status: string;
  duracao_segundos: number | null;
  observacoes: string | null;
  empresa_id: string | null;
  unidade_id: string | null;
  created_at: string;
}

const TODOS = "todos";
const PERIODOS = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "todos", label: "Todos" },
];

function getStartDate(periodo: string): Date | null {
  const now = new Date();
  if (periodo === "hoje") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (periodo === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (periodo === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  if (periodo === "90d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    return d;
  }
  return null;
}

function formatPhone(p: string | null) {
  if (!p) return "—";
  const digits = p.replace(/\D/g, "");
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return p;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "atendida":
      return "default";
    case "perdida":
      return "destructive";
    case "retornar":
      return "secondary";
    default:
      return "outline";
  }
}

export default function AdminChamadasRecebidas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [chamadas, setChamadas] = useState<Chamada[]>([]);
  const [loading, setLoading] = useState(false);

  const [empresaId, setEmpresaId] = useState<string>(TODOS);
  const [did, setDid] = useState<string>(TODOS);
  const [periodo, setPeriodo] = useState<string>("7d");
  const [busca, setBusca] = useState<string>("");

  // Carrega empresas
  useEffect(() => {
    supabase
      .from("empresas")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => setEmpresas(data || []));
  }, []);

  // DIDs únicos disponíveis (a partir das chamadas carregadas)
  const didsDisponiveis = useMemo(() => {
    const set = new Set<string>();
    chamadas.forEach((c) => c.did && set.add(c.did));
    return Array.from(set).sort();
  }, [chamadas]);

  const carregarChamadas = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("chamadas_recebidas")
        .select(
          "id, telefone, did, cliente_nome, tipo, status, duracao_segundos, observacoes, empresa_id, unidade_id, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (empresaId !== TODOS) q = q.eq("empresa_id", empresaId);
      if (did !== TODOS) q = q.eq("did", did);

      const start = getStartDate(periodo);
      if (start) q = q.gte("created_at", start.toISOString());

      const { data, error } = await q;
      if (error) throw error;
      setChamadas(data || []);
    } catch (e: any) {
      toast.error("Erro ao carregar chamadas: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarChamadas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, did, periodo]);

  const empresaNome = useMemo(() => {
    const map = new Map(empresas.map((e) => [e.id, e.nome]));
    return (id: string | null) => (id ? map.get(id) || "—" : "—");
  }, [empresas]);

  const chamadasFiltradas = useMemo(() => {
    if (!busca.trim()) return chamadas;
    const t = busca.trim().toLowerCase();
    const digits = t.replace(/\D/g, "");
    return chamadas.filter((c) => {
      return (
        (c.cliente_nome && c.cliente_nome.toLowerCase().includes(t)) ||
        (c.telefone && (c.telefone.toLowerCase().includes(t) || (digits && c.telefone.replace(/\D/g, "").includes(digits)))) ||
        (c.did && (c.did.toLowerCase().includes(t) || (digits && c.did.replace(/\D/g, "").includes(digits))))
      );
    });
  }, [chamadas, busca]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Phone className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Chamadas Recebidas</h1>
            <p className="text-sm text-muted-foreground">
              Histórico de chamadas Twilio/Vonage por empresa, número e período.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={carregarChamadas} disabled={loading}>
          <RefreshCw className={"h-4 w-4 mr-2 " + (loading ? "animate-spin" : "")} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Número (DID)</Label>
              <Select value={did} onValueChange={setDid}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {didsDisponiveis.map((d) => (
                    <SelectItem key={d} value={d}>
                      {formatPhone(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Período</Label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODOS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Nome, telefone, DID..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {chamadasFiltradas.length} {chamadasFiltradas.length === 1 ? "chamada" : "chamadas"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>DID</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && chamadasFiltradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhuma chamada encontrada para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  chamadasFiltradas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(c.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">{empresaNome(c.empresa_id)}</TableCell>
                      <TableCell className="text-sm font-mono">{formatPhone(c.did)}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {formatPhone(c.telefone)}
                      </TableCell>
                      <TableCell className="text-sm">{c.cliente_nome || "—"}</TableCell>
                      <TableCell className="text-sm capitalize">{c.tipo}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(c.status)} className="capitalize">
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {c.duracao_segundos ? `${c.duracao_segundos}s` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
