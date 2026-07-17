import {
  ScanBarcode, CreditCard, FileText, Globe, Phone, Mail, Truck, BarChart3,
  MessageSquare, Webhook, Zap, Banknote,
} from "lucide-react";
import type { Integracao } from "./types";

export const integracoes: Integracao[] = [
  {
    id: "boleto_leitura",
    nome: "Leitura de Boletos (IA)",
    descricao: "Escaneie boletos com a câmera ou envie PDF — a IA extrai fornecedor, valor, vencimento e código de barras automaticamente",
    icon: ScanBarcode,
    status: "conectado",
    categoria: "pagamento",
    configFields: [
      { key: "habilitado", label: "Leitura de boletos habilitada", type: "text", placeholder: "sim" },
    ],
    beneficios: [
      "Leitura automática por câmera ou PDF",
      "Extração de código de barras e linha digitável",
      "Classificação automática de categoria",
      "Lançamento direto em Contas a Pagar",
    ],
  },
  {
    id: "pix",
    nome: "PIX Automático",
    descricao: "Geração de QR Code PIX para pagamentos instantâneos com conciliação automática",
    icon: CreditCard,
    status: "conectado",
    categoria: "pagamento",
    configFields: [
      { key: "chave_pix", label: "Chave PIX", type: "text", placeholder: "CPF, CNPJ, e-mail ou telefone" },
      { key: "nome_beneficiario", label: "Nome do beneficiário", type: "text", placeholder: "Nome que aparece no PIX" },
    ],
    beneficios: [
      "QR Code dinâmico por venda",
      "Conciliação automática de recebimentos",
      "Múltiplas chaves por unidade",
    ],
  },
  {
    id: "asaas",
    nome: "Asaas (Boleto + PIX Registrado)",
    descricao: "Emita boletos bancários registrados e cobranças PIX direto do Contas a Receber via Asaas",
    icon: Banknote,
    status: "disponivel",
    categoria: "pagamento",
    configFields: [
      { key: "asaas_api_key", label: "API Key Asaas", type: "password", placeholder: "$aact_xxxxxxxxxxxxxxxx..." },
    ],
    beneficios: [
      "Boleto registrado com linha digitável e PDF",
      "Cobrança PIX com QR Code dinâmico",
      "Conta por empresa (sandbox ou produção)",
      "Vínculo automático ao lançamento de Contas a Receber",
    ],
    helpUrl: "https://www.asaas.com/config/index#tab_api",
  },
  {
    id: "pagbank",
    nome: "PagBank / Maquininha",
    descricao: "Integração com terminais físicos PagBank para débito, crédito e PIX na maquininha",
    icon: CreditCard,
    status: "conectado",
    categoria: "pagamento",
    configFields: [
      { key: "terminal_serial", label: "Serial do Terminal", type: "text", placeholder: "Número de série da maquininha" },
      { key: "pagbank_token", label: "Token PagBank", type: "password", placeholder: "Token de integração" },
    ],
    beneficios: [
      "Débito, crédito e PIX via terminal",
      "Cálculo automático de taxas",
      "Agenda de recebíveis D+1/D+30",
      "Dashboard financeiro por terminal",
    ],
  },
  {
    id: "nfe",
    nome: "Emissão de NF-e / NFC-e",
    descricao: "Emissão automática de notas fiscais integrada ao módulo fiscal via Focus NFe",
    icon: FileText,
    status: "disponivel",
    categoria: "fiscal",
    configFields: [
      { key: "FOCUS_NFE_TOKEN", label: "Token Focus NFe", type: "password", placeholder: "Token da API Focus NFe" },
      { key: "FOCUS_NFE_ENV", label: "Ambiente", type: "text", placeholder: "homologacao ou producao" },
    ],
    beneficios: [
      "NF-e, NFC-e, CT-e e MDF-e",
      "Envio automático ao SEFAZ",
      "XML e DANFE gerados automaticamente",
    ],
    helpUrl: "https://focusnfe.com.br/",
  },
  {
    id: "google_maps",
    nome: "Google Maps",
    descricao: "Geocodificação de endereços e otimização de rotas de entrega em tempo real",
    icon: Globe,
    status: "conectado",
    categoria: "logistica",
    configFields: [
      { key: "google_maps_api_key", label: "API Key Google Maps", type: "password", placeholder: "Chave da API Google Maps" },
    ],
    beneficios: [
      "Geocodificação automática de clientes",
      "Otimização de rotas de entrega",
      "Rastreamento em tempo real",
      "Mapa de calor de clientes",
    ],
  },
  {
    id: "bina_goto",
    nome: "Bina / GoTo Connect",
    descricao: "Identificação automática de chamadas recebidas com popup do cliente e histórico",
    icon: Phone,
    status: "disponivel",
    categoria: "comunicacao",
    configFields: [
      { key: "GOTO_CLIENT_ID", label: "Client ID", type: "text", placeholder: "Client ID GoTo" },
      { key: "GOTO_SECRET", label: "Client Secret", type: "password", placeholder: "Secret GoTo" },
    ],
    beneficios: [
      "Popup com dados do cliente ao receber ligação",
      "Histórico de chamadas integrado",
      "Criação de pedido direto da ligação",
    ],
    helpUrl: "https://developer.goto.com/",
  },
  {
    id: "email_smtp",
    nome: "E-mail Transacional",
    descricao: "Envio de boletos, notas fiscais e lembretes por e-mail (modo simulação — configure SMTP para envio real)",
    icon: Mail,
    status: "conectado",
    categoria: "comunicacao",
    configFields: [
      { key: "smtp_host", label: "Servidor SMTP", type: "text", placeholder: "smtp.gmail.com" },
      { key: "smtp_port", label: "Porta", type: "text", placeholder: "587" },
      { key: "smtp_user", label: "Usuário", type: "text", placeholder: "email@empresa.com" },
      { key: "smtp_password", label: "Senha", type: "password", placeholder: "Senha do e-mail" },
    ],
    beneficios: [
      "Envio de NF-e e boletos por e-mail",
      "Templates personalizáveis por tipo",
      "Histórico completo de envios",
      "Automações configuráveis",
    ],
  },
  {
    id: "ifood",
    nome: "iFood / Rappi",
    descricao: "Recebimento automático de pedidos de marketplaces de delivery",
    icon: Truck,
    status: "em_breve",
    categoria: "logistica",
    beneficios: [
      "Pedidos sincronizados automaticamente",
      "Status atualizado em tempo real",
      "Cardápio integrado",
    ],
  },
  {
    id: "contabilidade",
    nome: "Exportação Contábil",
    descricao: "Exportação de lançamentos financeiros em XLSX para Domínio, Alterdata, Fortes e SPED EFD",
    icon: BarChart3,
    status: "conectado",
    categoria: "produtividade",
    configFields: [
      { key: "sistema_contabil", label: "Sistema Contábil", type: "text", placeholder: "Domínio, Alterdata, Fortes..." },
      { key: "codigo_empresa", label: "Código da Empresa", type: "text", placeholder: "Código no sistema contábil" },
    ],
    beneficios: [
      "CSV e XLSX para importação direta",
      "Formatos Domínio, Alterdata e Fortes",
      "Layout SPED EFD simplificado",
      "Exportação por período e unidade",
    ],
  },
  {
    id: "whatsapp_meta",
    nome: "WhatsApp Oficial (Meta Cloud API)",
    descricao: "Conecte a Assistente BIA ao WhatsApp Oficial via API da Meta — com suporte a Coexistência (QR Code) para usar o mesmo número no celular e na API simultaneamente",
    icon: MessageSquare,
    status: "disponivel",
    categoria: "comunicacao",
    beneficios: [
      "Coexistência: use o WhatsApp no celular e na API ao mesmo tempo",
      "Embedded Signup: conecte via Facebook com QR Code",
      "Número de telefone oficial verificado pela Meta",
      "Mensagens via Cloud API com alta confiabilidade",
      "Suporte a texto, áudio, imagens e interações",
      "Webhook configurado automaticamente",
    ],
    helpUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
  },
  {
    id: "webhook",
    nome: "Webhooks Customizados",
    descricao: "Envie eventos do sistema (novo pedido, status, pagamento) para qualquer endpoint externo",
    icon: Webhook,
    status: "disponivel",
    categoria: "produtividade",
    configFields: [
      { key: "WEBHOOK_URL", label: "URL do Webhook", type: "url", placeholder: "https://seu-sistema.com/webhook" },
      { key: "WEBHOOK_SECRET", label: "Secret (opcional)", type: "password", placeholder: "Chave de autenticação" },
    ],
    beneficios: [
      "Eventos em tempo real para sistemas externos",
      "Automação com Zapier, Make, N8N",
      "Payload customizável por evento",
    ],
  },
];

export const statusConfig = {
  conectado: { label: "Conectado", variant: "default" as const, dotColor: "bg-success" },
  disponivel: { label: "Disponível", variant: "secondary" as const, dotColor: "bg-info" },
  em_breve: { label: "Em breve", variant: "outline" as const, dotColor: "bg-muted-foreground" },
};

export const categoriasLabel: Record<string, { label: string; icon: React.ElementType }> = {
  pagamento: { label: "Pagamento", icon: CreditCard },
  comunicacao: { label: "Comunicação", icon: MessageSquare },
  fiscal: { label: "Fiscal", icon: FileText },
  logistica: { label: "Logística", icon: Truck },
  produtividade: { label: "Produtividade", icon: Zap },
};
