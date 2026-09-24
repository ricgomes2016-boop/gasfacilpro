import { jsPDF } from "jspdf";

export interface ComodatoPdfInput {
  id: string;
  modalidade: "formal" | "rapido";
  documento?: "termo" | "extrato";
  produto: string;
  quantidade: number;
  quantidadeDevolvida: number;
  dataEmprestimo: string;
  prazoDevolucao?: string | null;
  custoReposicao: number;
  responsavel?: string | null;
  referencia?: string | null;
  localEntrega?: string | null;
  finalidade?: string | null;
  observacoes?: string | null;
  empresa: { nome: string; cnpj?: string | null; telefone?: string | null; endereco?: string | null; cidade?: string | null; estado?: string | null };
  cliente: { nome: string; documento?: string | null; telefone?: string | null; endereco?: string | null; numero?: string | null; cidade?: string | null };
  assinatura?: { imagem: string; nome: string; data: Date };
}

const azul: [number, number, number] = [35, 73, 153];
const texto: [number, number, number] = [27, 42, 65];
const cinza: [number, number, number] = [95, 111, 135];
const borda: [number, number, number] = [222, 231, 242];
const claro: [number, number, number] = [246, 249, 253];
const moeda = (valor: number) => `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const data = (valor?: string | null) => valor ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${valor.slice(0, 10)}T12:00:00Z`)) : "A combinar";

