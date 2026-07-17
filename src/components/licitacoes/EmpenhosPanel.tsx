import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Link2, Eye, FileText, Filter, Upload } from "lucide-react";
import { NovoEmpenhoModal, type NovoEmpenhoInitialData } from "./NovoEmpenhoModal";
import { VincularValesModal } from "./VincularValesModal";
import { EmpenhoDetalheDialog } from "./EmpenhoDetalheDialog";
import { ImportarEmpenhoDialog, type EmpenhoExtraido } from "./ImportarEmpenhoDialog";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";

export interface Empenho {
  id: string;
  numero_empenho: string;
  data_empenho: string;
  parceiro_id: string;
  licitacao_id: string | null;
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  quantidade_entregue: number;
  valor_unitario: number;
  valor_total: number;
  status: "aberto" | "parcial" | "concluido" | "cancelado";
  nfe_numero: string | null;
  nfe_status: string | null;
  observacoes: string | null;
  unidade_id: string;
  empresa_id: string | null;
  parceiro?: { nome: string };
}

const STATUS_COLOR: Record<string, string> = {
  aberto: "bg-info text-info",
  parcial: "bg-warning text-warning",
  concluido: "bg-success text-success",
  cancelado: "bg-destructive text-destructive",
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

export function EmpenhosPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [novoOpen, setNovoOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dadosImportados, setDadosImportados] = useState<NovoEmpenhoInitialData | null>(null);
  const [vincularEmp, setVincularEmp] = useState<Empenho | null>(null);
  const [detalheEmp, setDetalheEmp] = useState<Empenho | null>(null);

  const { unidadeAtual } = useUnidade() as any;
  const { empresa } = useEmpresa() as any;
  const unidadeId = unidadeAtual?.id ?? null;
  const empresaId = empresa?.id ?? null;

  const { data: empenhos = [], isLoading } = useQuery({
    queryKey: ["empenhos", unidadeId, empresaId],
    enabled: !!(unidadeId || empresaId),
    queryFn: async () => {
      let q = (supabase as any)
        .from("empenhos")
        .select("*, parceiro:vale_gas_parceiros(nome)")
        .order("created_at", { ascending: false });
      if (unidadeId) q = q.eq("unidade_id", unidadeId);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Empenho[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return empenhos.filter((e) => {
      if (filterStatus !== "todos" && e.status !== filterStatus) return false;
      if (!term) return true;
      return (
        e.numero_empenho.toLowerCase().includes(term) ||
        e.parceiro?.nome?.toLowerCase().includes(term) ||
        e.produto_nome?.toLowerCase().includes(term)
      );
    });
  }, [empenhos, search, filterStatus]);

  const stats = useMemo(() => {
    const aberto = empenhos.filter((e) => e.status === "aberto" || e.status === "parcial").length;
    const concluido = empenhos.filter((e) => e.status === "concluido").length;
    const totalQtd = empenhos.reduce((s, e) => s + (e.quantidade || 0), 0);
    const totalEntregue = empenhos.reduce((s, e) => s + (e.quantidade_entregue || 0), 0);
    const valor = empenhos.reduce((s, e) => s + Number(e.valor_total || 0), 0);
    return { aberto, concluido, totalQtd, totalEntregue, valor };
  }, [empenhos]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["empenhos"] });
    qc.invalidateQueries({ queryKey: ["vale-gas"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Em andamento</p>
            <p className="text-2xl font-bold">{stats.aberto}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Concluídos</p>
            <p className="text-2xl font-bold">{stats.concluido}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Entregue / Total</p>
            <p className="text-2xl font-bold">{stats.totalEntregue}/{stats.totalQtd}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Valor empenhado</p>
            <p className="text-base font-bold">{fmtBRL(stats.valor)}</p>
          </CardContent></Card>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 self-start">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2" disabled={!unidadeId} title={!unidadeId ? "Selecione uma unidade" : undefined}>
            <Upload className="h-4 w-4" /> Importar Empenho
          </Button>
          <Button onClick={() => { setDadosImportados(null); setNovoOpen(true); }} className="gap-2" disabled={!unidadeId} title={!unidadeId ? "Selecione uma unidade" : undefined}>
            <Plus className="h-4 w-4" /> Novo Empenho
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nº empenho, parceiro ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-52">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Empenho</TableHead>
                <TableHead>Parceiro</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Entregue</TableHead>
                <TableHead className="w-40">Progresso</TableHead>
                <TableHead>NF-e</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum empenho encontrado</TableCell></TableRow>
              )}
              {filtered.map((e) => {
                const pct = e.quantidade > 0 ? (e.quantidade_entregue / e.quantidade) * 100 : 0;
                const temVales = e.quantidade_entregue > 0 || e.status !== "aberto";
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono font-semibold">{e.numero_empenho}</TableCell>
                    <TableCell>{e.parceiro?.nome ?? "—"}</TableCell>
                    <TableCell>{e.produto_nome}</TableCell>
                    <TableCell className="text-right">{e.quantidade}</TableCell>
                    <TableCell className="text-right">{e.quantidade_entregue}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2" />
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {e.nfe_numero ? (
                        <Badge variant="outline" className="gap-1">
                          <FileText className="h-3 w-3" />{e.nfe_numero}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLOR[e.status]}>{e.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!temVales && e.status !== "cancelado" && (
                          <Button size="sm" variant="outline" onClick={() => setVincularEmp(e)} className="gap-1">
                            <Link2 className="h-3.5 w-3.5" /> Vincular Vales
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setDetalheEmp(e)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NovoEmpenhoModal
        open={novoOpen}
        onClose={() => { setNovoOpen(false); setDadosImportados(null); }}
        onCreated={refresh}
        initialData={dadosImportados}
      />
      <ImportarEmpenhoDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onParsed={(d: EmpenhoExtraido) => {
          const itens = d.itens && d.itens.length > 0
            ? d.itens.map((it) => ({
                produto_id: it.produto_id_sugerido,
                quantidade: it.quantidade,
                valor_unitario: it.valor_unitario,
              }))
            : [{
                produto_id: d.produto_id_sugerido,
                quantidade: d.quantidade,
                valor_unitario: d.valor_unitario,
              }];
          setDadosImportados({
            numero_empenho: d.numero_empenho,
            data_empenho: d.data_empenho || undefined,
            parceiro_id: d.parceiro_id_sugerido,
            observacoes: d.observacoes,
            itens,
          });
          setImportOpen(false);
          setNovoOpen(true);
        }}
      />
      <VincularValesModal
        empenho={vincularEmp}
        onClose={() => setVincularEmp(null)}
        onDone={refresh}
      />
      <EmpenhoDetalheDialog empenho={detalheEmp} onClose={() => setDetalheEmp(null)} />
    </div>
  );
}
