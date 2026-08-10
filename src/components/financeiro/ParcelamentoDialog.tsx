import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Layers, Calculator, CreditCard, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidadeId?: string;
  categorias: string[];
  onSuccess: () => void;
}

type Modo = "parcela" | "emprestimo" | "cartao";

export function ParcelamentoDialog({ open, onOpenChange, unidadeId, categorias, onSuccess }: Props) {
  const [modo, setModo] = useState<Modo>("parcela");
  const [form, setForm] = useState({
    fornecedor: "", descricao: "", valorTotal: "", numParcelas: "2",
    vencimentoPrimeira: "", categoria: "", observacoes: "",
    // Empréstimo
    instituicao: "", taxaJuros: "0", tipoAmortizacao: "price",
    // Cartão
    cartaoNome: "", bandeira: "Visa", ultimosDigitos: "",
  });
  const [parcelas, setParcelas] = useState<Array<{ num: number; valor: number; vencimento: string }>>([]);
  const [saving, setSaving] = useState(false);

  const calcularParcelas = () => {
    const valor = parseFloat(form.valorTotal);
    const num = parseInt(form.numParcelas);
    const dataBase = form.vencimentoPrimeira;
    if (!valor || !num || !dataBase) { toast.error("Preencha valor, nº de parcelas e data"); return; }

    const result: Array<{ num: number; valor: number; vencimento: string }> = [];

    if (modo === "emprestimo") {
      const taxa = parseFloat(form.taxaJuros) / 100;
      if (form.tipoAmortizacao === "price" && taxa > 0) {
        // Tabela Price
        const pmt = valor * (taxa * Math.pow(1 + taxa, num)) / (Math.pow(1 + taxa, num) - 1);
        let saldo = valor;
        for (let i = 0; i < num; i++) {
          const juros = saldo * taxa;
          const amortizacao = pmt - juros;
          saldo -= amortizacao;
          result.push({
            num: i + 1,
            valor: Math.round(pmt * 100) / 100,
            vencimento: format(addMonths(new Date(dataBase), i), "yyyy-MM-dd"),
          });
        }
      } else if (form.tipoAmortizacao === "sac" && taxa > 0) {
        // SAC
        const amortConstante = valor / num;
        let saldo = valor;
        for (let i = 0; i < num; i++) {
          const juros = saldo * taxa;
          const prestacao = amortConstante + juros;
          saldo -= amortConstante;
          result.push({
            num: i + 1,
            valor: Math.round(prestacao * 100) / 100,
            vencimento: format(addMonths(new Date(dataBase), i), "yyyy-MM-dd"),
          });
        }
      } else {
        // Sem juros
        const valorParcela = Math.round((valor / num) * 100) / 100;
        for (let i = 0; i < num; i++) {
          result.push({
            num: i + 1,
            valor: i === num - 1 ? Math.round((valor - valorParcela * (num - 1)) * 100) / 100 : valorParcela,
            vencimento: format(addMonths(new Date(dataBase), i), "yyyy-MM-dd"),
          });
        }
      }
    } else {
      // Parcela simples ou cartão
      const valorParcela = Math.round((valor / num) * 100) / 100;
      for (let i = 0; i < num; i++) {
        result.push({
          num: i + 1,
          valor: i === num - 1 ? Math.round((valor - valorParcela * (num - 1)) * 100) / 100 : valorParcela,
          vencimento: format(addMonths(new Date(dataBase), i), "yyyy-MM-dd"),
        });
      }
    }
    setParcelas(result);
  };

  const handleSave = async () => {
    if (parcelas.length === 0) { toast.error("Calcule as parcelas primeiro"); return; }
    if (!form.categoria || !categorias.includes(form.categoria)) {
      toast.error("Selecione uma categoria de despesa cadastrada");
      return;
    }
    setSaving(true);

    try {
      const grupoId = crypto.randomUUID();
      const origem = modo === "emprestimo" ? "emprestimo" : modo === "cartao" ? "cartao_credito" : "manual";
      const fornecedor = modo === "emprestimo" ? form.instituicao : modo === "cartao" ? form.cartaoNome : form.fornecedor;

      // Criar parcelas em contas_pagar
      const payloads = parcelas.map(p => ({
        fornecedor: fornecedor || "—",
        descricao: `${form.descricao} (${p.num}/${parcelas.length})`,
        valor: p.valor,
        vencimento: p.vencimento,
        categoria: form.categoria || null,
        observacoes: form.observacoes || null,
        unidade_id: unidadeId || null,
        parcela_numero: p.num,
        parcela_total: parcelas.length,
        grupo_parcela_id: grupoId,
        origem,
      }));

      const { error } = await supabase.from("contas_pagar").insert(payloads);
      if (error) throw error;

      // Se for empréstimo, salvar na tabela de empréstimos
      if (modo === "emprestimo") {
        await supabase.from("emprestimos").insert({
          descricao: form.descricao,
          instituicao: form.instituicao,
          valor_total: parseFloat(form.valorTotal),
          taxa_juros: parseFloat(form.taxaJuros),
          num_parcelas: parseInt(form.numParcelas),
          tipo_amortizacao: form.tipoAmortizacao,
          data_inicio: form.vencimentoPrimeira,
          unidade_id: unidadeId || null,
        });
      }

      // Se for cartão, salvar fatura
      if (modo === "cartao") {
        const mesRef = format(new Date(form.vencimentoPrimeira), "yyyy-MM");
        await supabase.from("faturas_cartao").insert({
          cartao_nome: form.cartaoNome,
          bandeira: form.bandeira,
          ultimos_digitos: form.ultimosDigitos || null,
          mes_referencia: mesRef,
          vencimento: form.vencimentoPrimeira,
          valor_total: parseFloat(form.valorTotal),
          unidade_id: unidadeId || null,
        });
      }

      toast.success(`${parcelas.length} parcelas criadas com sucesso!`);
      onOpenChange(false);
      setParcelas([]);
      setForm({ fornecedor: "", descricao: "", valorTotal: "", numParcelas: "2", vencimentoPrimeira: "", categoria: "", observacoes: "", instituicao: "", taxaJuros: "0", tipoAmortizacao: "price", cartaoNome: "", bandeira: "Visa", ultimosDigitos: "" });
      onSuccess();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const totalParcelas = parcelas.reduce((s, p) => s + p.valor, 0);
  const totalJuros = totalParcelas - parseFloat(form.valorTotal || "0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Parcelamento / Empréstimos / Cartão
          </DialogTitle>
        </DialogHeader>

        {/* Modo selector */}
        <div className="flex gap-2">
          <Button variant={modo === "parcela" ? "default" : "outline"} size="sm" onClick={() => { setModo("parcela"); setParcelas([]); }}>
            <Layers className="h-4 w-4 mr-1" />Parcelar Conta
          </Button>
          <Button variant={modo === "emprestimo" ? "default" : "outline"} size="sm" onClick={() => { setModo("emprestimo"); setParcelas([]); }}>
            <Landmark className="h-4 w-4 mr-1" />Empréstimo
          </Button>
          <Button variant={modo === "cartao" ? "default" : "outline"} size="sm" onClick={() => { setModo("cartao"); setParcelas([]); }}>
            <CreditCard className="h-4 w-4 mr-1" />Cartão de Crédito
          </Button>
        </div>

        <div className="space-y-4">
          {/* Common fields */}
          {modo === "parcela" && (
            <div><Label>Fornecedor *</Label><Input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} /></div>
          )}
          {modo === "emprestimo" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Instituição *</Label><Input value={form.instituicao} onChange={e => setForm({ ...form, instituicao: e.target.value })} placeholder="Banco, financeira..." /></div>
              <div><Label>Tipo de Amortização</Label>
                <Select value={form.tipoAmortizacao} onValueChange={v => setForm({ ...form, tipoAmortizacao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">Tabela Price (parcelas fixas)</SelectItem>
                    <SelectItem value="sac">SAC (amortização constante)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {modo === "cartao" && (
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Nome do Cartão *</Label><Input value={form.cartaoNome} onChange={e => setForm({ ...form, cartaoNome: e.target.value })} placeholder="Cartão Corporativo" /></div>
              <div><Label>Bandeira</Label>
                <Select value={form.bandeira} onValueChange={v => setForm({ ...form, bandeira: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Visa">Visa</SelectItem>
                    <SelectItem value="Mastercard">Mastercard</SelectItem>
                    <SelectItem value="Elo">Elo</SelectItem>
                    <SelectItem value="Amex">Amex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Últimos 4 dígitos</Label><Input value={form.ultimosDigitos} onChange={e => setForm({ ...form, ultimosDigitos: e.target.value })} maxLength={4} /></div>
            </div>
          )}

          <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Compra de equipamento" /></div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label>Valor Total *</Label><Input type="number" step="0.01" value={form.valorTotal} onChange={e => setForm({ ...form, valorTotal: e.target.value })} /></div>
            <div><Label>Nº Parcelas *</Label><Input type="number" min="1" max="360" value={form.numParcelas} onChange={e => setForm({ ...form, numParcelas: e.target.value })} /></div>
            <div><Label>1ª Parcela *</Label><Input type="date" value={form.vencimentoPrimeira} onChange={e => setForm({ ...form, vencimentoPrimeira: e.target.value })} /></div>
            {modo === "emprestimo" && (
              <div><Label>Taxa Juros (% a.m.)</Label><Input type="number" step="0.01" value={form.taxaJuros} onChange={e => setForm({ ...form, taxaJuros: e.target.value })} /></div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.length === 0 ? (
                    <SelectItem value="__sem_categoria__" disabled>Cadastre categorias em Configurações</SelectItem>
                  ) : (
                    categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={1} /></div>
          </div>

          <Button onClick={calcularParcelas} variant="outline" className="w-full gap-2">
            <Calculator className="h-4 w-4" />Calcular Parcelas
          </Button>

          {/* Preview parcelas */}
          {parcelas.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Prévia das Parcelas</h4>
                {totalJuros > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Juros: R$ {totalJuros.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </Badge>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parcelas.map(p => (
                      <TableRow key={p.num}>
                        <TableCell className="font-medium">{p.num}/{parcelas.length}</TableCell>
                        <TableCell>{new Date(p.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-right">R$ {p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-right text-sm font-bold">
                Total: R$ {totalParcelas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || parcelas.length === 0}>
              {saving ? "Salvando..." : `Criar ${parcelas.length} Parcela(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
