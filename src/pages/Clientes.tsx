import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Download, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useClientes, type ClienteDB, type ClienteForm } from "@/hooks/useClientes";
import { ClienteTable } from "@/components/clientes/ClienteTable";
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import { ClienteUnidadesDialog } from "@/components/clientes/ClienteUnidadesDialog";
import { useUnidade } from "@/contexts/UnidadeContext";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

export default function Clientes() {
  const {
    clientes, loading, busca, setBusca, filtroBairro, setFiltroBairro,
    bairros, page, setPage, totalPages, totalCount,
    salvarCliente, excluirCliente, emptyForm, fetchClientes,
  } = useClientes();
  const { unidadeAtual } = useUnidade();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{ form: ClienteForm; id?: string }>({ form: emptyForm });
  const [unidadesDialogOpen, setUnidadesDialogOpen] = useState(false);
  const [unidadesCliente, setUnidadesCliente] = useState<{ id: string; nome: string } | null>(null);

  const handleNovo = () => {
    setEditData({ form: emptyForm });
    setDialogOpen(true);
  };

  const handleEdit = (c: ClienteDB) => {
    setEditData({
      form: {
        nome: c.nome,
        telefone: c.telefone || "",
        email: c.email || "",
        cpf: c.cpf || "",
        endereco: c.endereco || "",
        numero: c.numero || "",
        bairro: c.bairro || "",
        cidade: c.cidade || "",
        cep: c.cep || "",
        tipo: c.tipo || "residencial",
        latitude: c.latitude,
        longitude: c.longitude,
      },
      id: c.id,
    });
    setDialogOpen(true);
  };

  const exportExcel = () => {
    const rows = clientes.map((c) => ({
      Nome: c.nome,
      Telefone: c.telefone || "",
      Email: c.email || "",
      CPF: c.cpf || "",
      Endereço: c.endereco || "",
      Número: c.numero || "",
      Bairro: c.bairro || "",
      Cidade: c.cidade || "",
      CEP: c.cep || "",
      Tipo: c.tipo || "",
      Pedidos: c.total_pedidos || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "clientes.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Lista de Clientes", 14, 20);
    doc.setFontSize(10);
    doc.text(`Total: ${totalCount} clientes`, 14, 28);

    autoTable(doc, {
      startY: 34,
      head: [["Nome", "Telefone", "Endereço", "Nº", "Bairro", "Pedidos"]],
      body: clientes.map((c) => [
        c.nome,
        c.telefone || "-",
        c.endereco || "-",
        c.numero || "-",
        c.bairro || "-",
        String(c.total_pedidos || 0),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save("clientes.pdf");
  };

  // CSV Import
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<ClienteForm[]>([]);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error("CSV vazio ou sem dados.");
        return;
      }

      const headers = lines[0].split(";").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
      const nomeIdx = headers.findIndex((h) => ["nome", "name", "cliente"].includes(h));
      if (nomeIdx === -1) {
        toast.error("CSV deve conter coluna 'Nome'.");
        return;
      }

      const getIdx = (...keys: string[]) => headers.findIndex((h) => keys.includes(h));
      const telIdx = getIdx("telefone", "tel", "phone", "celular", "fone");
      const emailIdx = getIdx("email", "e-mail");
      const cpfIdx = getIdx("cpf", "cnpj", "cpf/cnpj");
      const endIdx = getIdx("endereco", "endereço", "rua", "logradouro");
      const numIdx = getIdx("numero", "número", "num", "nº", "no");
      const bairroIdx = getIdx("bairro");
      const cidadeIdx = getIdx("cidade");
      const cepIdx = getIdx("cep");
      const tipoIdx = getIdx("tipo");

      const col = (row: string[], idx: number) => (idx >= 0 ? (row[idx] || "").replace(/"/g, "").trim() : "");

      const parsed: ClienteForm[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(";").map((c) => c.trim());
        const nome = col(row, nomeIdx);
        if (!nome) continue;
        parsed.push({
          nome,
          telefone: col(row, telIdx),
          email: col(row, emailIdx),
          cpf: col(row, cpfIdx),
          endereco: col(row, endIdx),
          numero: col(row, numIdx),
          bairro: col(row, bairroIdx),
          cidade: col(row, cidadeIdx),
          cep: col(row, cepIdx),
          tipo: col(row, tipoIdx) || "residencial",
          latitude: null,
          longitude: null,
        });
      }

      if (parsed.length === 0) {
        toast.error("Nenhum cliente encontrado no CSV.");
        return;
      }

      setCsvPreview(parsed);
      setCsvDialogOpen(true);
    };
    reader.readAsText(file, "UTF-8");
  };

  const importCsv = async () => {
    if (csvPreview.length === 0 || !unidadeAtual) return;
    setImporting(true);
    try {
      const rows = csvPreview.map((c) => ({
        nome: c.nome,
        telefone: c.telefone || null,
        email: c.email || null,
        cpf: c.cpf || null,
        endereco: c.endereco || null,
        numero: c.numero || null,
        bairro: c.bairro || null,
        cidade: c.cidade || null,
        cep: c.cep || null,
        tipo: c.tipo || "residencial",
      }));

      const { data: insertedClientes, error } = await supabase
        .from("clientes")
        .insert(rows)
        .select("id");
      if (error) throw error;

      // Associate all imported clients with the current unidade
      if (insertedClientes && insertedClientes.length > 0) {
        const cuRows = insertedClientes.map((c: any) => ({
          cliente_id: c.id,
          unidade_id: unidadeAtual.id,
        }));
        await supabase.from("cliente_unidades").insert(cuRows);
      }

      toast.success(`${rows.length} cliente(s) importado(s) com sucesso!`);
      setCsvDialogOpen(false);
      setCsvPreview([]);
      fetchClientes();
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err.message || "erro desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <MainLayout>
      <Header title="Clientes" subtitle="Gerencie seus clientes" />
      <div className="p-3 sm:p-4 md:p-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {totalCount} cliente{totalCount !== 1 ? "s" : ""}
                </Badge>
                <Select value={filtroBairro} onValueChange={setFiltroBairro}>
                  <SelectTrigger className="w-40 h-9 text-xs">
                    <SelectValue placeholder="Filtrar bairro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os bairros</SelectItem>
                    {bairros.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="w-60 pl-9 h-9"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="mr-1.5 h-4 w-4" />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={exportExcel}>Excel (.xlsx)</DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPDF}>PDF</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()}>
                  <Upload className="mr-1.5 h-4 w-4" />
                  Importar CSV
                </Button>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleCsvFile}
                />
                <Button size="sm" onClick={handleNovo}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Novo Cliente
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ClienteTable
              clientes={clientes}
              loading={loading}
              onEdit={handleEdit}
              onDelete={excluirCliente}
              onManageUnidades={(c) => {
                setUnidadesCliente({ id: c.id, nome: c.nome });
                setUnidadesDialogOpen(true);
              }}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <p className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ClienteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editData.form}
        editId={editData.id}
        onSave={salvarCliente}
      />

      {/* CSV Import Preview Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar Clientes do CSV</DialogTitle>
            <DialogDescription>
              {csvPreview.length} cliente(s) encontrado(s). Confira os dados antes de importar.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto flex-1 border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left font-medium">#</th>
                  <th className="p-2 text-left font-medium">Nome</th>
                  <th className="p-2 text-left font-medium">Telefone</th>
                  <th className="p-2 text-left font-medium">Endereço</th>
                  <th className="p-2 text-left font-medium">Bairro</th>
                </tr>
              </thead>
              <tbody>
                {csvPreview.slice(0, 100).map((c, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2 font-medium">{c.nome}</td>
                    <td className="p-2">{c.telefone || "-"}</td>
                    <td className="p-2">{c.endereco ? `${c.endereco}, ${c.numero}` : "-"}</td>
                    <td className="p-2">{c.bairro || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {csvPreview.length > 100 && (
              <p className="text-xs text-muted-foreground p-2 text-center">
                Mostrando 100 de {csvPreview.length} registros...
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCsvDialogOpen(false)}>Cancelar</Button>
            <Button onClick={importCsv} disabled={importing}>
              {importing ? "Importando..." : `Importar ${csvPreview.length} cliente(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {unidadesCliente && (
        <ClienteUnidadesDialog
          open={unidadesDialogOpen}
          onOpenChange={setUnidadesDialogOpen}
          clienteId={unidadesCliente.id}
          clienteNome={unidadesCliente.nome}
          onSaved={fetchClientes}
        />
      )}
    </MainLayout>
  );
}
