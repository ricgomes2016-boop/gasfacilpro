import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, MapPin, Edit, Trash2, Eye, Building2, Smartphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClienteDB, ClienteForm } from "@/hooks/useClientes";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ClienteTagsBadges } from "./ClienteTagsBadges";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  clientes: ClienteDB[];
  loading: boolean;
  onEdit: (cliente: ClienteDB) => void;
  onDelete: (id: string) => void;
  onManageUnidades?: (cliente: ClienteDB) => void;
}

export function ClienteTable({ clientes, loading, onEdit, onDelete, onManageUnidades }: Props) {
  const navigate = useNavigate();
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const formatEndereco = (c: ClienteDB) => {
    const parts = [c.endereco, c.numero].filter(Boolean);
    return parts.join(", ") || "-";
  };

  const formatUltimaCompra = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy");
    } catch {
      return "-";
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border/40">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/50 hover:bg-transparent">
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Telefone</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Endereço</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nº</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bairro</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Última Compra</TableHead>
            <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pedidos</TableHead>
            <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">App</TableHead>
            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                Nenhum cliente encontrado.
              </TableCell>
            </TableRow>
          ) : (
            clientes.map((cliente) => (
              <TableRow key={cliente.id} className="border-b border-border/30 last:border-b-0">
                <TableCell className="font-medium py-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{cliente.nome}</span>
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 border-success/30 bg-success/10 text-success-foreground font-medium">
                        Ativo
                      </Badge>
                      {cliente.tipo && cliente.tipo !== "residencial" && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 border-primary/30 bg-primary/10 text-primary font-medium">
                          {cliente.tipo}
                        </Badge>
                      )}
                    </div>
                    <ClienteTagsBadges clienteId={cliente.id} />
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  {cliente.telefone ? (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm">{cliente.telefone}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex items-center gap-1.5 max-w-[200px]">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{cliente.endereco || "-"}</span>
                    {cliente.latitude && <span className="text-[10px]">📍</span>}
                  </div>
                </TableCell>
                <TableCell className="text-sm py-3">{cliente.numero || "-"}</TableCell>
                <TableCell className="py-3">
                  {cliente.bairro ? (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 border-muted-foreground/25 bg-muted/40 text-muted-foreground font-medium">
                      {cliente.bairro}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm py-3">{formatUltimaCompra(cliente.ultimo_pedido)}</TableCell>
                <TableCell className="text-center py-3">
                  <Badge variant="outline" className="text-xs px-2 py-0.5 h-5 font-medium border-border/60">
                    {cliente.total_pedidos || 0}
                  </Badge>
                </TableCell>
                <TableCell className="text-center py-3">
                  {cliente.cadastro_app ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="gap-1 text-[10px] px-2 py-0.5 h-5 border-info/30 bg-info/10 text-info font-medium">
                          <Smartphone className="h-3 w-3" />
                          App
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>Cadastrado pelo aplicativo</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/clientes/cadastro/${cliente.id}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onManageUnidades && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onManageUnidades(cliente)}>
                            <Building2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Unidades do cliente</TooltipContent>
                      </Tooltip>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(cliente)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O cliente "{cliente.nome}" será desativado. Esta ação pode ser revertida.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(cliente.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
