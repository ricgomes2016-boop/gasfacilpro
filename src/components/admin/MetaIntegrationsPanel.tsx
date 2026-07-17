import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, AlertCircle, Facebook, Instagram } from "lucide-react";

// Cores semânticas: green/pink/blue/amber são tokens utilitários do tailwind
// usados consistentemente em toda a base para indicar status (ok/social/alert).

export function MetaIntegrationsPanel() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-meta-integrations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("social_accounts")
        .select("id, empresa_id, nome_conta, plataforma, token_expires_at, ativo, created_at, empresas:empresa_id(nome)")
        .eq("conectado_via", "oauth")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrações Meta (OAuth) por empresa</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta conectada via OAuth ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Token expira</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => {
                const expDate = r.token_expires_at ? new Date(r.token_expires_at) : null;
                const dias = expDate ? Math.floor((expDate.getTime() - Date.now()) / 86400000) : null;
                const expiraLogo = dias !== null && dias < 7;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.empresas?.nome ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {r.plataforma === "instagram" ? (
                          <Instagram className="h-4 w-4 text-primary" />
                        ) : (
                          <Facebook className="h-4 w-4 text-info" />
                        )}
                        {r.plataforma}
                      </div>
                    </TableCell>
                    <TableCell>{r.nome_conta}</TableCell>
                    <TableCell>
                      {expDate ? (
                        <span className={expiraLogo ? "text-warning font-medium" : ""}>
                          {format(expDate, "dd/MM/yyyy", { locale: ptBR })}
                          {dias !== null && ` (${dias}d)`}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.ativo ? (
                        <Badge className="gap-1 bg-success/15 text-success dark:text-success border border-success/30">
                          <CheckCircle2 className="h-3 w-3" /> Ativa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-destructive border-destructive/40">
                          <AlertCircle className="h-3 w-3" /> Inativa
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
