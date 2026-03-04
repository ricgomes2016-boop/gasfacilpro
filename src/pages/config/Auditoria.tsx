import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Shield, User, FileText, Clock } from "lucide-react";

const logs = [
  { id: 1, usuario: "admin@gasexpress.com", acao: "Login no sistema", modulo: "Autenticação", ip: "192.168.1.100", data: "2024-01-16 14:32:15" },
  { id: 2, usuario: "joao.silva@gasexpress.com", acao: "Criou nova venda #1234", modulo: "Vendas", ip: "192.168.1.101", data: "2024-01-16 14:28:00" },
  { id: 3, usuario: "admin@gasexpress.com", acao: "Alterou permissões de usuário", modulo: "Configurações", ip: "192.168.1.100", data: "2024-01-16 14:15:30" },
  { id: 4, usuario: "maria.santos@gasexpress.com", acao: "Exportou relatório de vendas", modulo: "Relatórios", ip: "192.168.1.102", data: "2024-01-16 13:45:00" },
  { id: 5, usuario: "admin@gasexpress.com", acao: "Cadastrou novo funcionário", modulo: "RH", ip: "192.168.1.100", data: "2024-01-16 12:30:00" },
];

export default function Auditoria() {
  return (
    <MainLayout>
      <Header title="Auditoria" subtitle="Histórico de ações do sistema" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ações Hoje</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">156</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
              <User className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">8</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Alertas</CardTitle>
              <Shield className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Último Acesso</CardTitle>
              <Clock className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Agora</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Log de Atividades</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-10 w-[250px]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.data}</TableCell>
                    <TableCell className="font-medium">{log.usuario}</TableCell>
                    <TableCell>{log.acao}</TableCell>
                    <TableCell><Badge variant="outline">{log.modulo}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{log.ip}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
