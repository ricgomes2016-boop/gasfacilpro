import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { QRCodeSVG } from "qrcode.react";
import { Plus, Wallet, Trash2, QrCode, Printer, CheckCircle2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface ItemForm {
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  valor_unitario: number;
}

export default function VendaAntecipada() {
  const { unidadeAtual } = useUnidade();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detalheVA, setDetalheVA] = useState<any | null>(null);
  const [qrVale, setQrVale] = useState<any | null>(null);
  const [printAllOpen, setPrintAllOpen] = useState(false);

  const [form, setForm] = useState({
    cliente_id: "", cliente_nome: "", forma_pagamento: "dinheiro",
    observacoes: "", data_validade: "",
  });
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ["vendas-antecipadas-v2", unidadeAtual?.id],
    queryFn: async () => {
      let q = supabase.from("vendas_antecipadas").select("*, vendas_antecipadas_itens(*)").order("created_at", { ascending: false });
      if (unidadeAtual?.id) q = q.eq("unidade_id", unidadeAtual.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-va", unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];
      const { data } = await supabase.from("produtos").select("id, nome, preco")
        .eq("unidade_id", unidadeAtual.id).eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-search-va2", clienteSearch, unidadeAtual?.id],
    queryFn: async () => {
      if (!clienteSearch || clienteSearch.length < 2 || !unidadeAtual?.id) return [];
      const { data: cuData } = await supabase.from("cliente_unidades").select("cliente_id").eq("unidade_id", unidadeAtual.id);
      const ids = (cuData || []).map((cu: any) => cu.cliente_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("clientes").select("id, nome, telefone")
        .eq("ativo", true).in("id", ids).ilike("nome", `%${clienteSearch}%`).limit(5);
      return data || [];
    },
    enabled: clienteSearch.length >= 2,
  });

  const { data: vales = [], refetch: refetchVales } = useQuery({
    queryKey: ["va-vales", detalheVA?.id],
    queryFn: async () => {
      if (!detalheVA?.id) return [];
      const { data } = await supabase.from("vendas_antecipadas_vales").select("*")
        .eq("venda_antecipada_id", detalheVA.id).order("numero");
      return data || [];
    },
    enabled: !!detalheVA?.id,
  });

  const totalForm = useMemo(() => itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0), [itens]);
  const totalUnidades = useMemo(() => itens.reduce((s, i) => s + i.quantidade, 0), [itens]);

  const addItem = () => setItens([...itens, { produto_id: "", produto_nome: "", quantidade: 1, valor_unitario: 0 }]);
  const removeItem = (idx: number) => setItens(itens.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<ItemForm>) => {
    setItens(itens.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const resetForm = () => {
    setForm({ cliente_id: "", cliente_nome: "", forma_pagamento: "dinheiro", observacoes: "", data_validade: "" });
    setItens([]); setClienteSearch("");
  };

  const criarVenda = async () => {
    if (!form.cliente_nome) { toast.error("Informe o cliente"); return; }
    if (itens.length === 0) { toast.error("Adicione ao menos 1 produto"); return; }
    if (itens.some(i => !i.produto_nome || i.quantidade <= 0 || i.valor_unitario <= 0)) {
      toast.error("Preencha produto, quantidade e valor de cada item"); return;
    }
    if (!unidadeAtual?.id) { toast.error("Selecione uma unidade"); return; }

    // 1) Insert venda
    const { data: va, error: e1 } = await supabase.from("vendas_antecipadas").insert({
      cliente_id: form.cliente_id || null,
      cliente_nome: form.cliente_nome,
      valor_pago: totalForm,
      forma_pagamento: form.forma_pagamento,
      observacoes: form.observacoes || null,
      data_validade: form.data_validade || null,
      unidade_id: unidadeAtual.id,
      user_id: user?.id,
    }).select().single();
    if (e1 || !va) { toast.error("Erro ao criar venda: " + e1?.message); return; }

    // 2) Insert itens
    const itensPayload = itens.map(i => ({
      venda_antecipada_id: va.id,
      produto_id: i.produto_id || null,
      produto_nome: i.produto_nome,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
    }));
    const { data: itensIns, error: e2 } = await supabase.from("vendas_antecipadas_itens").insert(itensPayload).select();
    if (e2 || !itensIns) { toast.error("Erro ao criar itens: " + e2?.message); return; }

    // 3) Generate vales (1 per unit)
    const ano = new Date().getFullYear();
    const numVenda = String(va.numero_sequencial || 0).padStart(5, "0");
    const valesPayload: any[] = [];
    let counter = 1;
    for (const item of itensIns) {
      for (let q = 0; q < item.quantidade; q++) {
        valesPayload.push({
          venda_antecipada_id: va.id,
          item_id: item.id,
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          numero: counter,
          codigo: `VA-${ano}-${numVenda}-${String(counter).padStart(2, "0")}`,
          valor_unitario: item.valor_unitario,
          cliente_id: form.cliente_id || null,
          unidade_id: unidadeAtual.id,
          empresa_id: va.empresa_id,
        });
        counter++;
      }
    }
    const { error: e3 } = await supabase.from("vendas_antecipadas_vales").insert(valesPayload);
    if (e3) { toast.error("Erro ao gerar vales: " + e3.message); return; }

    toast.success(`Venda #${va.numero_sequencial} criada com ${valesPayload.length} vales!`);
    setDialogOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["vendas-antecipadas-v2"] });
  };

  const retirarVale = async (codigo: string) => {
    const { error } = await supabase.rpc("consumir_vale_venda_antecipada", { _codigo: codigo });
    if (error) { toast.error(error.message); return; }
    toast.success("Vale retirado!");
    refetchVales();
    queryClient.invalidateQueries({ queryKey: ["vendas-antecipadas-v2"] });
  };

  const saldoUnidades = vendas.reduce((s: number, v: any) => s + ((v.total_unidades || 0) - (v.unidades_retiradas || 0)), 0);
  const totalVendido = vendas.reduce((s: number, v: any) => s + Number(v.valor_pago || 0), 0);

  const resumoItens = (v: any) => {
    const its = v.vendas_antecipadas_itens || [];
    return its.map((i: any) => `${i.quantidade}× ${i.produto_nome}`).join(", ");
  };

  const statusBadge = (s: string) => {
    const map: any = {
      ativo: { v: "default", l: "Ativo" }, parcial: { v: "secondary", l: "Parcial" },
      utilizado: { v: "outline", l: "Concluído" }, cancelado: { v: "destructive", l: "Cancelado" },
    };
    const cfg = map[s] || { v: "outline", l: s };
    return <Badge variant={cfg.v}>{cfg.l}</Badge>;
  };

  const valeStatusBadge = (s: string) => {
    if (s === "disponivel") return <Badge variant="default">Disponível</Badge>;
    if (s === "retirado") return <Badge variant="secondary">Retirado</Badge>;
    return <Badge variant="destructive">Cancelado</Badge>;
  };

  const handlePrintAll = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const _esc = (v: unknown) => v === null || v === undefined ? "" : String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const cards = vales.map((v: any) => {
      // SVG comes from QRCode lib (trusted DOM), not user input
      const svg = document.getElementById(`qr-${v.id}`)?.outerHTML || "";
      return `<div class="card">
        <div class="logo">🔥 Vale</div>
        ${svg}
        <div class="num">Nº ${_esc(detalheVA.numero_sequencial)}-${String(v.numero).padStart(2,"0")}</div>
        <div class="cod">${_esc(v.codigo)}</div>
        <div class="prod">${_esc(v.produto_nome)}</div>
        <div class="val">R$ ${Number(v.valor_unitario).toFixed(2)}</div>
        <div class="cli">${_esc(detalheVA.cliente_nome)}</div>
      </div>`;
    }).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Vales</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial;padding:10px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .card{border:2px dashed #333;border-radius:8px;padding:10px;text-align:center;page-break-inside:avoid}
      .logo{font-weight:bold;color:#2fc2b5;font-size:12px;margin-bottom:4px}
      .num{font-size:14px;font-weight:bold;margin-top:4px}
      .cod{font-family:monospace;font-size:9px;color:#666}
      .prod{font-size:11px;margin-top:2px}
      .val{font-size:14px;font-weight:bold;color:#16a34a;margin-top:2px}
      .cli{font-size:10px;color:#666;margin-top:2px}
      svg{width:100px;height:100px}
      @media print{.card{border:2px dashed #000}}
    </style></head><body><div class="grid">${cards}</div>
    <script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  };

  return (
    <MainLayout>
      <Header title="Venda Antecipada" subtitle="Vales pré-pagos de uso pessoal" />
      <div className="p-4 md:p-6 space-y-6 pb-12 md:pb-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Unidades a Retirar</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">{saldoUnidades}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Vendido</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">R$ {totalVendido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Vendas Ativas</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{vendas.filter((v: any) => v.status !== "utilizado" && v.status !== "cancelado").length}</p></CardContent></Card>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Venda Antecipada</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" />Nova Venda Antecipada</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Cliente *</Label>
                <Input value={form.cliente_nome} onChange={e => { setForm({ ...form, cliente_nome: e.target.value, cliente_id: "" }); setClienteSearch(e.target.value); }} placeholder="Buscar cliente..." />
                {clientes.length > 0 && (
                  <div className="border rounded-md mt-1 max-h-32 overflow-y-auto">
                    {clientes.map((c: any) => (
                      <button key={c.id} type="button" className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                        onClick={() => { setForm({ ...form, cliente_id: c.id, cliente_nome: c.nome }); setClienteSearch(""); }}>
                        {c.nome} {c.telefone && `— ${c.telefone}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Produtos *</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
                </div>
                {itens.length === 0 && <p className="text-sm text-muted-foreground text-center py-3 border rounded-md">Nenhum produto adicionado</p>}
                <div className="space-y-2">
                  {itens.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-md">
                      <div className="col-span-12 sm:col-span-5">
                        <Label className="text-xs">Produto</Label>
                        <Select value={it.produto_id || "nenhum"} onValueChange={v => {
                          if (v === "nenhum") return;
                          const p: any = produtos.find((p: any) => p.id === v);
                          updateItem(idx, { produto_id: v, produto_nome: p?.nome || "", valor_unitario: it.valor_unitario || Number(p?.preco || 0) });
                        }}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {produtos.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4 sm:col-span-2"><Label className="text-xs">Qtd</Label>
                        <Input type="number" min={1} value={it.quantidade} onChange={e => updateItem(idx, { quantidade: parseInt(e.target.value) || 0 })} /></div>
                      <div className="col-span-6 sm:col-span-3"><Label className="text-xs">Vlr Unit.</Label>
                        <Input type="number" step="0.01" value={it.valor_unitario} onChange={e => updateItem(idx, { valor_unitario: parseFloat(e.target.value) || 0 })} /></div>
                      <div className="col-span-2 sm:col-span-2 flex gap-1 items-end">
                        <span className="text-xs flex-1 text-right font-medium">R$ {(it.quantidade * it.valor_unitario).toFixed(2)}</span>
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
                {itens.length > 0 && (
                  <div className="flex justify-between mt-2 p-2 bg-muted rounded text-sm">
                    <span>{totalUnidades} unidades · {itens.length} {itens.length === 1 ? "produto" : "produtos"}</span>
                    <span className="font-bold text-primary">Total: R$ {totalForm.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Forma Pagamento</Label>
                  <Select value={form.forma_pagamento} onValueChange={v => setForm({ ...form, forma_pagamento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao_debito">Débito</SelectItem>
                      <SelectItem value="cartao_credito">Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Validade</Label>
                  <Input type="date" value={form.data_validade} onChange={e => setForm({ ...form, data_validade: e.target.value })} /></div>
              </div>
              <div><Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={criarVenda}>Criar e Gerar Vales</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p className="text-center py-6 text-muted-foreground">Carregando...</p> : vendas.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">Nenhuma venda antecipada</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produtos</TableHead>
                      <TableHead>Retirados</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendas.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono">#{v.numero_sequencial}</TableCell>
                        <TableCell className="font-medium">{v.cliente_nome}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{resumoItens(v)}</TableCell>
                        <TableCell className="font-medium">{v.unidades_retiradas}/{v.total_unidades}</TableCell>
                        <TableCell>R$ {Number(v.valor_pago).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{statusBadge(v.status)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => setDetalheVA(v)}><Eye className="h-3 w-3 mr-1" />Ver</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalhe / Vales */}
        <Dialog open={!!detalheVA} onOpenChange={(o) => !o && setDetalheVA(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Venda Antecipada #{detalheVA?.numero_sequencial} — {detalheVA?.cliente_nome}</DialogTitle>
            </DialogHeader>
            {detalheVA && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="p-3 bg-muted rounded">
                    <p className="text-xs text-muted-foreground">Total Pago</p>
                    <p className="font-bold">R$ {Number(detalheVA.valor_pago).toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <p className="text-xs text-muted-foreground">Unidades</p>
                    <p className="font-bold">{detalheVA.unidades_retiradas}/{detalheVA.total_unidades}</p>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div className="mt-1">{statusBadge(detalheVA.status)}</div>
                  </div>
                </div>

                {vales.length > 0 && (
                  <Button onClick={handlePrintAll} variant="outline" className="w-full">
                    <Printer className="h-4 w-4 mr-2" />Imprimir Todos os QR Codes
                  </Button>
                )}

                <div className="hidden">
                  {vales.map((v: any) => (
                    <QRCodeSVG key={v.id} id={`qr-${v.id}`} value={v.codigo} size={100} level="H" />
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vales.map((v: any) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono">{String(v.numero).padStart(2, "0")}</TableCell>
                          <TableCell>{v.produto_nome}</TableCell>
                          <TableCell className="font-mono text-xs">{v.codigo}</TableCell>
                          <TableCell>{valeStatusBadge(v.status)}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setQrVale({ ...v, parceiroNome: detalheVA.cliente_nome })}>
                              <QrCode className="h-4 w-4" />
                            </Button>
                            {v.status === "disponivel" && (
                              <Button size="sm" variant="outline" onClick={() => retirarVale(v.codigo)}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />Retirar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* QR individual */}
        <Dialog open={!!qrVale} onOpenChange={(o) => !o && setQrVale(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-center">QR Code do Vale</DialogTitle></DialogHeader>
            {qrVale && (
              <div className="flex flex-col items-center py-4">
                <div className="bg-white p-6 rounded-xl border-2 border-dashed border-muted-foreground/30 text-center">
                  <p className="text-sm font-bold text-primary mb-2">🔥 Venda Antecipada</p>
                  <QRCodeSVG value={qrVale.codigo} size={200} level="H" includeMargin className="mx-auto" />
                  <p className="text-2xl font-bold mt-3">Vale {String(qrVale.numero).padStart(2, "0")}</p>
                  <p className="font-mono text-xs text-muted-foreground">{qrVale.codigo}</p>
                  <p className="text-base mt-1">{qrVale.produto_nome}</p>
                  <p className="text-2xl font-bold text-success mt-2">R$ {Number(qrVale.valor_unitario).toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground mt-1">{qrVale.parceiroNome}</p>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-4">Apresente este QR Code para retirar seu produto.</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
