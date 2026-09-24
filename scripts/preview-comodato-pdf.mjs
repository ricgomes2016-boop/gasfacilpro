import { mkdir, writeFile } from "node:fs/promises";
import { criarPdfComodato } from "../src/lib/comodatoPdf.ts";

const pdf = criarPdfComodato({
  id: "d8f2c420-71e0-40f7-90da-89ab33d44d00",
  modalidade: "formal",
  produto: "Vasilhame P13 vazio",
  quantidade: 5,
  quantidadeDevolvida: 2,
  dataEmprestimo: "2026-09-24",
  prazoDevolucao: "2026-10-24",
  custoReposicao: 155,
  responsavel: "Ana Souza",
  localEntrega: "Rua Exemplo, 120 - Centro",
  finalidade: "Uso na cozinha",
  observacoes: "Três unidades ainda devem ser devolvidas.",
  empresa: {
    nome: "Empresa de demonstração de gás",
    cnpj: "00.000.000/0001-00",
    telefone: "(43) 3000-0000",
    endereco: "Rua Exemplo, 20",
    cidade: "Cornélio Procópio",
    estado: "PR",
  },
  cliente: {
    nome: "Cliente de demonstração",
    documento: "000.000.000-00",
    endereco: "Rua Exemplo",
    numero: "120",
    cidade: "Cornélio Procópio",
  },
});

await mkdir("output/pdf", { recursive: true });
await writeFile("output/pdf/comodato-exemplo.pdf", Buffer.from(pdf.output("arraybuffer")));
