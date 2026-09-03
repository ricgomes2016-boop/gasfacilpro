import { useEffect, useState } from "react";
import { FileCheck2, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import type { PedidoFormatado } from "@/types/pedido";
import { abrirLoginVenderGas, emitirNfeVenderGas, type VenderGasPayload } from "@/lib/fiscal/venderGasAgent";
import { toast } from "sonner";

interface Props {
  pedido: PedidoFormatado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmitirNfeVenderGasDialog({ pedido, open, onOpenChange }: Props) {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const { user } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { if (open) setErro(null); }, [open, pedido?.id]);

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
      if (!pedido.cliente_id) throw new Error("Este pedido não possui um cliente cadastrado. Vincule o cliente antes de emitir a NF-e.");
      const { data: cliente, error: clienteError } = await supabase
        .from("clientes")
        .select("nome, razao_social, cpf, cnpj, inscricao_estadual, endereco, numero, bairro, cep, cidade, estado, codigo_municipio, telefone")
        .eq("id", pedido.cliente_id)
        .single();
      if (clienteError || !cliente) throw new Error("Não foi possível carregar os dados fiscais do cliente.");
      const documento = String(cliente.cnpj || cliente.cpf || "").replace(/\D/g, "");
      if (![11, 14].includes(documento.length)) throw new Error("Informe CPF ou CNPJ válido no cadastro do cliente.");
      if (!cliente.endereco || !cliente.numero || !cliente.cep || !cliente.cidade || !cliente.estado) {
        throw new Error("Complete endereço, número, CEP, cidade e UF no cadastro do cliente antes de emitir.");
      }
      if (!pedido.itens.length) throw new Error("O pedido não possui itens para faturamento.");

      const payload: VenderGasPayload = {
        unidadeId: unidadeAtual.id,
        cnpjEmitente: empresa.cnpj,
        pedidoId: pedido.id,
        numeroPedido: String(pedido.numero_sequencial ?? pedido.id.slice(0, 8)),
        destinatario: {
          nome: cliente.razao_social || cliente.nome,
          cpfCnpj: documento,
          inscricaoEstadual: cliente.inscricao_estadual || undefined,
          endereco: cliente.endereco,
          numero: cliente.numero,
          bairro: cliente.bairro || undefined,
          cep: cliente.cep,
          cidade: cliente.cidade,
          uf: cliente.estado,
          codigoMunicipio: cliente.codigo_municipio || undefined,
          telefone: cliente.telefone || undefined,
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
        .eq("pedido_id", pedido.id).eq("provedor", "vendergas").neq("status", "cancelada").maybeSingle();
      if (existente?.status === "autorizada") throw new Error(`Este pedido já possui a NF-e ${existente.numero || existente.chave_acesso || "autorizada"}.`);
      notaId = existente?.id ?? null;
      if (!notaId) {
        const { data: criada, error: criarError } = await db.from("notas_fiscais").insert({
          tipo: "nfe", status: "rascunho", pedido_id: pedido.id, provedor: "vendergas",
          provedor_status: "aguardando_agente", destinatario_nome: payload.destinatario.nome,
          destinatario_cpf_cnpj: documento, destinatario_endereco: `${cliente.endereco}, ${cliente.numero}`,
          destinatario_cidade_uf: `${cliente.cidade}/${cliente.estado}`, destinatario_ie: cliente.inscricao_estadual,
          destinatario_cep: cliente.cep, destinatario_telefone: cliente.telefone, valor_total: pedido.valor,
          forma_pagamento: pedido.forma_pagamento, natureza_operacao: "Venda de mercadoria",
          observacoes: pedido.observacoes, unidade_id: unidadeAtual.id, created_by: user?.id,
          integracao_payload: payload,
        }).select("id").single();
        if (criarError) throw criarError;
        notaId = criada.id;
      } else {
        await db.from("notas_fiscais").update({ status: "rascunho", provedor_status: "aguardando_agente", motivo_rejeicao: null, integracao_payload: payload }).eq("id", notaId);
      }

      const resposta = await emitirNfeVenderGas(payload);
      if (!resposta.ok) {
        await db.from("notas_fiscais").update({ provedor_status: resposta.motivo || "falha", motivo_rejeicao: resposta.mensagem, integracao_resultado: resposta }).eq("id", notaId);
        throw new Error(resposta.mensagem);
      }
      await db.from("notas_fiscais").update({
        status: "autorizada", provedor_status: "autorizada", numero: resposta.numero || null,
        chave_acesso: resposta.chaveAcesso || null, protocolo: resposta.protocolo || null,
        provedor_referencia: resposta.chaveAcesso || resposta.numero || null, integracao_resultado: resposta,
      }).eq("id", notaId);
      toast.success(resposta.mensagem);
      onOpenChange(false);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível emitir a NF-e.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={enviando ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary" />Emitir NF-e no Vender Gás</DialogTitle>
          <DialogDescription>Pedido #{pedido?.numero_sequencial ?? pedido?.id.slice(0, 8)} · {pedido?.cliente}</DialogDescription>
        </DialogHeader>
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Confirmação fiscal</AlertTitle>
          <AlertDescription>
            O agente abrirá a conta da Forte Gás, preencherá a venda e clicará em emitir. Confirme cliente, itens e valor de <strong>R$ {Number(pedido?.valor || 0).toFixed(2)}</strong>. A mesma venda não poderá ser emitida duas vezes.
          </AlertDescription>
        </Alert>
        {erro && <Alert variant="destructive"><AlertTitle>Emissão interrompida</AlertTitle><AlertDescription>{erro}</AlertDescription></Alert>}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={abrirLogin} disabled={enviando}><LogIn className="mr-2 h-4 w-4" />Abrir login</Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
            <Button type="button" onClick={emitir} disabled={enviando}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{enviando ? "Emitindo..." : "Confirmar e emitir"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