export function criarPdfComodato(input: ComodatoPdfInput): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margem = 16;
  const largura = 178;
  const total = Math.max(0, input.quantidade);
  const devolvido = Math.min(total, Math.max(0, input.quantidadeDevolvida));
  const pendente = total - devolvido;
  const formal = input.modalidade === "formal";
  let y = 16;

  const linha = (conteudo: string, x: number, posY: number, larguraMax: number, tamanho = 9, cor = texto) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(tamanho);
    pdf.setTextColor(...cor);
    const linhas = pdf.splitTextToSize(conteudo || "-", larguraMax) as string[];
    pdf.text(linhas, x, posY);
    return linhas.length * (tamanho * 0.43 + 1.2);
  };
  const tituloSecao = (titulo: string, posY: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...texto);
    pdf.text(titulo, margem, posY);
  };
  const rodape = () => {
    pdf.setDrawColor(...borda);
    pdf.line(margem, 281, 194, 281);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...cinza);
    pdf.text("Controle de vasilhames vazios - não substitui documento fiscal da venda de GLP.", margem, 287);
    pdf.text(`Ref. ${input.id.slice(0, 8).toUpperCase()}  |  ${pdf.getCurrentPageInfo().pageNumber}/${pdf.getNumberOfPages()}`, 194, 287, { align: "right" });
  };
  const proximaPagina = () => {
    pdf.addPage();
    pdf.setFillColor(...azul);
    pdf.rect(margem, 14, largura, 1.4, "F");
    y = 27;
  };

  pdf.setFillColor(...azul);
  pdf.roundedRect(margem, y, 11, 11, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  const iniciais = input.empresa.nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase();
  pdf.text(iniciais || "VG", margem + 5.5, y + 7.2, { align: "center" });
  pdf.setFontSize(9);
  pdf.setTextColor(...texto);
  const empresaLinhas = pdf.splitTextToSize(input.empresa.nome.toUpperCase(), 112) as string[];
  pdf.text(empresaLinhas, margem + 15, y + 3.8);
  let metaY = y + 4 + empresaLinhas.length * 4;
  metaY += linha([input.empresa.cnpj && `CNPJ ${input.empresa.cnpj}`, input.empresa.telefone && `Tel. ${input.empresa.telefone}`].filter(Boolean).join("  |  "), margem + 15, metaY, 145, 7.5, cinza);
  const enderecoEmpresa = [input.empresa.endereco, [input.empresa.cidade, input.empresa.estado].filter(Boolean).join(" - ")].filter(Boolean).join("  |  ");
  if (enderecoEmpresa) metaY += linha(enderecoEmpresa, margem + 15, metaY, 145, 7.5, cinza);
  y = Math.max(y + 17, metaY + 3);
  pdf.setDrawColor(...borda);
  pdf.line(margem, y, 194, y);
  y += 10;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.setTextColor(...texto);
  pdf.text(input.documento === "extrato" ? "Extrato de vasilhames" : formal ? "Termo de comodato" : "Comprovante de empréstimo", margem, y);
  y += 6;
  linha(input.documento === "extrato" ? "Posição atual do empréstimo e das devoluções" : "Vasilhames vazios  |  Registro de entrega e devolução", margem, y, largura, 9, cinza);
  y += 9;

  const enderecoCliente = [input.cliente.endereco, input.cliente.numero, input.cliente.cidade].filter(Boolean).join(", ");
  const clienteLinhas = pdf.splitTextToSize(input.cliente.nome, 76) as string[];
  const enderecoLinhas = pdf.splitTextToSize(enderecoCliente || "Endereço não informado", 76) as string[];
  const alturaCartao = Math.max(40, 24 + (clienteLinhas.length + enderecoLinhas.length) * 4);
  const cartao = (x: number, rotulo: string) => {
    pdf.setFillColor(...claro);
    pdf.setDrawColor(...borda);
    pdf.roundedRect(x, y, 86, alturaCartao, 2.5, 2.5, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...azul);
    pdf.text(rotulo.toUpperCase(), x + 5, y + 7);
  };
  cartao(margem, "Cliente");
  cartao(108, "Entrega");
  let cy = y + 14;
  cy += linha(input.cliente.nome, margem + 5, cy, 76, 10, texto);
  cy += linha(input.cliente.documento ? `CPF/CNPJ: ${input.cliente.documento}` : "Documento não informado", margem + 5, cy, 76, 8, cinza);
  linha(enderecoCliente || "Endereço não informado", margem + 5, cy, 76, 8, cinza);
  let dy = y + 14;
  dy += linha(`Empréstimo: ${data(input.dataEmprestimo)}`, 113, dy, 76, 8, texto);
  dy += linha(`Devolução prevista: ${data(input.prazoDevolucao)}`, 113, dy, 76, 8, texto);
  linha(`Tipo: ${formal ? "Comodato formal" : "Empréstimo rápido"}`, 113, dy, 76, 8, cinza);
  y += alturaCartao + 10;

  tituloSecao("Movimentação de vasilhames", y);
  y += 5;
  pdf.setFillColor(...azul);
  pdf.roundedRect(margem, y, largura, 10, 1.5, 1.5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text("PRODUTO", margem + 5, y + 6.5);
  pdf.text("EMPRESTADO", 122, y + 6.5, { align: "right" });
  pdf.text("DEVOLVIDO", 157, y + 6.5, { align: "right" });
  pdf.text("DIFERENÇA", 190, y + 6.5, { align: "right" });
  y += 10;
  const produtoLinhas = pdf.splitTextToSize(input.produto, 68) as string[];
  const alturaLinha = Math.max(15, 8 + produtoLinhas.length * 4);
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(...borda);
  pdf.rect(margem, y, largura, alturaLinha, "FD");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...texto);
  pdf.text(produtoLinhas, margem + 5, y + 6);
  pdf.text(String(total), 122, y + 8, { align: "right" });
  pdf.text(String(devolvido), 157, y + 8, { align: "right" });
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...azul);
  pdf.text(String(pendente), 190, y + 8, { align: "right" });
  y += alturaLinha + 6;

  pdf.setFillColor(...claro);
  pdf.setDrawColor(...borda);
  pdf.roundedRect(margem, y, largura, 19, 2.5, 2.5, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...texto);
  pdf.text(`Custo de reposição por unidade: ${moeda(input.custoReposicao)}`, margem + 5, y + 7);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...cinza);
  pdf.text(`Exposição das ${pendente} unidade(s) pendente(s): ${moeda(pendente * input.custoReposicao)}. Não é cobrança neste empréstimo.`, margem + 5, y + 14, { maxWidth: largura - 10 });
  y += 25;

  tituloSecao("Condições e observações", y);
  y += 6;
  const condicoes = formal
    ? "O cliente recebe os vasilhames vazios para uso conforme combinado e compromete-se a conservá-los e devolvê-los no prazo. Em caso de perda ou não devolução, o custo de reposição informado poderá ser apurado para as unidades faltantes. A venda de GLP é operação separada."
    : "O cliente confirma o empréstimo dos vasilhames vazios e a devolução no prazo combinado. O custo de reposição aplica-se apenas às unidades perdidas ou não devolvidas. A venda de GLP é operação separada.";
  y += linha(condicoes, margem, y, largura, 8.5, texto) + 4;
  if (input.localEntrega || input.responsavel || input.referencia || input.finalidade || input.observacoes) {
    const extras = [
      input.responsavel && `Responsável: ${input.responsavel}`,
      input.localEntrega && `Local: ${input.localEntrega}`,
      input.referencia && `Referência: ${input.referencia}`,
      input.finalidade && `Finalidade: ${input.finalidade}`,
      input.observacoes && `Observações: ${input.observacoes}`,
    ].filter(Boolean) as string[];
    for (const extra of extras) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...cinza);
      for (const trecho of pdf.splitTextToSize(extra, largura) as string[]) {
        if (y + 5 > 235) proximaPagina();
        pdf.text(trecho, margem, y);
        y += 4.6;
      }
      y += 1;
    }
  }
  if (y > 234) proximaPagina();
  if (input.documento === "extrato") {
    y = Math.max(y + 12, 236);
    linha("Extrato informativo da posição atual. O termo originalmente assinado permanece preservado e não é substituído por este documento.", margem, y, largura, 8, cinza);
  } else {
    y = Math.max(y + 15, 236);
    pdf.setDrawColor(148, 163, 184);
    pdf.line(margem, y, 92, y);
    pdf.line(118, y, 194, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...cinza);
    pdf.text("Cedente", 54, y + 5, { align: "center" });
    pdf.text("Cliente / responsável", 156, y + 5, { align: "center" });
    if (input.assinatura) {
      pdf.addImage(input.assinatura.imagem, "PNG", 125, y - 22, 62, 20);
      pdf.setFontSize(7.5);
      pdf.text(`Aceite eletrônico manuscrito: ${input.assinatura.nome}`, 118, y + 11, { maxWidth: 76 });
      pdf.text(`Registrado em ${input.assinatura.data.toLocaleString("pt-BR")}`, 118, y + 16);
    }
  }
  for (let pagina = 1; pagina <= pdf.getNumberOfPages(); pagina++) {
    pdf.setPage(pagina);
    rodape();
  }
  return pdf;
}
