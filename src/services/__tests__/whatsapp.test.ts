import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  processMessageWithBIA,
  validateOrderData,
} from "../whatsappBIAProcessor";
import { validateWebhookSignature } from "../whatsappWebhook";

describe("WhatsApp BIA Processor", () => {
  describe("processMessageWithBIA", () => {
    it("deve detectar intenção de pedido", async () => {
      const result = await processMessageWithBIA(
        "Quero fazer um pedido de 2 botijões de gás 13kg",
        "João Silva",
        "5511987654321"
      );

      expect(result.intent).toBe("pedido");
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.extractedData.produto).toBe("Gás 13kg");
      expect(result.extractedData.quantidade).toBe(2);
    });

    it("deve detectar intenção de dúvida", async () => {
      const result = await processMessageWithBIA(
        "Qual é o preço do gás 45kg?",
        "Maria Santos",
        "5511912345678"
      );

      expect(result.intent).toBe("duvida");
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.shouldTransfer).toBe(true);
    });

    it("deve detectar intenção de reclamação", async () => {
      const result = await processMessageWithBIA(
        "Recebi um botijão com problema",
        "Pedro Oliveira",
        "5511998765432"
      );

      expect(result.intent).toBe("reclamacao");
      expect(result.shouldTransfer).toBe(true);
      expect(result.transferReason).toContain("especialista");
    });

    it("deve extrair quantidade corretamente", async () => {
      const result = await processMessageWithBIA(
        "Preciso de 5 botijões",
        "Cliente",
        "5511987654321"
      );

      expect(result.extractedData.quantidade).toBe(5);
    });

    it("deve extrair endereço quando disponível", async () => {
      const result = await processMessageWithBIA(
        "Quero entregar na Rua das Flores, 123",
        "Cliente",
        "5511987654321"
      );

      expect(result.extractedData.endereco).toContain("Rua das Flores");
    });

    it("deve gerar resposta apropriada para pedido", async () => {
      const result = await processMessageWithBIA(
        "Quero 1 botijão de gás 13kg",
        "João",
        "5511987654321"
      );

      expect(result.response).toContain("João");
      expect(result.response).toContain("pedido");
    });

    it("deve recomendar transferência para dados incompletos", async () => {
      const result = await processMessageWithBIA(
        "Quero gás",
        "Cliente",
        "5511987654321"
      );

      expect(result.shouldTransfer).toBe(true);
    });
  });

  describe("validateOrderData", () => {
    it("deve validar dados completos", () => {
      const data = {
        produto: "Gás 13kg",
        quantidade: 2,
        endereco: "Rua das Flores, 123",
        clienteName: "João",
        telefone: "5511987654321",
      };

      const result = validateOrderData(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("deve rejeitar dados sem produto", () => {
      const data = {
        quantidade: 2,
        endereco: "Rua das Flores, 123",
      };

      const result = validateOrderData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Produto não especificado");
    });

    it("deve rejeitar quantidade inválida", () => {
      const data = {
        produto: "Gás 13kg",
        quantidade: 0,
        endereco: "Rua das Flores, 123",
      };

      const result = validateOrderData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Quantidade inválida");
    });

    it("deve rejeitar dados sem endereço", () => {
      const data = {
        produto: "Gás 13kg",
        quantidade: 2,
      };

      const result = validateOrderData(data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Endereço não especificado");
    });
  });
});

describe("WhatsApp Webhook", () => {
  describe("validateWebhookSignature", () => {
    it("deve validar assinatura correta", () => {
      const payload = '{"test":"data"}';
      const appSecret = "test-secret";

      // Gerar assinatura válida
      const crypto = require("crypto");
      const signature = `sha256=${crypto
        .createHmac("sha256", appSecret)
        .update(payload)
        .digest("hex")}`;

      const isValid = validateWebhookSignature(payload, signature, appSecret);

      expect(isValid).toBe(true);
    });

    it("deve rejeitar assinatura inválida", () => {
      const payload = '{"test":"data"}';
      const appSecret = "test-secret";
      const invalidSignature = "sha256=invalid";

      const isValid = validateWebhookSignature(
        payload,
        invalidSignature,
        appSecret
      );

      expect(isValid).toBe(false);
    });

    it("deve rejeitar assinatura com secret errado", () => {
      const payload = '{"test":"data"}';
      const appSecret = "test-secret";
      const wrongSecret = "wrong-secret";

      // Gerar assinatura com secret errado
      const crypto = require("crypto");
      const signature = `sha256=${crypto
        .createHmac("sha256", wrongSecret)
        .update(payload)
        .digest("hex")}`;

      const isValid = validateWebhookSignature(payload, signature, appSecret);

      expect(isValid).toBe(false);
    });
  });
});
