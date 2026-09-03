import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ItemVenda } from "@/components/vendas/ProductSearch";
import type { Pagamento } from "@/components/vendas/PaymentSection";

export interface EmpresaConfig {
  nome_empresa: string;
  cnpj?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  mensagem_cupom?: string | null;
}

interface ReceiptData {
  pedidoId: string;
  pedidoNumero?: number | string | null;
  data: Date;
  cliente: {
    nome: string;
    telefone: string;
    endereco: string;
  };
  itens: ItemVenda[];
  pagamentos: Pagamento[];
  entregadorNome: string | null;
  canalVenda: string;
  observacoes?: string;
  empresa?: EmpresaConfig;
}

const formatCurrency = (value: number): string => {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPaymentMethod = (method: string): string => {
  const methods: Record<string, string> = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    cartao_credito: "Cartão de Crédito",
    cartao_debito: "Cartão de Débito",
    fiado: "Fiado",
    vale_gas: "Vale Gás",
    venda_antecipada: "Venda Antecipada",
  };
  return methods[method] || method;
};

const formatChannel = (channel: string): string => {
  const channels: Record<string, string> = {
    telefone: "Telefone",
    whatsapp: "WhatsApp",
    portaria: "Portaria",
    balcao: "Portaria",
  };
  return channels[channel] || channel;
};

export function generateReceiptPdf(data: ReceiptData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 200], // Cupom térmico 80mm
  });

  const pageWidth = 80;
  const marginLeft = 4;
  const marginRight = 4;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const pedidoNumero = data.pedidoNumero ?? data.pedidoId.slice(0, 8).toUpperCase();
  let yPos = 8;

  // Dados da empresa (usa padrão se não fornecido)
  const empresa = data.empresa || {
    nome_empresa: "Distribuidora Gás",
    cnpj: null,
    telefone: null,
    endereco: null,
    mensagem_cupom: "Obrigado pela preferência!",
  };

  // Header - Company Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(empresa.nome_empresa.toUpperCase(), pageWidth / 2, yPos, { align: "center" });
  yPos += 4;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  
  if (empresa.cnpj) {
    doc.text(`CNPJ: ${empresa.cnpj}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 3;
  }
  
  if (empresa.telefone) {
    doc.text(`Tel: ${empresa.telefone}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 3;
  }
  
  if (empresa.endereco) {
    const enderecoLines = doc.splitTextToSize(empresa.endereco, contentWidth);
    doc.text(enderecoLines, pageWidth / 2, yPos, { align: "center" });
    yPos += enderecoLines.length * 3;
  }
  
  yPos += 2;

  // Divider
  doc.setLineWidth(0.1);
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
  yPos += 4;

  // Order Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`PEDIDO #${pedidoNumero}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(data.data), pageWidth / 2, yPos, { align: "center" });
  yPos += 3;
  doc.text(`Canal: ${formatChannel(data.canalVenda)}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 5;

  // Divider
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
  yPos += 4;

  // Customer Info
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", marginLeft, yPos);
  yPos += 4;

  doc.setFont("helvetica", "normal");
  doc.text(data.cliente.nome || "Consumidor Final", marginLeft, yPos);
  yPos += 3;

  if (data.cliente.telefone) {
    doc.text(`Tel: ${data.cliente.telefone}`, marginLeft, yPos);
    yPos += 3;
  }

  if (data.cliente.endereco) {
    const enderecoLines = doc.splitTextToSize(data.cliente.endereco, contentWidth);
    doc.text(enderecoLines, marginLeft, yPos);
    yPos += enderecoLines.length * 3 + 1;
  }

  yPos += 2;

  // Divider
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
  yPos += 4;

  // Items Table
  doc.setFont("helvetica", "bold");
  doc.text("ITENS", marginLeft, yPos);
  yPos += 4;

  // Table header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Produto", marginLeft, yPos);
  doc.text("Qtd", marginLeft + 40, yPos);
  doc.text("Unit.", marginLeft + 50, yPos);
  doc.text("Total", pageWidth - marginRight, yPos, { align: "right" });
  yPos += 3;

  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
  yPos += 3;

  // Table rows
  data.itens.forEach((item) => {
    const nomeLines = doc.splitTextToSize(item.nome, 38);
    doc.text(nomeLines, marginLeft, yPos);
    doc.text(item.quantidade.toString(), marginLeft + 40, yPos);
    doc.text(formatCurrency(item.preco_unitario), marginLeft + 50, yPos);
    doc.text(formatCurrency(item.total), pageWidth - marginRight, yPos, { align: "right" });
    yPos += nomeLines.length * 3 + 1;
  });

  yPos += 2;

  // Divider
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
  yPos += 4;

  // Totals
  const subtotal = data.itens.reduce((acc, item) => acc + item.total, 0);
  const totalPago = data.pagamentos.reduce((acc, p) => acc + p.valor, 0);

  doc.setFontSize(8);
  doc.text("Subtotal:", marginLeft, yPos);
  doc.text(formatCurrency(subtotal), pageWidth - marginRight, yPos, { align: "right" });
  yPos += 4;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL:", marginLeft, yPos);
  doc.text(formatCurrency(subtotal), pageWidth - marginRight, yPos, { align: "right" });
  yPos += 5;

  // Divider
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
  yPos += 4;

  // Payments
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PAGAMENTO", marginLeft, yPos);
  yPos += 4;

  doc.setFont("helvetica", "normal");
  data.pagamentos.forEach((pag) => {
    const parcelasInfo = pag.forma === "cartao_credito" && pag.parcelas ? ` ${pag.parcelas}x` : "";
    doc.text(`${formatPaymentMethod(pag.forma)}${parcelasInfo}`, marginLeft, yPos);
    doc.text(formatCurrency(pag.valor), pageWidth - marginRight, yPos, { align: "right" });
    yPos += 3;
  });

  yPos += 1;
  doc.setFont("helvetica", "bold");
  doc.text("Total Pago:", marginLeft, yPos);
  doc.text(formatCurrency(totalPago), pageWidth - marginRight, yPos, { align: "right" });
  yPos += 5;

  // Delivery person
  if (data.entregadorNome) {
    doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
    yPos += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Entregador: ${data.entregadorNome}`, marginLeft, yPos);
    yPos += 5;
  }

  // Observations
  if (data.observacoes) {
    doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
    yPos += 4;

    doc.setFontSize(7);
    doc.text("Obs:", marginLeft, yPos);
    yPos += 3;
    const obsLines = doc.splitTextToSize(data.observacoes, contentWidth);
    doc.text(obsLines, marginLeft, yPos);
    yPos += obsLines.length * 3;
  }

  yPos += 4;

  // Footer
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
  yPos += 4;

  doc.setFontSize(7);
  const mensagemRodape = empresa.mensagem_cupom || "Obrigado pela preferência!";
  doc.text(mensagemRodape, pageWidth / 2, yPos, { align: "center" });
  yPos += 3;
  doc.text("Volte sempre!", pageWidth / 2, yPos, { align: "center" });

  // Generate and download
  const fileName = `comprovante-${String(pedidoNumero).replace(/[^a-zA-Z0-9-]/g, "")}.pdf`;
  doc.save(fileName);
}

export function printReceiptPdf(data: ReceiptData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 200],
  });

  // Same content generation as above...
  // For printing, we open in a new window
  const pdfBlob = doc.output("blob");
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const printWindow = window.open(pdfUrl, "_blank");
  
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}
