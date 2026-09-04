import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright-core";

const VENDER_GAS_URL = "https://app.vendergas.com.br";
const OPERACAO_NFCE_VENDA_FORTE_GAS = "64bed19844829bd93b5eb6fe";
function urlEmissao(tipo: "nfe" | "nfce") {
  const operacao = tipo === "nfce" ? `id_operacaoFiscal=${OPERACAO_NFCE_VENDA_FORTE_GAS}&` : "";
  return `${VENDER_GAS_URL}/notaFiscal/emitir?${operacao}tipoNota=${tipo}&tipoEntradaSaida=1&cfe=false`;
}
let contexto: BrowserContext | null = null;

export interface EmissaoVenderGas {
  tipoDocumento: "nfe" | "nfce";
  cnpjEmitente: string;
  pedidoId: string;
  numeroPedido: string;
  somentePreparar?: boolean;
  destinatario: {
    nome: string; cpfCnpj?: string; inscricaoEstadual?: string; endereco?: string;
    numero?: string; bairro?: string; cep?: string; cidade?: string; uf?: string;
    codigoMunicipio?: string; telefone?: string;
  };
  itens: Array<{ descricao: string; quantidade: number; valorUnitario: number }>;
  valorTotal: number;
  formaPagamento?: string;
  observacoes?: string;
}

