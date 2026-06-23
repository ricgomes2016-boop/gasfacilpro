import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Settings2, Save, CheckCircle2, AlertCircle, Plug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";
import { getBankTheme } from "@/lib/bancos/bankThemes";
import { getBankProvider } from "@/lib/bancos/bankProviders";

interface ContaBancaria {
  id: string;
  nome: string;
  banco: string;
  saldo_atual: number;
  unidade_id: string | null;
}

interface Props {
  contas: ContaBancaria[];
}

type Disponibilidade = "ambos" | "recebimento" | "pagamento";

const FORMA_POR_MAQUININHA = new Set(["cartao_debito", "cartao_credito", "pix_maquininha"]);

const FORMAS_PAGAMENTO: Array<{
  value: string;
  label: string;
  desc: string;
  disponivel: Disponibilidade;
  semBanco?: boolean;
}> = [
  { value: "dinheiro", label: "💵 Dinheiro", desc: "Entra no Caixa da Loja. Depósito bancário é manual.", disponivel: "ambos" },
  { value: "pix", label: "📱 PIX", desc: "Entrada DIRETA na conta bancária (não passa pelo caixa).", disponivel: "ambos" },
  { value: "pix_maquininha", label: "📱 PIX Maquininha", desc: "Conta definida pela maquininha/operadora usada na venda.", disponivel: "recebimento" },
  { value: "cartao_debito", label: "💳 Cartão Débito", desc: "Conta definida pela maquininha/operadora usada na venda.", disponivel: "ambos" },
  { value: "cartao_credito", label: "💳 Cartão Crédito", desc: "Conta definida pela maquininha/operadora usada na venda.", disponivel: "ambos" },
  { value: "cheque", label: "📝 Cheque", desc: "Entra no caixa + tabela cheques. Banco quando depositado.", disponivel: "ambos" },
  { value: "vale_gas", label: "🔥 Vale Gás", desc: "Entra no Caixa da Loja (depende da forma de pagamento).", disponivel: "recebimento" },
  { value: "fiado", label: "📋 Fiado", desc: "Vai para Contas a Receber (sem caixa nem banco).", disponivel: "recebimento", semBanco: true },
  { value: "boleto", label: "📄 Boleto", desc: "Vai para Contas a Receber. Banco quando baixado.", disponivel: "ambos", semBanco: true },
  { value: "transferencia", label: "🏦 Transferência", desc: "Movimentação bancária direta entre contas.", disponivel: "ambos" },
];

interface ConfigRow {
  id: string;
  forma_pagamento: string;
  conta_bancaria_id: string | null;
  unidade_id: string | null;
  ativo: boolean;
}

