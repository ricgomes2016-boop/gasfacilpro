import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  MapPin,
  Smartphone,
  ShoppingCart,
  History,
  Building2,
  Edit,
  Check,
  X,
  MoreHorizontal,
  MessageCircle,
  Copy,
} from "lucide-react";

interface Cliente {
  id: string;
  codigo_cliente?: number | null;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado?: string | null;
  tipo: string | null;
  ativo: boolean | null;
  cadastro_app?: boolean;
}

interface ClientesListProps {
  clientes: Cliente[];
  selectedMergeIds: Set<string>;
  onToggleMerge: (id: string) => void;
  onEdit: (cliente: Cliente) => void;
  onToggleStatus: (cliente: Cliente) => void;
  onVenda: (cliente: Cliente) => void;
  onHistorico: (cliente: Cliente) => void;
  onUnidades: (cliente: Cliente) => void;
}

function tipoLabel(tipo: string | null) {
  if (!tipo) return "N/E";
  const map: Record<string, string> = {
    residencial: "Residencial",
    comercial: "Comercial",
    revendedor: "Revendedor",
    industrial: "Industrial",
    condominio: "Condomínio",
  };
  return map[tipo] || tipo;
}

function telefoneHref(tel: string) {
  const num = tel.replace(/\D/g, "");
  if (num.length < 10) return null;
  return `tel:+55${num}`;
}

function whatsappHref(tel: string) {
  const num = tel.replace(/\D/g, "");
  if (num.length < 10) return null;
  return `https://wa.me/55${num}`;
}

function copyToClipboard(text: string) {
  if (!text) return;
  navigator.clipboard.writeText(text).catch(() => {});
}

export function ClientesList({
  clientes,
  selectedMergeIds,
  onToggleMerge,
  onEdit,
  onToggleStatus,
  onVenda,
  onHistorico,
  onUnidades,
}: ClientesListProps) {
  const allSelected = clientes.length > 0 && clientes.every((c) => selectedMergeIds.has(c.id));

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {clientes.map((cliente) => {
          const telLink = cliente.telefone ? telefoneHref(cliente.telefone) : null;
          const waLink = cliente.telefone ? whatsappHref(cliente.telefone) : null;
          const enderecoCompleto = [cliente.endereco, cliente.numero, cliente.bairro]
            .filter(Boolean)
            .join(", ");

          return (
            <div key={cliente.id} className="mobile-record-card">
              <div className="mobile-record-card-header">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Checkbox
                    checked={selectedMergeIds.has(cliente.id)}
                    onCheckedChange={() => onToggleMerge(cliente.id)}
                    className="mt-0.5"
                    aria-label={`Selecionar ${cliente.nome}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      {cliente.codigo_cliente ? (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                          #{cliente.codigo_cliente}
                        </span>
                      ) : null}
                      <h3 className="mobile-record-card-title line-clamp-2">{cliente.nome}</h3>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={cliente.ativo ? "default" : "destructive"}
                        className="h-5 rounded-full px-2 text-[10px] font-medium"
                      >
                        {cliente.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      {cliente.tipo ? (
                        <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px] font-medium capitalize">
                          {tipoLabel(cliente.tipo)}
                        </Badge>
                      ) : null}
                      {cliente.cadastro_app ? (
                        <Badge variant="secondary" className="h-5 gap-1 rounded-full px-2 text-[10px] font-medium">
                          <Smartphone className="h-3 w-3" />
                          App
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-1 gap-1.5">
                {cliente.telefone ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-foreground">{cliente.telefone}</span>
                    <div className="ml-auto flex items-center gap-1">
                      {telLink ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={telLink} aria-label="Ligar">
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ) : null}
                      {waLink ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-success" asChild>
                          <a href={waLink} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => copyToClipboard(cliente.telefone || "")}
                        aria-label="Copiar telefone"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : null}
                {enderecoCompleto ? (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2 min-w-0 break-words">{enderecoCompleto}</span>
                  </div>
                ) : null}
              </div>

              <div className="mobile-record-card-footer">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs font-medium"
                  onClick={() => onVenda(cliente)}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Venda
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs font-medium"
                  onClick={() => onHistorico(cliente)}
                >
                  <History className="h-3.5 w-3.5" />
                  Histórico
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs font-medium"
                  onClick={() => onUnidades(cliente)}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Unidades
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => onEdit(cliente)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleStatus(cliente)}>
                      {cliente.ativo ? (
                        <>
                          <X className="mr-2 h-4 w-4 text-destructive" />
                          <span className="text-destructive">Inativar</span>
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4 text-success" />
                          <span className="text-success">Ativar</span>
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card">
        <div className="app-table-wrap overflow-x-auto">
          <Table className="saas-table">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        clientes.forEach((c) => selectedMergeIds.add(c.id));
                      } else {
                        clientes.forEach((c) => selectedMergeIds.delete(c.id));
                      }
                      // Force re-render by creating a new Set from the mutated one
                      onToggleMerge("");
                    }}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead className="w-[88px]">Código</TableHead>
                <TableHead className="min-w-[200px]">Cliente</TableHead>
                <TableHead className="w-[150px]">Telefone</TableHead>
                <TableHead className="min-w-[180px]">Endereço</TableHead>
                <TableHead className="w-[120px]">Bairro</TableHead>
                <TableHead className="w-[110px]">Tipo</TableHead>
                <TableHead className="w-[80px] text-center">App</TableHead>
                <TableHead className="w-[80px] text-center">Status</TableHead>
                <TableHead className="w-[110px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente) => {
                const telLink = cliente.telefone ? telefoneHref(cliente.telefone) : null;
                const waLink = cliente.telefone ? whatsappHref(cliente.telefone) : null;

                return (
                  <TableRow
                    key={cliente.id}
                    data-state={selectedMergeIds.has(cliente.id) ? "selected" : undefined}
                    className="group transition-colors"
                  >
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selectedMergeIds.has(cliente.id)}
                        onCheckedChange={() => onToggleMerge(cliente.id)}
                        aria-label={`Selecionar ${cliente.nome}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {cliente.codigo_cliente ? `#${cliente.codigo_cliente}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold text-foreground">{cliente.nome}</span>
                        {cliente.email ? (
                          <span className="truncate text-xs text-muted-foreground">{cliente.email}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {cliente.telefone ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium">{cliente.telefone}</span>
                          <div className="ml-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            {telLink ? (
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={telLink} aria-label="Ligar">
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            ) : null}
                            {waLink ? (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-success" asChild>
                                <a href={waLink} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyToClipboard(cliente.telefone || "")}
                              aria-label="Copiar telefone"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm">
                          {[cliente.endereco, cliente.numero].filter(Boolean).join(", ") || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {cliente.bairro ? (
                        <Badge variant="secondary" className="truncate font-normal">
                          {cliente.bairro}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {tipoLabel(cliente.tipo)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {cliente.cadastro_app ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Smartphone className="h-3 w-3" />
                          Sim
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={cliente.ativo ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {cliente.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Lançar venda"
                          onClick={() => onVenda(cliente)}
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Histórico"
                          onClick={() => onHistorico(cliente)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Unidades"
                          onClick={() => onUnidades(cliente)}
                        >
                          <Building2 className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => onEdit(cliente)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onToggleStatus(cliente)}>
                              {cliente.ativo ? (
                                <>
                                  <X className="mr-2 h-4 w-4 text-destructive" />
                                  <span className="text-destructive">Inativar</span>
                                </>
                              ) : (
                                <>
                                  <Check className="mr-2 h-4 w-4 text-success" />
                                  <span className="text-success">Ativar</span>
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
