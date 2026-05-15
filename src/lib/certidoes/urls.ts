// URLs oficiais do Sintegra por UF
// Como cada UF tem captcha próprio, fornecemos a URL oficial e o usuário faz upload do PDF.
// O sistema controla o vencimento (geralmente 90 dias).
export const SINTEGRA_URLS: Record<string, { nome: string; url: string }> = {
  AC: { nome: "Acre", url: "http://sefaznet.ac.gov.br/sefaznet/asp/sintegra/Cliente.asp" },
  AL: { nome: "Alagoas", url: "http://sintegra.sefaz.al.gov.br/" },
  AM: { nome: "Amazonas", url: "https://online.sefaz.am.gov.br/Sintegra/" },
  AP: { nome: "Amapá", url: "https://www.sefaz.ap.gov.br/sintegra/" },
  BA: { nome: "Bahia", url: "http://www.sefaz.ba.gov.br/Sintegra/" },
  CE: { nome: "Ceará", url: "https://servicos.sefaz.ce.gov.br/internet/consultaPublica/sintegra.asp" },
  DF: { nome: "Distrito Federal", url: "http://www.fazenda.df.gov.br/area.cfm?id_area=110" },
  ES: { nome: "Espírito Santo", url: "https://app.sefaz.es.gov.br/Sintegra" },
  GO: { nome: "Goiás", url: "http://www.sefaz.go.gov.br/Sintegra/Consulta/default.asp" },
  MA: { nome: "Maranhão", url: "https://sistemas1.sefaz.ma.gov.br/portalsefaz/jsp/pagina/Sintegra/inicio.jsf" },
  MG: { nome: "Minas Gerais", url: "http://www4.fazenda.mg.gov.br/sintegra/" },
  MS: { nome: "Mato Grosso do Sul", url: "https://www.sintegra.ms.gov.br/" },
  MT: { nome: "Mato Grosso", url: "https://www.sefaz.mt.gov.br/sintegra/index.php" },
  PA: { nome: "Pará", url: "https://app.sefa.pa.gov.br/sintegra/" },
  PB: { nome: "Paraíba", url: "https://www3.receita.pb.gov.br/Sintegra/" },
  PE: { nome: "Pernambuco", url: "https://efisco.sefaz.pe.gov.br/sfi_com_sca/PRMontarConsultaContribuinteSintegra" },
  PI: { nome: "Piauí", url: "https://webas.sefaz.pi.gov.br/sintegra/" },
  PR: { nome: "Paraná", url: "https://www.fazenda.pr.gov.br/Servicos/Consultar-cadastro-ICMS" },
  RJ: { nome: "Rio de Janeiro", url: "http://www4.fazenda.rj.gov.br/sintegra/" },
  RN: { nome: "Rio Grande do Norte", url: "https://uvt2.set.rn.gov.br/#/services/cabecalho-sintegra" },
  RO: { nome: "Rondônia", url: "https://www.sintegra.sefin.ro.gov.br/" },
  RR: { nome: "Roraima", url: "https://www.sintegra.rr.gov.br/" },
  RS: { nome: "Rio Grande do Sul", url: "https://www.sefaz.rs.gov.br/Sintegra/" },
  SC: { nome: "Santa Catarina", url: "https://sat.sef.sc.gov.br/sintegra/" },
  SE: { nome: "Sergipe", url: "https://www.sefaz.se.gov.br/sintegra/" },
  SP: { nome: "São Paulo", url: "https://www.sintegra.fazenda.sp.gov.br/" },
  TO: { nome: "Tocantins", url: "https://sistemas.sefaz.to.gov.br/sintegra/" },
};

// URLs oficiais para emissão das CNDs
export const CND_URLS = {
  anp: {
    nome: "ANP - Revenda GLP",
    url: "https://app.anp.gov.br/anp-cpl-web/public/simp/consultaPostosRevendedoresGLP/consultaPostosGLPCBR.xhtml",
    validade_dias: 365,
  },
  cnd_federal: {
    nome: "CND Federal (Receita / PGFN)",
    url: "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir",
    validade_dias: 180,
  },
  cnd_municipal: {
    nome: "CND Municipal",
    url: null, // varia por município, mostraremos campo livre
    validade_dias: 90,
  },
  cndt: {
    nome: "CNDT (Trabalhista)",
    url: "https://cndt-certidao.tst.jus.br/inicio.faces",
    validade_dias: 180,
  },
};

// CND Estadual por UF (link para o portal da SEFAZ)
export const CND_ESTADUAL_URLS: Record<string, string> = {
  AC: "https://www.sefaz.ac.gov.br/wps/portal/sefaz/sefaz/servicos/certidaodebito",
  AL: "https://sistemas.sefaz.al.gov.br/Cre/CertidaoNegativa.aspx",
  AM: "https://online.sefaz.am.gov.br/cnd/",
  AP: "https://www.sefaz.ap.gov.br/cnd/",
  BA: "https://www.sefaz.ba.gov.br/scripts/cadastro/cndcontrib/index.asp",
  CE: "https://servicos.sefaz.ce.gov.br/internet/CertidaoFiscal/PsqCertidao.asp",
  DF: "https://www.receita.fazenda.df.gov.br/cidadao/certidao",
  ES: "https://internet.sefaz.es.gov.br/agenciavirtual/area_publica/e-cnd/index.php",
  GO: "https://www.sefaz.go.gov.br/Certidao/SolicitacaoCertidaoEletronica.asp",
  MA: "https://sistemas1.sefaz.ma.gov.br/portalsefaz/jsp/pagina/Certidao/inicio.jsf",
  MG: "http://www4.fazenda.mg.gov.br/sol/ctrl/SOL/CDT/SERVICO_829",
  MS: "https://www.icms.ms.gov.br/CertidaoNegativa/",
  MT: "https://www.sefaz.mt.gov.br/portal/cidadao/certidao-negativa-ms",
  PA: "https://app.sefa.pa.gov.br/CertidoesFazendarias/",
  PB: "https://www3.receita.pb.gov.br/atf/seg/SEGf_AcessarFuncao.jsp?cdFuncao=FIS_1097",
  PE: "https://efisco.sefaz.pe.gov.br/sfi_com_sca/PRMontarSolicitacaoCertidaoContribuinte",
  PI: "https://webas.sefaz.pi.gov.br/certidao/",
  PR: "https://www.arinternet.pr.gov.br/CertidaoNegativaWeb/",
  RJ: "https://www.fazenda.rj.gov.br/sefaz/faces/menu_structure/servicos/certidao",
  RN: "https://uvt2.set.rn.gov.br/#/services/emissao-certidao-negativa",
  RO: "https://agenciavirtual.sefin.ro.gov.br/publico/CertidaoNegativa/Solicitar.aspx",
  RR: "https://www.sefaz.rr.gov.br/certidao-negativa-de-debitos",
  RS: "https://www.sefaz.rs.gov.br/certidao/",
  SC: "https://sat.sef.sc.gov.br/tax.NET/Sat.CtaCte.Web/CertidaoNegativa.aspx",
  SE: "https://www.sefaz.se.gov.br/CNDOnline/",
  SP: "https://www10.fazenda.sp.gov.br/CertidaoNegativaDeb/Pages/EmissaoCertidaoNegativa.aspx",
  TO: "https://www.sefaz.to.gov.br/servicos/cidadao/emissao-de-certidoes/",
};