function executavelChrome(): string {
  const candidatos = [
    path.join(process.env.PROGRAMFILES ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.PROGRAMFILES ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  const encontrado = candidatos.find((arquivo) => arquivo && fs.existsSync(arquivo));
  if (!encontrado) throw new Error("Chrome ou Edge não encontrado neste computador.");
  return encontrado;
}

async function pagina(): Promise<Page> {
  if (!contexto) {
    const perfil = path.join(process.env.LOCALAPPDATA ?? os.tmpdir(), "GasFacil", "AgenteFiscal", "vendergas-profile");
    fs.mkdirSync(perfil, { recursive: true });
    contexto = await chromium.launchPersistentContext(perfil, {
      executablePath: executavelChrome(),
      headless: false,
      viewport: null,
      args: ["--start-maximized", "--disable-features=Translate"],
    });
  }
  return contexto.pages()[0] ?? await contexto.newPage();
}

async function preencher(page: Page, rotulo: RegExp, valor?: string) {
  if (!valor?.trim()) return;
  const porLabel = page.getByLabel(rotulo).first();
  if (await porLabel.count()) { await porLabel.fill(valor); return; }
  const label = page.locator("label").filter({ hasText: rotulo }).first();
  if (await label.count()) {
    const alvo = label.locator("xpath=following::input[1]");
    if (await alvo.count()) await alvo.fill(valor);
  }
}

async function clicarOpcao(page: Page, campo: RegExp, opcao: RegExp) {
  const porLabel = page.getByLabel(campo).first();
  const porTexto = page.getByText(campo).last();
  const seletor = await porLabel.count() ? porLabel : porTexto;
  if (!await seletor.count()) return false;
  await seletor.click();
  await page.waitForTimeout(350);
  const item = page.getByText(opcao, { exact: false }).last();
  if (!await item.count()) return false;
  await item.click();
  await page.waitForTimeout(350);
  return true;
}

function opcaoPagamento(forma?: string) {
  const normalizada = (forma ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalizada.includes("credito")) return /cart[aã]o.*cr[eé]dito/i;
  if (normalizada.includes("debito")) return /cart[aã]o.*d[eé]bito/i;
  if (normalizada.includes("pix")) return /pix/i;
  if (normalizada.includes("dinheiro")) return /dinheiro/i;
  if (normalizada.includes("fiado") || normalizada.includes("prazo")) return /fiado|a prazo/i;
  return forma?.trim() ? new RegExp(forma.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
}

function termosProduto(descricao: string) {
  const normalizada = descricao.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const termos = [descricao];
  const peso = normalizada.match(/(?:P|GAS\s*)(5|13|20|45)\b/)?.[1];
  if (peso) termos.unshift(`GÁS ${peso}`, `GAS ${peso}`);
  if (normalizada.includes("AGUA") && normalizada.includes("20")) termos.unshift("ÁGUA 20", "AGUA 20");
  return [...new Set(termos)];
}

async function garantirLogin(page: Page) {
  await page.goto(VENDER_GAS_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(1200);
  const url = page.url().toLowerCase();
  const temCampoSenha = await page.locator('input[type="password"]').count();
  if (url.includes("login") || temCampoSenha > 0) {
    return { ok: false as const, motivo: "login_necessario", mensagem: "Faça o login da Forte Gás na janela do Vender Gás e tente novamente." };
  }
  const texto = (await page.locator("body").innerText()).toUpperCase();
  if (!texto.includes("FORTE GAS") && !texto.includes("FORTE GÁS")) {
    return { ok: false as const, motivo: "empresa_incorreta", mensagem: "A sessão aberta não está identificada como Forte Gás. Troque a empresa no Vender Gás." };
  }
  return { ok: true as const };
}

export async function abrirLoginVenderGas() {
  const page = await pagina();
  await page.bringToFront();
  await page.goto(VENDER_GAS_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  return { ok: true, etapa: "login", url: page.url(), mensagem: "Janela do Vender Gás aberta. Entre somente com a conta da Forte Gás." };
}

export async function emitirNoVenderGas(payload: EmissaoVenderGas) {
  const tipo = payload.tipoDocumento === "nfce" ? "nfce" : "nfe";
  const rotulo = tipo === "nfce" ? "NFC-e" : "NF-e";
  if (!payload.pedidoId || !payload.destinatario?.nome || !payload.itens?.length) {
    return { ok: false, motivo: "dados_incompletos", mensagem: `Pedido, cliente e itens são obrigatórios para emitir a ${rotulo}.` };
  }
  const page = await pagina();
  await page.bringToFront();
  const login = await garantirLogin(page);
  if (!login.ok) return login;

  await page.goto(urlEmissao(tipo), { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(1500);
  const corpo = (await page.locator("body").innerText()).toUpperCase();
  if (!corpo.includes("EMITIR NOTA FISCAL")) {
    return { ok: false, motivo: "tela_emissao_indisponivel", mensagem: `O Vender Gás não abriu a tela de emissão de ${rotulo}.` };
  }

  // Falha fechada: nunca emite por uma operação de estorno/devolução selecionada.
  if (/ESTORNO|DEVOLU[CÇ][AÃ]O/.test(corpo) && !/VENDA DE MERCADORIA/.test(corpo)) {
    return { ok: false, motivo: "operacao_fiscal_incorreta", mensagem: "A operação fiscal selecionada no Vender Gás não é Venda de Mercadoria. Ajuste-a na janela aberta." };
  }

  // O estabelecimento vem preenchido em um input desabilitado; por isso seu
  // valor não aparece no innerText da página.
  const valorEstabelecimento = await page
    .locator('#est-selection-2, input[placeholder*="Estabelecimento" i], input[placeholder*="Empresa" i]')
    .first()
    .inputValue()
    .catch(() => "");
  const empresaVisivel = `${corpo} ${valorEstabelecimento}`.toUpperCase();
  if (!empresaVisivel.includes("FORTE GAS") && !empresaVisivel.includes("FORTE GÁS")) {
    const empresaSelecionada = await clicarOpcao(page, /selecionar estabelecimento|selecionar empresa|empresa/i, /forte g[aá]s/i);
    if (!empresaSelecionada) return { ok: false, motivo: "empresa_indisponivel", mensagem: "Não consegui selecionar a empresa Forte Gás na emissão." };
  }

  const pagamento = opcaoPagamento(payload.formaPagamento);
  if (pagamento && !await clicarOpcao(page, /tipo do pagamento|forma.*pagamento/i, pagamento)) {
    return { ok: false, motivo: "pagamento_indisponivel", mensagem: `Não consegui selecionar a forma de pagamento “${payload.formaPagamento}”.` };
  }

  const d = payload.destinatario;
  await preencher(page, /cnpj.*cpf|cpf.*cnpj/i, d.cpfCnpj);
  await preencher(page, /nome|raz[aã]o social/i, d.nome);
  await preencher(page, /inscri[cç][aã]o estadual/i, d.inscricaoEstadual);
  await preencher(page, /^endere[cç]o/i, d.endereco);
  await preencher(page, /^n[uú]mero/i, d.numero);
  await preencher(page, /bairro/i, d.bairro);
  await preencher(page, /cep/i, d.cep);
  await preencher(page, /munic[ií]pio|cidade/i, d.cidade);
  await preencher(page, /^uf$/i, d.uf);
  await preencher(page, /telefone/i, d.telefone);

  for (const item of payload.itens) {
    const buscar = page.locator("#input-buscar-produto");
    if (!await buscar.count()) return { ok: false, motivo: "produto_indisponivel", mensagem: "Não encontrei o botão Buscar Produto no Vender Gás." };
    let resultado: ReturnType<Page["locator"]> | null = null;
    for (const termo of termosProduto(item.descricao)) {
      await buscar.click();
      await buscar.fill(termo);
      const opcoes = page.locator('mat-option, [role="option"]').filter({ hasText: new RegExp(termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") });
      if (await opcoes.first().waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false)) {
        resultado = opcoes.first();
        break;
      }
    }
    if (!resultado) return { ok: false, motivo: "produto_nao_mapeado", mensagem: `Produto “${item.descricao}” não encontrado no Vender Gás. Cadastre ou iguale o nome antes de emitir.` };
    await resultado.click();
    await page.waitForTimeout(400);
    const quantidade = page.getByLabel(/quantidade/i).last();
    if (!await quantidade.count()) return { ok: false, motivo: "quantidade_indisponivel", mensagem: `Não encontrei o campo Quantidade para “${item.descricao}”.` };
    await quantidade.fill(String(item.quantidade));
    const valorUnitario = page.getByLabel(/valor unit[aá]rio|pre[cç]o unit[aá]rio/i).last();
    if (!await valorUnitario.count()) return { ok: false, motivo: "valor_unitario_indisponivel", mensagem: `Não encontrei o campo Valor unitário para “${item.descricao}”.` };
    await valorUnitario.fill(item.valorUnitario.toFixed(2).replace(".", ","));
  }

  await preencher(page, /informa[cç][oõ]es adicionais|observa[cç][oõ]es/i, `Pedido GasFacil #${payload.numeroPedido}. ${payload.observacoes ?? ""}`.trim());

  const botao = page.getByRole("button", { name: /^emitir nota fiscal$/i }).first();
  if (!await botao.count()) return { ok: false, motivo: "botao_emitir_indisponivel", mensagem: "O formulário foi preenchido, mas o botão Emitir Nota Fiscal não foi encontrado." };
  if (payload.somentePreparar) {
    await page.bringToFront();
    return {
      ok: true,
      etapa: "pronta_para_revisao",
      url: page.url(),
      mensagem: `${rotulo} preenchida no Vender Gás e pronta para sua conferência. Nenhuma nota foi transmitida.`,
    };
  }
  await botao.click();
  await page.waitForTimeout(1800);

  const resultado = await page.locator("body").innerText();
  const chave = resultado.match(/\b\d{44}\b/)?.[0];
  const numero = resultado.match(/(?:NFC-e|NF-e|Nota Fiscal)\D{0,20}(\d{1,12})/i)?.[1];
  const sucesso = /autorizad[ao]|nota fiscal emitida|emiss[aã]o conclu[ií]da/i.test(resultado);
  if (!sucesso) {
    return { ok: false, motivo: "emissao_nao_confirmada", etapa: "vendergas", url: page.url(), mensagem: "O Vender Gás não confirmou a autorização. Confira a mensagem exibida na janela; o GasFácil não registrou a nota como emitida." };
  }
  return { ok: true, etapa: "autorizada", numero, chaveAcesso: chave, url: page.url(), mensagem: `${rotulo} autorizada no Vender Gás.` };
}
