import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Bot, CheckCircle2, Clock, Search, ShieldAlert, XCircle } from "lucide-react";

type AiActionLog = {
  id: string;
  user_id: string;
  empresa_id: string | null;
  unidade_id: string | null;
  action: string;
  params: Record<string, unknown>;
  result: string | null;
  success: boolean;
  created_at: string;
};

export default function Auditoria() {
  const [busca, setBusca] = useState("");
  const [logsIa, setLogsIa] = useState<AiActionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchLogsIa();
  }, []);

  const fetchLogsIa = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("ai_action_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogsIa((data || []) as AiActionLog[]);
    setLoading(false);
  };

  const logsFiltrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return logsIa;
    return logsIa.filter((log) =>
      [log.action, log.result, log.user_id, log.unidade_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [busca, logsIa]);

  const totalHoje = useMemo(() => {
    const hoje = new Date().toLocaleDateString("pt-BR");
    return logsIa.filter((log) => new Date(log.created_at).toLocaleDateString("pt-BR") === hoje).length;
  }, [logsIa]);

  const falhas = logsIa.filter((log) => !log.success).length;
  const ultimaAcao = logsIa[0]?.created_at ? new Date(logsIa[0].created_at).toLocaleString("pt-BR") : "Sem registros";

  return (
    <MainLayout>
      <Header title="Auditoria" subtitle="Histórico de ações sensíveis do sistema" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ações IA Hoje</CardTitle>
              <Bot className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHoje}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Executadas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{logsIa.filter((log) => log.success).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Falhas</CardTitle>
              <ShieldAlert className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{falhas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Última Ação</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-semibold">{ultimaAcao}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Ações do Assistente IA</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Cadastros, atualizações e registros executados pela IA.</p>
              </div>
              <div className="relative w-full md:w-[320px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ação, usuário ou resultado..." className="pl-10" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Carregando auditoria...</TableCell>
                    </TableRow>
                  )}
                  {!loading && logsFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhuma ação registrada.</TableCell>
                    </TableRow>
                  )}
                  {logsFiltrados.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="font-medium">{log.action}</TableCell>
                      <TableCell>
                        <Badge variant={log.success ? "default" : "destructive"} className="gap-1">
                          {log.success ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {log.success ? "Sucesso" : "Falha"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-muted-foreground">{log.user_id}</TableCell>
                      <TableCell className="max-w-[420px] truncate">{log.result || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
