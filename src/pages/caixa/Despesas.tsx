import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Receipt, Plus, Wallet, TrendingDown, CalendarIcon, Fuel, UtensilsCrossed, Wrench, MoreHorizontal, DollarSign, Camera, ImageIcon, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrasiliaDate } from "@/lib/utils";
import { toast } from "sonner";
import { useUnidade } from "@/contexts/UnidadeContext";
import { startOfDay, endOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Despesa {
  id: string;
  descricao: string;
  categoria: string | null;
  valor: number;
  responsavel: string | null;
  status: string;
  created_at: string;
}

const categoriaIcons: Record<string, any> = {
  "Combustível": Fuel,
  "Alimentação": UtensilsCrossed,
  "Manutenção": Wrench,
  "Outros": MoreHorizontal,
};

const categoriaColors: Record<string, string> = {
  "Combustível": "bg-warning/10 text-warning",
  "Alimentação": "bg-success/10 text-success",
  "Manutenção": "bg-info/10 text-info",
  "Outros": "bg-muted text-muted-foreground",
};

// Map edge function categories to form categories
const mapCategoria = (cat: string): string => {
  const map: Record<string, string> = {
    "Frota": "Combustível",
    "Utilidades": "Manutenção",
    "Infraestrutura": "Manutenção",
    "Fornecedores": "Outros",
    "RH": "Outros",
    "Compras": "Outros",
  };
  return map[cat] || cat;
};

const compressImage = (file: File, maxWidth = 1600, quality = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Canvas error");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function Despesas() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState<Date>(getBrasiliaDate());
  const { unidadeAtual } = useUnidade();
  const [form, setForm] = useState({ descricao: "", categoria: "", valor: "", responsavel: "", observacoes: "" });
  const [categoriasCadastradas, setCategoriasCadastradas] = useState<{ nome: string; tipo: string | null }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      let q = supabase.from("categorias_despesa").select("nome, tipo").eq("ativo", true);
      if (unidadeAtual?.id) q = q.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
      const { data } = await q;
      // dedupe by nome
      const seen = new Set<string>();
      const unique = (data || []).filter((c: any) => {
        const k = (c.nome || "").trim();
        if (!k || seen.has(k.toLowerCase())) return false;
        seen.add(k.toLowerCase());
        return true;
      }) as { nome: string; tipo: string | null }[];
      unique.sort((a, b) => {
        const ta = (a.tipo || "zzz"), tb = (b.tipo || "zzz");
        if (ta !== tb) return ta.localeCompare(tb);
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
      setCategoriasCadastradas(unique);
    })();
  }, [unidadeAtual]);

  const fetchDespesas = async () => {
    setLoading(true);
    const inicio = startOfDay(dataSelecionada).toISOString();
    const fim = endOfDay(dataSelecionada).toISOString();
    let query = supabase.from("movimentacoes_caixa").select("*").eq("tipo", "saida").gte("created_at", inicio).lte("created_at", fim).order("created_at", { ascending: false });
    if (unidadeAtual?.id) query = query.or(`unidade_id.eq.${unidadeAtual.id},unidade_id.is.null`);
    const { data, error } = await query;
    if (error) console.error(error);
    else setDespesas((data as Despesa[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDespesas(); }, [unidadeAtual, dataSelecionada]);

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    try {
      const base64 = await compressImage(file);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Faça login primeiro"); return; }

      const response = await supabase.functions.invoke("parse-expense-photo", {
        body: { imageBase64: base64 },
      });

      if (response.error) throw response.error;

      const result = response.data;
      if (result?.despesas?.length > 0) {
        const d = result.despesas[0];
        setForm({
          descricao: d.descricao || "",
          categoria: mapCategoria(d.categoria || ""),
          valor: d.valor ? String(d.valor) : "",
          responsavel: d.fornecedor || "",
          observacoes: d.observacoes || "",
        });
        setDialogOpen(true);
        toast.success("Dados extraídos da foto!");
      } else {
        toast.error("Não foi possível extrair dados da imagem");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao processar a foto");
    } finally {
      setScanning(false);
      // Reset inputs
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const LIMITE_SANGRIA = 500; // Limite de alerta

  const handleSubmit = async () => {
    if (!form.descricao || !form.valor) { toast.error("Preencha os campos"); return; }
    const valor = parseFloat(form.valor);
    
    // Verificar se ultrapassa limite
    const statusDespesa = valor > LIMITE_SANGRIA ? "pendente" : "pendente";
    
    const { error } = await supabase.from("movimentacoes_caixa").insert({
      tipo: "saida", descricao: form.descricao,
      valor, categoria: form.categoria || null,
      responsavel: form.responsavel || null, status: statusDespesa,
      observacoes: form.observacoes || null,
      unidade_id: unidadeAtual?.id || null,
    });
    if (error) { toast.error("Erro ao registrar"); console.error(error); }
    else {
      if (valor > LIMITE_SANGRIA) {
        toast.warning(`Sangria de R$ ${valor.toFixed(2)} registrada como PENDENTE (acima de R$ ${LIMITE_SANGRIA}). Precisa aprovação.`);
      } else {
        toast.success("Despesa registrada!");
      }
      setDialogOpen(false); setForm({ descricao: "", categoria: "", valor: "", responsavel: "", observacoes: "" }); fetchDespesas();
    }
  };

  const handleAprovar = async (id: string) => {
    const { error } = await supabase.from("movimentacoes_caixa").update({ status: "aprovada" }).eq("id", id);
    if (error) toast.error("Erro ao aprovar");
    else { toast.success("Despesa aprovada!"); fetchDespesas(); }
  };

  const handleRejeitar = async (id: string) => {
    const { error } = await supabase.from("movimentacoes_caixa").update({ status: "rejeitada" }).eq("id", id);
    if (error) toast.error("Erro ao rejeitar");
    else { toast.success("Despesa rejeitada!"); fetchDespesas(); }
  };

  const totalDespesas = despesas.reduce((a, d) => a + Number(d.valor), 0);
  const totalAprovadas = despesas.filter(d => d.status === "aprovada").reduce((a, d) => a + Number(d.valor), 0);
  const totalPendentes = despesas.filter(d => d.status === "pendente").reduce((a, d) => a + Number(d.valor), 0);

  // Resumo por categoria
  const categoriaMap = new Map<string, { total: number; count: number }>();
  despesas.forEach(d => {
    const cat = d.categoria || "Sem categoria";
    const existing = categoriaMap.get(cat) || { total: 0, count: 0 };
    categoriaMap.set(cat, { total: existing.total + Number(d.valor), count: existing.count + 1 });
  });
  const categorias = Array.from(categoriaMap.entries())
    .map(([nome, v]) => ({ nome, ...v, percent: totalDespesas > 0 ? (v.total / totalDespesas) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <MainLayout>
      <Header title="Despesas" subtitle="Controle de saídas e sangrias" />
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />

      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dataSelecionada, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dataSelecionada} onSelect={(d) => d && setDataSelecionada(d)} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="photo" disabled={scanning}>
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {scanning ? "Processando..." : "Foto Despesa"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="h-4 w-4 mr-2" />Tirar Foto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-2" />Escolher Imagem
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Despesa</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Registrar Nova Despesa</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></div>
                  <div><Label>Categoria</Label>
                    <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {form.categoria && !categoriasCadastradas.some(c => c.nome === form.categoria) && (
                          <SelectItem value={form.categoria}>{form.categoria}</SelectItem>
                        )}
                        {categoriasCadastradas.map(c => (
                          <SelectItem key={c.nome} value={c.nome}>
                            {c.nome}{c.tipo ? ` · ${c.tipo}` : ""}
                          </SelectItem>
                        ))}
                        {categoriasCadastradas.length === 0 && (
                          <>
                            <SelectItem value="Combustível">Combustível</SelectItem>
                            <SelectItem value="Alimentação">Alimentação</SelectItem>
                            <SelectItem value="Manutenção">Manutenção</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></div>
                  <div><Label>Responsável</Label><Input value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} /></div>
                  <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
                  <div className="flex justify-end gap-2 pt-4"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSubmit}>Registrar</Button></div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Cards resumo */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card><CardContent className="p-3 sm:pt-6 sm:p-6"><div className="flex items-center gap-3"><div className="status-card-icon status-card-icon-destructive"><TrendingDown /></div><div className="min-w-0"><p className="text-lg sm:text-2xl font-bold text-destructive truncate">R$ {totalDespesas.toFixed(2)}</p><p className="text-xs text-muted-foreground">Total Despesas</p></div></div></CardContent></Card>
          <Card><CardContent className="p-3 sm:pt-6 sm:p-6"><div className="flex items-center gap-3"><div className="status-card-icon status-card-icon-success"><Wallet /></div><div className="min-w-0"><p className="text-lg sm:text-2xl font-bold text-success truncate">R$ {totalAprovadas.toFixed(2)}</p><p className="text-xs text-muted-foreground">Aprovadas</p></div></div></CardContent></Card>
          <Card><CardContent className="p-3 sm:pt-6 sm:p-6"><div className="flex items-center gap-3"><div className="status-card-icon status-card-icon-warning"><DollarSign /></div><div className="min-w-0"><p className="text-lg sm:text-2xl font-bold truncate">R$ {totalPendentes.toFixed(2)}</p><p className="text-xs text-muted-foreground">Pendentes</p></div></div></CardContent></Card>
          <Card><CardContent className="p-3 sm:pt-6 sm:p-6"><div className="flex items-center gap-3"><div className="status-card-icon status-card-icon-primary"><Receipt /></div><div className="min-w-0"><p className="text-lg sm:text-2xl font-bold">{despesas.length}</p><p className="text-xs text-muted-foreground">Registros</p></div></div></CardContent></Card>
        </div>

        {/* Resumo por categoria */}
        {categorias.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Resumo por Categoria</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {categorias.map(cat => {
                  const Icon = categoriaIcons[cat.nome] || MoreHorizontal;
                  const colorClass = categoriaColors[cat.nome] || categoriaColors["Outros"];
                  return (
                    <div key={cat.nome} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("p-2 rounded-md", colorClass)}><Icon className="h-4 w-4" /></div>
                          <span className="font-medium text-sm">{cat.nome}</span>
                        </div>
                        <Badge variant="secondary">{cat.count}</Badge>
                      </div>
                      <p className="text-xl font-bold">R$ {cat.total.toFixed(2)}</p>
                      <div className="space-y-1">
                        <Progress value={cat.percent} className="h-2" />
                        <p className="text-xs text-muted-foreground">{cat.percent.toFixed(0)}% do total</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-3"><CardTitle>Despesas do Dia</CardTitle></CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : despesas.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhuma despesa registrada</p>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="space-y-3 sm:hidden px-3">
                  {despesas.map(d => (
                    <div key={d.id} className={`border rounded-lg p-3 ${Number(d.valor) > LIMITE_SANGRIA && d.status === "pendente" ? "bg-warning/5" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {Number(d.valor) > LIMITE_SANGRIA && d.status === "pendente" && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
                            <p className="text-sm font-medium truncate">{d.descricao}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{d.categoria || "Sem categoria"}{d.responsavel ? ` · ${d.responsavel}` : ""}</p>
                        </div>
                        {d.status === "pendente" && (
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-success hover:text-success" onClick={() => handleAprovar(d.id)}><CheckCircle className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRejeitar(d.id)}><XCircle className="h-4 w-4" /></Button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={d.status === "aprovada" ? "default" : d.status === "rejeitada" ? "destructive" : "secondary"} className="text-[10px]">
                            {d.status === "aprovada" ? "Aprovada" : d.status === "rejeitada" ? "Rejeitada" : "Pendente"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{new Date(d.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <span className="font-bold text-sm text-destructive">- R$ {Number(d.valor).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="overflow-x-auto hidden sm:block">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Hora</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {despesas.map(d => (
                          <TableRow key={d.id} className={Number(d.valor) > LIMITE_SANGRIA && d.status === "pendente" ? "bg-warning/5" : ""}>
                            <TableCell className="text-muted-foreground text-xs">{new Date(d.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1.5">
                                {Number(d.valor) > LIMITE_SANGRIA && d.status === "pendente" && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
                                {d.descricao}
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline">{d.categoria || "—"}</Badge></TableCell>
                            <TableCell className="text-sm">{d.responsavel || "—"}</TableCell>
                            <TableCell className="text-right font-medium text-destructive whitespace-nowrap">- R$ {Number(d.valor).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={d.status === "aprovada" ? "default" : d.status === "rejeitada" ? "destructive" : "secondary"} 
                                className="whitespace-nowrap"
                              >
                                {d.status === "aprovada" ? "Aprovada" : d.status === "rejeitada" ? "Rejeitada" : "Pendente"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {d.status === "pendente" && (
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-success hover:text-success" onClick={() => handleAprovar(d.id)} title="Aprovar">
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRejeitar(d.id)} title="Rejeitar">
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
