import { describe, it, expect, beforeEach } from "vitest";
import { WhatsAppWebService } from "./whatsappWebService";

describe("WhatsAppWebService", () => {
  let service: WhatsAppWebService;

  beforeEach(() => {
    service = new WhatsAppWebService();
  });

  describe("generateQR", () => {
    it("should generate a valid QR code", async () => {
      const qrCode = await service.generateQR();
      expect(qrCode).toBeDefined();
      expect(typeof qrCode).toBe("string");
      expect(qrCode).toContain("data:image/png");
    });

    it("should generate different QR codes for different sessions", async () => {
      const service1 = new WhatsAppWebService();
      const service2 = new WhatsAppWebService();

      const qr1 = await service1.generateQR();
      const qr2 = await service2.generateQR();

      expect(qr1).not.toBe(qr2);
    });
  });

  describe("isConnected", () => {
    it("should return false initially", async () => {
      const connected = await service.isConnected();
      expect(connected).toBe(false);
    });

    it("should return true after generating QR code and waiting", async () => {
      await service.generateQR();
      // Wait for simulated connection
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const connected = await service.isConnected();
      expect(connected).toBe(true);
    });
  });

  describe("getChats", () => {
    it("should return empty array when not connected", async () => {
      const chats = await service.getChats();
      expect(chats).toEqual([]);
    });

    it("should return chats after connecting", async () => {
      await service.generateQR();
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const chats = await service.getChats();
      expect(Array.isArray(chats)).toBe(true);
      expect(chats.length).toBeGreaterThan(0);
    });

    it("should have correct chat structure", async () => {
      await service.generateQR();
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const chats = await service.getChats();
      if (chats.length > 0) {
        const chat = chats[0];
        expect(chat).toHaveProperty("id");
        expect(chat).toHaveProperty("name");
        expect(chat).toHaveProperty("isGroup");
        expect(chat).toHaveProperty("unreadCount");
      }
    });
  });

  describe("getMessages", () => {
    it("should return empty array when not connected", async () => {
      const messages = await service.getMessages("test_chat_id");
      expect(messages).toEqual([]);
    });

    it("should return messages after connecting", async () => {
      await service.generateQR();
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const chats = await service.getChats();
      if (chats.length > 0) {
        const messages = await service.getMessages(chats[0].id);
        expect(Array.isArray(messages)).toBe(true);
      }
    });

    it("should have correct message structure", async () => {
      await service.generateQR();
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const chats = await service.getChats();
      if (chats.length > 0) {
        const messages = await service.getMessages(chats[0].id);
        if (messages.length > 0) {
          const msg = messages[0];
          expect(msg).toHaveProperty("id");
          expect(msg).toHaveProperty("from");
          expect(msg).toHaveProperty("body");
          expect(msg).toHaveProperty("timestamp");
          expect(msg).toHaveProperty("isFromMe");
        }
      }
    });
  });

  describe("sendMessage", () => {
    it("should throw error when not connected", async () => {
      await expect(
        service.sendMessage("test_chat_id", "Test message")
      ).rejects.toThrow("WhatsApp is not connected");
    });

    it("should send message when connected", async () => {
      await service.generateQR();
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const result = await service.sendMessage("test_chat_id", "Test message");
      expect(result).toBe(true);
    });

    it("should add message to history", async () => {
      await service.generateQR();
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const chatId = "test_chat_id";
      await service.sendMessage(chatId, "Test message");

      const messages = await service.getMessages(chatId);
      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.body).toBe("Test message");
      expect(lastMessage.isFromMe).toBe(true);
    });
  });

  describe("disconnect", () => {
    it("should disconnect successfully", async () => {
      await service.generateQR();
      await new Promise((resolve) => setTimeout(resolve, 2500));

      await service.disconnect();
      const connected = await service.isConnected();
      expect(connected).toBe(false);
    });

    it("should clear chats after disconnect", async () => {
      await service.generateQR();
      await new Promise((resolve) => setTimeout(resolve, 2500));

      let chats = await service.getChats();
      expect(chats.length).toBeGreaterThan(0);

      await service.disconnect();
      chats = await service.getChats();
      expect(chats).toEqual([]);
    });
  });

  describe("getSessionInfo", () => {
    it("should return session info", () => {
      const info = service.getSessionInfo();
      expect(info).toHaveProperty("sessionId");
      expect(info).toHaveProperty("isConnected");
      expect(info).toHaveProperty("chatsCount");
      expect(info).toHaveProperty("messagesCount");
    });

    it("should have unique session IDs", () => {
      const service1 = new WhatsAppWebService();
      const service2 = new WhatsAppWebService();

      const info1 = service1.getSessionInfo();
      const info2 = service2.getSessionInfo();

      expect(info1.sessionId).not.toBe(info2.sessionId);
    });
  });
});