export default function ConfigDestinoPagamento({ contas }: Props) {
  const { unidadeAtual } = useUnidade();
  const queryClient = useQueryClient();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [ativos, setAtivos] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data: existingConfigs = [], isLoading } = useQuery({
    queryKey: ["config-destino-pagamento", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("config_destino_pagamento")
        .select("*");

      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ConfigRow[];
    },
  });

  useEffect(() => {
    const mapContas: Record<string, string> = {};
    const mapAtivos: Record<string, boolean> = {};
    for (const cfg of existingConfigs) {
      if (cfg.conta_bancaria_id) mapContas[cfg.forma_pagamento] = cfg.conta_bancaria_id;
      mapAtivos[cfg.forma_pagamento] = cfg.ativo !== false;
    }
    setConfigs(mapContas);
    setAtivos(mapAtivos);
  }, [existingConfigs]);

  const isAtivo = (forma: string) => ativos[forma] !== false;

  const salvarConfigs = async () => {
    setSaving(true);
    try {
      for (const forma of FORMAS_PAGAMENTO) {
        const contaId = configs[forma.value];
        const ativo = isAtivo(forma.value);
        const existing = existingConfigs.find(c => c.forma_pagamento === forma.value);

        const payload = {
          unidade_id: unidadeAtual?.id || null,
          forma_pagamento: forma.value,
          conta_bancaria_id: contaId && contaId !== "nenhuma" ? contaId : null,
          ativo,
        };

        if (existing) {
          await supabase.from("config_destino_pagamento").update(payload).eq("id", existing.id);
        } else if (payload.conta_bancaria_id || !ativo) {
          await supabase.from("config_destino_pagamento").insert(payload);
        }
      }

      toast.success("Formas de pagamento salvas!");
      queryClient.invalidateQueries({ queryKey: ["config-destino-pagamento"] });
      queryClient.invalidateQueries({ queryKey: ["formas-pagamento-ativas"] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const formasComBanco = FORMAS_PAGAMENTO.filter(f => !f.semBanco);
  const configuredCount = formasComBanco.filter(f => configs[f.value] && configs[f.value] !== "nenhuma").length;

  const renderContaOption = (c: ContaBancaria) => {
    const theme = getBankTheme(c.banco);
    const provider = getBankProvider(c.banco);
    return (
      <div className="flex items-center gap-2">
        <span
          className="h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold"
          style={{ background: theme.primary, color: theme.textColor }}
        >
          {theme.initials}
        </span>
        <span className="truncate">{c.nome}</span>
        {provider && <Plug className="h-3 w-3 text-primary shrink-0" />}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Como funciona
          </CardTitle>
          <CardDescription className="text-sm">
            Cadastre quais formas de pagamento estão disponíveis nas vendas desta unidade e em qual conta bancária cada uma é creditada.
            <strong> Fiado</strong> e <strong>Boleto</strong> vão direto para Contas a Receber.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-3">
            {configuredCount === formasComBanco.length ? (
              <Badge className="bg-primary gap-1"><CheckCircle2 className="h-3 w-3" />Totalmente configurado</Badge>
            ) : configuredCount > 0 ? (
              <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" />{configuredCount}/{formasComBanco.length} com conta</Badge>
            ) : (
              <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Nenhuma conta vinculada</Badge>
            )}
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Plug className="h-3 w-3" /> Contas com este ícone têm integração ativa (Asaas/PagBank).
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center py-6 text-muted-foreground">Carregando...</p>
          ) : contas.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">
              Cadastre pelo menos uma conta bancária antes de configurar as formas de pagamento.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Forma de Pagamento</TableHead>
                      <TableHead>Conta Bancária</TableHead>
                      <TableHead className="hidden md:table-cell">Disponível em</TableHead>
                      <TableHead className="hidden lg:table-cell">Comportamento</TableHead>
                      <TableHead className="w-24 text-center">Ativo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {FORMAS_PAGAMENTO.map(forma => {
                      const ativo = isAtivo(forma.value);
                      return (
                        <TableRow key={forma.value} className={!ativo ? "opacity-50" : ""}>
                          <TableCell className="font-medium">{forma.label}</TableCell>
                          <TableCell>
                            {forma.semBanco ? (
                              <span className="text-xs text-muted-foreground italic">Contas a Receber (automático)</span>
                            ) : FORMA_POR_MAQUININHA.has(forma.value) ? (
                              <a
                                href="/financeiro/cartoes"
                                className="text-xs inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/15"
                              >
                                <Plug className="h-3 w-3" />
                                Definida por maquininha — gerenciar
                              </a>
                            ) : (
                              <Select
                                value={configs[forma.value] || "nenhuma"}
                                onValueChange={v => setConfigs({ ...configs, [forma.value]: v })}
                                disabled={!ativo}
                              >
                                <SelectTrigger className="max-w-[300px]">
                                  <SelectValue placeholder="Selecione a conta" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="nenhuma">— Nenhuma (só caixa) —</SelectItem>
                                  {contas.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {renderContaOption(c)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {(forma.disponivel === "ambos" || forma.disponivel === "recebimento") && (
                                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">Recebimento</Badge>
                              )}
                              {(forma.disponivel === "ambos" || forma.disponivel === "pagamento") && (
                                <Badge className="bg-rose-600 hover:bg-rose-600 text-white text-[10px]">Pagamento</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[260px]">
                            {forma.desc}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={ativo}
                              onCheckedChange={v => setAtivos({ ...ativos, [forma.value]: v })}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end mt-4">
                <Button onClick={salvarConfigs} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
