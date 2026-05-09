import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

// Schema de validação
const WhatsAppSessionSchema = z.object({
  qrCode: z.string().optional(),
  status: z.enum(["disconnected", "connecting", "connected"]),
  phoneNumber: z.string().optional(),
  timestamp: z.date(),
});

const WhatsAppMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  body: z.string(),
  timestamp: z.date(),
  isFromMe: z.boolean(),
  hasMedia: z.boolean().optional(),
});

const WhatsAppContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  number: z.string(),
  isGroup: z.boolean().default(false),
  lastMessage: z.string().optional(),
  lastMessageTime: z.date().optional(),
});

export const whatsappRouter = router({
  // Gerar QR Code para conectar
  generateQRCode: protectedProcedure
    .input(z.object({ empresaId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verificar se empresa existe e pertence ao usuário
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário não autenticado",
          });
        }

        // Aqui você integraria com o serviço de WhatsApp Web
        // Por enquanto, retornamos um QR code mock
        const qrCode = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;

        return {
          success: true,
          qrCode,
          sessionId: `session_${input.empresaId}_${Date.now()}`,
          expiresIn: 300, // 5 minutos
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao gerar QR Code",
        });
      }
    }),

  // Verificar status da conexão
  getStatus: protectedProcedure
    .input(z.object({ empresaId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário não autenticado",
          });
        }

        // Aqui você consultaria o banco de dados
        // Por enquanto, retornamos status mock
        return {
          status: "disconnected",
          phoneNumber: null,
          lastConnected: null,
          empresaId: input.empresaId,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao obter status",
        });
      }
    }),

  // Listar conversas
  listConversations: protectedProcedure
    .input(z.object({ empresaId: z.string(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário não autenticado",
          });
        }

        // Aqui você consultaria o banco de dados
        // Por enquanto, retornamos conversas mock
        const mockConversations = [
          {
            id: "1",
            name: "João Silva",
            number: "5511987654321",
            lastMessage: "Olá, tudo bem?",
            lastMessageTime: new Date(),
            unreadCount: 2,
          },
          {
            id: "2",
            name: "Maria Santos",
            number: "5511912345678",
            lastMessage: "Obrigada pela resposta!",
            lastMessageTime: new Date(Date.now() - 3600000),
            unreadCount: 0,
          },
        ];

        return {
          conversations: mockConversations,
          total: mockConversations.length,
          empresaId: input.empresaId,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao listar conversas",
        });
      }
    }),

  // Obter mensagens de uma conversa
  getMessages: protectedProcedure
    .input(
      z.object({
        empresaId: z.string(),
        contactId: z.string(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário não autenticado",
          });
        }

        // Aqui você consultaria o banco de dados
        // Por enquanto, retornamos mensagens mock
        const mockMessages = [
          {
            id: "msg1",
            from: "5511987654321",
            to: "5511999999999",
            body: "Olá, tudo bem?",
            timestamp: new Date(Date.now() - 7200000),
            isFromMe: false,
          },
          {
            id: "msg2",
            from: "5511999999999",
            to: "5511987654321",
            body: "Tudo certo! E você?",
            timestamp: new Date(Date.now() - 3600000),
            isFromMe: true,
          },
        ];

        return {
          messages: mockMessages,
          contactId: input.contactId,
          empresaId: input.empresaId,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao obter mensagens",
        });
      }
    }),

  // Enviar mensagem
  sendMessage: protectedProcedure
    .input(
      z.object({
        empresaId: z.string(),
        contactId: z.string(),
        message: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário não autenticado",
          });
        }

        // Aqui você enviaria a mensagem via WhatsApp Web
        // Por enquanto, retornamos sucesso mock
        return {
          success: true,
          messageId: `msg_${Date.now()}`,
          timestamp: new Date(),
          status: "sent",
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao enviar mensagem",
        });
      }
    }),

  // Desconectar WhatsApp
  disconnect: protectedProcedure
    .input(z.object({ empresaId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário não autenticado",
          });
        }

        // Aqui você desconectaria a sessão
        return {
          success: true,
          message: "WhatsApp desconectado com sucesso",
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao desconectar",
        });
      }
    }),
});
