import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

interface GerarOptions {
  pedidoId: string;
  download?: boolean; // true: salva arquivo; false: retorna blob
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
};

const fmtMoney = (v?: number | null) =>
  `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function gerarComprovanteEntregaPdf({ pedidoId, download = true }: GerarOptions) {
  // Buscar pedido + itens + cliente + unidade + entregador
  const { data: pedido, error: pErr } = await supabase
    .from("pedidos")
    .select(`
      id, numero_sequencial, created_at, data_entrega, valor_total,
      endereco_entrega, observacoes, forma_pagamento, status,
      unidade_id, cliente_id, entregador_id,
      clientes:cliente_id (nome, telefone, cpf, endereco, numero, bairro, cidade),
      unidades:unidade_id (nome, telefone, endereco, cnpj),
      entregadores:entregador_id (nome),
      pedido_itens (quantidade, preco_unitario, produtos:produto_id (nome))
    `)
    .eq("id", pedidoId)
    .maybeSingle();

  if (pErr || !pedido) throw new Error(pErr?.message || "Pedido não encontrado");

  // Buscar comprovante (pode não existir)
  const { data: comprovante } = await (supabase as any)
    .from("comprovantes_entrega")
    .select("*")
    .eq("pedido_id", pedidoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Comprovante de Entrega", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Emitido em ${fmtDate(new Date().toISOString())}`, margin, y);
  doc.setTextColor(0);
  y += 6;

  // Unidade
  const u: any = pedido.unidades;
  if (u) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(u.nome || "Unidade", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (u.cnpj) { doc.text(`CNPJ: ${u.cnpj}`, margin, y); y += 4; }
    if (u.endereco) { doc.text(u.endereco, margin, y); y += 4; }
    if (u.telefone) { doc.text(`Tel: ${u.telefone}`, margin, y); y += 4; }
  }

  y += 2;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Bloco pedido
  const numero = (pedido as any).numero_sequencial
    ? `#${(pedido as any).numero_sequencial}`
    : `#${pedido.id.slice(0, 8).toUpperCase()}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Pedido ${numero}`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Status: ${pedido.status || "—"}`, pageW - margin, y, { align: "right" });
  y += 5;

  const c: any = pedido.clientes;
  const linhasCliente: string[] = [];
  if (c?.nome) linhasCliente.push(`Cliente: ${c.nome}`);
  if (c?.telefone) linhasCliente.push(`Telefone: ${c.telefone}`);
  if (c?.cpf) linhasCliente.push(`CPF: ${c.cpf}`);
  const ender = (pedido as any).endereco_entrega ||
    [c?.endereco, c?.numero, c?.bairro, c?.cidade].filter(Boolean).join(", ");
  if (ender) linhasCliente.push(`Endereço: ${ender}`);
  if ((pedido as any).entregadores?.nome) linhasCliente.push(`Entregador: ${(pedido as any).entregadores.nome}`);
  if (pedido.data_entrega) linhasCliente.push(`Data entrega: ${fmtDate(pedido.data_entrega)}`);
  if (pedido.forma_pagamento) linhasCliente.push(`Forma pagto: ${pedido.forma_pagamento}`);

  for (const linha of linhasCliente) {
    doc.text(linha, margin, y);
    y += 4;
  }
  y += 2;

  // Tabela itens
  const itens = ((pedido as any).pedido_itens || []) as any[];
  autoTable(doc, {
    startY: y,
    head: [["Qtd", "Produto", "Preço un.", "Subtotal"]],
    body: itens.map((i) => [
      i.quantidade,
      i.produtos?.nome || "—",
      fmtMoney(i.preco_unitario),
      fmtMoney(Number(i.quantidade) * Number(i.preco_unitario)),
    ]),
    foot: [[
      "", "", "TOTAL",
      fmtMoney(pedido.valor_total ||
        itens.reduce((a, i) => a + Number(i.quantidade) * Number(i.preco_unitario), 0))
    ]],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 40, 40] },
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Bloco comprovante
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Comprovante de Recebimento", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  if (!comprovante) {
    doc.setTextColor(150);
    doc.text("Nenhum comprovante registrado para este pedido.", margin, y);
    doc.setTextColor(0);
    y += 6;
  } else {
    if (comprovante.nome_recebedor) {
      doc.text(`Recebedor: ${comprovante.nome_recebedor}`, margin, y); y += 4;
    }
    if (comprovante.documento_recebedor) {
      doc.text(`Documento: ${comprovante.documento_recebedor}`, margin, y); y += 4;
    }
    doc.text(`Assinado em: ${fmtDate(comprovante.assinado_em)}`, margin, y); y += 4;
    if (comprovante.latitude && comprovante.longitude) {
      doc.text(
        `Localização: ${Number(comprovante.latitude).toFixed(5)}, ${Number(comprovante.longitude).toFixed(5)}`,
        margin, y,
      ); y += 4;
    }
    if (comprovante.observacao) {
      doc.text(`Obs: ${comprovante.observacao}`, margin, y, { maxWidth: pageW - 2 * margin });
      y += 6;
    }
    y += 2;

    if (comprovante.assinatura_url) {
      const dataUrl = await fetchImageAsDataUrl(comprovante.assinatura_url);
      if (dataUrl) {
        doc.setFont("helvetica", "bold");
        doc.text("Assinatura:", margin, y);
        y += 3;
        try {
          doc.addImage(dataUrl, "PNG", margin, y, 80, 30);
          y += 32;
        } catch {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(150);
          doc.text("(falha ao incorporar imagem da assinatura)", margin, y);
          doc.setTextColor(0);
          y += 5;
        }
      }
    } else {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 50, 50);
      doc.text("⚠ Cliente recusou assinar", margin, y);
      doc.setTextColor(0);
      y += 6;
    }
  }

  // Rodapé com validade jurídica
  const footY = doc.internal.pageSize.getHeight() - 12;
  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.text(
    "Documento gerado eletronicamente. Validade conforme MP 2.200-2/2001, art. 10, §2º (assinatura eletrônica simples).",
    pageW / 2, footY, { align: "center", maxWidth: pageW - 2 * margin },
  );

  const filename = `comprovante-${numero.replace("#", "")}.pdf`;
  if (download) {
    doc.save(filename);
    return null;
  }
  return { blob: doc.output("blob"), filename };
}
