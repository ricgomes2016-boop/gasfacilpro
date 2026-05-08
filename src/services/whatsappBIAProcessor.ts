/**
 * Serviço de processamento de mensagens com BIA (Assistente de Atendimento Automático)
 * Utiliza LLM para extrair intenção, dados e gerar respostas
 */

export interface ExtractedOrderData {
  produto?: string;
  quantidade?: number;
  endereco?: string;
  clienteName?: string;
  telefone?: string;
  observacoes?: string;
}

export interface ProcessedMessage {
  intent: "pedido" | "duvida" | "reclamacao" | "transferencia" | "outro";
  confidence: number;
  extractedData: ExtractedOrderData;
  shouldTransfer: boolean;
  transferReason?: string;
  response: string;
}

/**
 * Processa mensagem com BIA
 * Nota: Esta é uma implementação de exemplo. Em produção, integrar com LLM real
 */
export async function processMessageWithBIA(
  message: string,
  contactName: string,
  phoneNumber: string
): Promise<ProcessedMessage> {
  // Em produção, isso chamaria o LLM real
  // Para este exemplo, implementamos lógica básica

  const lowerMessage = message.toLowerCase();

  // Detectar intenção
  let intent: ProcessedMessage["intent"] = "outro";
  let confidence = 0.5;

  if (
    lowerMessage.includes("pedido") ||
    lowerMessage.includes("quero") ||
    lowerMessage.includes("gostaria") ||
    lowerMessage.includes("botijão") ||
    lowerMessage.includes("gás")
  ) {
    intent = "pedido";
    confidence = 0.85;
  } else if (
    lowerMessage.includes("dúvida") ||
    lowerMessage.includes("como") ||
    lowerMessage.includes("qual") ||
    lowerMessage.includes("quanto")
  ) {
    intent = "duvida";
    confidence = 0.8;
  } else if (
    lowerMessage.includes("reclamação") ||
    lowerMessage.includes("problema") ||
    lowerMessage.includes("erro") ||
    lowerMessage.includes("não funcionou")
  ) {
    intent = "reclamacao";
    confidence = 0.8;
  }

  // Extrair dados
  const extractedData: ExtractedOrderData = {
    clienteName: contactName,
    telefone: phoneNumber,
  };

  // Tentar extrair quantidade
  const quantityMatch = message.match(/(\d+)\s*(botijão|botijões|kg|unidade)/i);
  if (quantityMatch) {
    extractedData.quantidade = parseInt(quantityMatch[1]);
  }

  // Tentar extrair tipo de produto
  if (lowerMessage.includes("13kg") || lowerMessage.includes("13 kg")) {
    extractedData.produto = "Gás 13kg";
  } else if (lowerMessage.includes("45kg") || lowerMessage.includes("45 kg")) {
    extractedData.produto = "Gás 45kg";
  } else if (
    lowerMessage.includes("botijão") ||
    lowerMessage.includes("botijões")
  ) {
    extractedData.produto = "Gás (tipo não especificado)";
  }

  // Tentar extrair endereço
  const enderecoMatch = message.match(
    /(?:rua|avenida|av|r\.|endereço|em|para)[\s:]+([^,.\n]+)/i
  );
  if (enderecoMatch) {
    extractedData.endereco = enderecoMatch[1].trim();
  }

  // Decidir se deve transferir
  let shouldTransfer = false;
  let transferReason = "";

  if (intent === "reclamacao") {
    shouldTransfer = true;
    transferReason = "Reclamação deve ser atendida por especialista";
  } else if (intent === "duvida" && confidence < 0.7) {
    shouldTransfer = true;
    transferReason = "Dúvida complexa requer atendimento humano";
  } else if (intent === "pedido" && !extractedData.produto) {
    shouldTransfer = true;
    transferReason = "Dados incompletos para processar pedido automaticamente";
  }

  // Gerar resposta
  let response = "";

  if (intent === "pedido" && !shouldTransfer) {
    response = `Olá ${contactName}! 👋\n\nRecebi seu pedido:\n`;
    if (extractedData.quantidade) {
      response += `📦 Quantidade: ${extractedData.quantidade}\n`;
    }
    if (extractedData.produto) {
      response += `🛢️ Produto: ${extractedData.produto}\n`;
    }
    if (extractedData.endereco) {
      response += `📍 Endereço: ${extractedData.endereco}\n`;
    }
    response += `\nVou processar seu pedido agora. Você receberá uma confirmação em breve! ✅`;
  } else if (intent === "duvida") {
    response = `Olá ${contactName}! 👋\n\nObrigado pela sua dúvida. Vou conectá-lo com um de nossos especialistas para melhor atendê-lo. Um momento, por favor... 📞`;
  } else if (intent === "reclamacao") {
    response = `Olá ${contactName}! 👋\n\nLamento ouvir sobre o seu problema. Vou conectá-lo imediatamente com um especialista para resolver isso. Obrigado pela paciência! 🙏`;
  } else if (shouldTransfer) {
    response = `Olá ${contactName}! 👋\n\nVou conectá-lo com um de nossos atendentes para melhor ajudá-lo. Um momento, por favor... 📞`;
  } else {
    response = `Olá ${contactName}! 👋\n\nObrigado por entrar em contato conosco! Como posso ajudá-lo? 😊`;
  }

  return {
    intent,
    confidence,
    extractedData,
    shouldTransfer,
    transferReason,
    response,
  };
}

/**
 * Valida dados extraídos de um pedido
 */
export function validateOrderData(data: ExtractedOrderData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.produto) {
    errors.push("Produto não especificado");
  }

  if (!data.quantidade || data.quantidade <= 0) {
    errors.push("Quantidade inválida");
  }

  if (!data.endereco) {
    errors.push("Endereço não especificado");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
