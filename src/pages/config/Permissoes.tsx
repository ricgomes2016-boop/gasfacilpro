import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, Plus, Edit } from "lucide-react";

const perfis = [
  { id: 1, nome: "Administrador", usuarios: 2, permissoes: "Acesso total ao sistema" },
  { id: 2, nome: "Gestor", usuarios: 3, permissoes: "Gestão operacional, financeiro e relatórios" },
  { id: 3, nome: "Financeiro", usuarios: 2, permissoes: "Módulos financeiros e relatórios" },
  { id: 4, nome: "Operacional", usuarios: 8, permissoes: "Vendas, entregas e estoque" },
  { id: 5, nome: "Atendente", usuarios: 3, permissoes: "Vendas e cadastro de clientes" },
];

export default function Permissoes() {
  return (
    <MainLayout>
      <Header title="Permissões" subtitle="Gerencie perfis e acessos" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Perfil
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Perfis</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{perfis.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Usuários</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{perfis.reduce((a, p) => a + p.usuarios, 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Administradores</CardTitle>
              <Shield className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">2</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Perfis de Acesso</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Usuários</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perfis.map((perfil) => (
                  <TableRow key={perfil.id}>
                    <TableCell className="font-medium">{perfil.nome}</TableCell>
                    <TableCell><Badge variant="secondary">{perfil.usuarios}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{perfil.permissoes}</TableCell>
                    <TableCell><Switch defaultChecked /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                    </TableCell>
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
