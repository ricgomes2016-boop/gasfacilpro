import { useEffect, useState } from "react";
import { FileCheck2, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import type { PedidoFormatado } from "@/types/pedido";
import { abrirLoginVenderGas, emitirDocumentoVenderGas, type VenderGasPayload } from "@/lib/fiscal/venderGasAgent";
import { toast } from "sonner";

interface Props {
  pedido: PedidoFormatado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoDocumento: "nfe" | "nfce";
}

export function EmitirNfeVenderGasDialog({ pedido, open, onOpenChange, tipoDocumento }: Props) {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const { user } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [documentoNfce, setDocumentoNfce] = useState("");
  const rotulo = tipoDocumento === "nfce" ? "NFC-e" : "NF-e";

  useEffect(() => {
    if (open) {
      setErro(null);
      setDocumentoNfce("");
    }
  }, [open, pedido?.id, tipoDocumento]);

  const abrirLogin = async () => {
    if (!unidadeAtual || !empresa?.cnpj) return;
    const resposta = await abrirLoginVenderGas(unidadeAtual.id, empresa.cnpj);
    resposta.ok ? toast.success(resposta.mensagem) : setErro(resposta.mensagem);
  };

  const emitir = async () => {
    if (!pedido || !empresa?.cnpj || !unidadeAtual) return;
    setEnviando(true);
    setErro(null);
    let notaId: string | null = null;
    try {
      const exigeDestinatario = tipoDocumento === "nfe";
      if (exigeDestinatario && !pedido.cliente_id) throw new Error("A NF-e exige um cliente cadastrado com CPF ou CNPJ.");
      let cliente: any = null;
      if (pedido.cliente_id) {
        const { data, error: clienteError } = await supabase
          .from("clientes")
          .select("nome, razao_social, cpf, cnpj, inscricao_estadual, endereco, numero, bairro, cep, cidade, estado, codigo_municipio, telefone")
          .eq("id", pedido.cliente_id)
          .single();
        if (clienteError && exigeDestinatario) throw new Error("Não foi possível carregar os dados fiscais do cliente.");
        cliente = data;
      }
      const documentoDigitado = documentoNfce.replace(/\D/g, "");
      if (tipoDocumento === "nfce" && documentoDigitado && ![11, 14].includes(documentoDigitado.length)) {
        throw new Error("Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos, ou deixe o campo vazio.");
      }
      const documento = tipoDocumento === "nfce"
        ? documentoDigitado
        : String(cliente?.cnpj || cliente?.cpf || "").replace(/\D/g, "");
      if (exigeDestinatario && ![11, 14].includes(documento.length)) throw new Error("A NF-e exige CPF ou CNPJ válido no cadastro do cliente.");
      const documentoFiscal = [11, 14].includes(documento.length) ? documento : "";
      if (exigeDestinatario && (!cliente?.endereco || !cliente?.numero || !cliente?.cep || !cliente?.cidade || !cliente?.estado)) {
        throw new Error("Complete endereço, número, CEP, cidade e UF no cadastro do cliente antes de emitir.");
      }
      if (!pedido.itens.length) throw new Error("O pedido não possui itens para faturamento.");

      const payload: VenderGasPayload = {
        tipoDocumento,
        unidadeId: unidadeAtual.id,
        cnpjEmitente: empresa.cnpj,
        pedidoId: pedido.id,
        numeroPedido: String(pedido.numero_sequencial ?? pedido.id.slice(0, 8)),
        somentePreparar: true,
        destinatario: {
          nome: cliente?.razao_social || cliente?.nome || pedido.cliente || "Consumidor final",
          cpfCnpj: documentoFiscal || undefined,
          inscricaoEstadual: cliente?.inscricao_estadual || undefined,
          endereco: cliente?.endereco || undefined,
          numero: cliente?.numero || undefined,
          bairro: cliente?.bairro || undefined,
          cep: cliente?.cep || undefined,
          cidade: cliente?.cidade || undefined,
          uf: cliente?.estado || undefined,
          codigoMunicipio: cliente?.codigo_municipio || undefined,
          telefone: cliente?.telefone || undefined,
        },
        itens: pedido.itens.map((item) => ({
          produtoId: item.produto_id,
          descricao: item.produto?.nome || "Produto",
          quantidade: Number(item.quantidade),
          valorUnitario: Number(item.preco_unitario),
        })),
        valorTotal: Number(pedido.valor),
        formaPagamento: pedido.forma_pagamento,
        observacoes: pedido.observacoes,
      };

      const db = supabase as any;
      const { data: existente } = await db.from("notas_fiscais").select("id, status, numero, chave_acesso")
        .eq("pedido_id", pedido.id).eq("tipo", tipoDocumento).eq("provedor", "vendergas").neq("status", "cancelada").maybeSingle();
      if (existente?.status === "autorizada") throw new Error(`Este pedido já possui a ${rotulo} ${existente.numero || existente.chave_acesso || "autorizada"}.`);
      notaId = existente?.id ?? null;
      if (!notaId) {
        const { data: criada, error: criarError } = await db.from("notas_fiscais").insert({
          tipo: tipoDocumento, status: "rascunho", pedido_id: pedido.id, provedor: "vendergas",
          provedor_status: "aguardando_agente", destinatario_nome: payload.destinatario.nome,
          destinatario_cpf_cnpj: documentoFiscal || null,
          destinatario_endereco: cliente?.endereco ? `${cliente.endereco}${cliente.numero ? `, ${cliente.numero}` : ""}` : null,
          destinatario_cidade_uf: cliente?.cidade ? `${cliente.cidade}${cliente.estado ? `/${cliente.estado}` : ""}` : null,
          destinatario_ie: cliente?.inscricao_estadual || null,
          destinatario_cep: cliente?.cep || null, destinatario_telefone: cliente?.telefone || null, valor_total: pedido.valor,
          forma_pagamento: pedido.forma_pagamento, natureza_operacao: "Venda de mercadoria",
          observacoes: pedido.observacoes, unidade_id: unidadeAtual.id, created_by: user?.id,
          integracao_payload: payload,
        }).select("id").single();
        if (criarError) throw criarError;
        notaId = criada.id;
      } else {
        await db.from("notas_fiscais").update({ status: "rascunho", provedor_status: "aguardando_agente", motivo_rejeicao: null, integracao_payload: payload }).eq("id", notaId);
      }

      const resposta = await emitirDocumentoVenderGas(payload);
      if (!resposta.ok) {
        if (notaId) await db.from("notas_fiscais").update({ provedor_status: resposta.motivo || "falha", motivo_rejeicao: resposta.mensagem, integracao_resultado: resposta }).eq("id", notaId);
        throw new Error(resposta.mensagem);
      }
      if (resposta.etapa === "pronta_para_revisao") {
        if (notaId) await db.from("notas_fiscais").update({
          status: "rascunho", provedor_status: "pronta_para_revisao",
          motivo_rejeicao: null, integracao_resultado: resposta,
        }).eq("id", notaId);
        toast.success(resposta.mensagem);
        onOpenChange(false);
        return;
      }
      if (notaId) await db.from("notas_fiscais").update({
        status: "autorizada", provedor_status: "autorizada", numero: resposta.numero || null,
        chave_acesso: resposta.chaveAcesso || null, protocolo: resposta.protocolo || null,
        provedor_referencia: resposta.chaveAcesso || resposta.numero || null, integracao_resultado: resposta,
      }).eq("id", notaId);
      toast.success(resposta.mensagem);
      onOpenChange(false);
    } catch (e: any) {
      setErro(e?.message || `Não foi possível emitir a ${rotulo}.`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={enviando ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary" />Emitir {rotulo} no Vender Gás</DialogTitle>
          <DialogDescription>Pedido #{pedido?.numero_sequencial ?? pedido?.id.slice(0, 8)} · {pedido?.cliente}</DialogDescription>
        </DialogHeader>
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Primeira emissão assistida</AlertTitle>
          <AlertDescription>
            O agente abrirá a conta da Forte Gás e preencherá a <strong>{rotulo}</strong>, mas não transmitirá a nota. Você assumirá a janela para conferir cliente, itens e o valor de <strong>R$ {Number(pedido?.valor || 0).toFixed(2)}</strong>. Na NFC-e, CPF/CNPJ é opcional; na NF-e, é obrigatório.
          </AlertDescription>
        </Alert>
        {tipoDocumento === "nfce" && (
          <div className="space-y-2">
            <Label htmlFor="documento-nfce">CPF ou CNPJ do consumidor (opcional)</Label>
            <Input
              id="documento-nfce"
              inputMode="numeric"
              autoComplete="off"
              value={documentoNfce}
              onChange={(event) => setDocumentoNfce(event.target.value.replace(/\D/g, "").slice(0, 14))}
              placeholder="Preencha somente quando o cliente solicitar"
              disabled={enviando}
            />
            <p className="text-xs text-muted-foreground">Os demais dados do destinatário não são necessários para NFC-e.</p>
          </div>
        )}
        {erro && <Alert variant="destructive"><AlertTitle>Emissão interrompida</AlertTitle><AlertDescription>{erro}</AlertDescription></Alert>}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={abrirLogin} disabled={enviando}><LogIn className="mr-2 h-4 w-4" />Abrir login</Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
            <Button type="button" onClick={emitir} disabled={enviando}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{enviando ? `Preparando ${rotulo}...` : `Preparar ${rotulo} para revisão`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
