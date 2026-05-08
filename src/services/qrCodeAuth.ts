/**
 * Serviço de autenticação via QR Code
 * Similar ao WhatsApp Web
 */

import crypto from "crypto";

export interface QRCodeSession {
  id: string;
  qrCode: string;
  token: string;
  status: "pending" | "authenticated" | "expired";
  deviceName?: string;
  deviceId?: string;
  userId?: number;
  empresaId?: number;
  createdAt: Date;
  expiresAt: Date;
  authenticatedAt?: Date;
}

export interface QRCodePayload {
  sessionId: string;
  token: string;
  userId: number;
  empresaId: number;
  deviceName: string;
  timestamp: number;
}

/**
 * Gera um novo QR Code para autenticação
 */
export function generateQRCode(): QRCodeSession {
  const sessionId = crypto.randomBytes(16).toString("hex");
  const token = crypto.randomBytes(32).toString("hex");
  const qrCode = `gasfacil://auth?session=${sessionId}&token=${token}`;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutos

  return {
    id: sessionId,
    qrCode,
    token,
    status: "pending",
    createdAt: now,
    expiresAt,
  };
}

/**
 * Valida o token do QR Code
 */
export function validateQRCodeToken(
  sessionId: string,
  token: string,
  storedSession: QRCodeSession
): boolean {
  // Verificar se a sessão expirou
  if (new Date() > storedSession.expiresAt) {
    return false;
  }

  // Verificar se os IDs e tokens correspondem
  if (storedSession.id !== sessionId || storedSession.token !== token) {
    return false;
  }

  // Verificar se a sessão ainda está pendente
  if (storedSession.status !== "pending") {
    return false;
  }

  return true;
}

/**
 * Autentica a sessão do QR Code
 */
export function authenticateQRCodeSession(
  session: QRCodeSession,
  userId: number,
  empresaId: number,
  deviceName: string,
  deviceId: string
): QRCodeSession {
  return {
    ...session,
    status: "authenticated",
    userId,
    empresaId,
    deviceName,
    deviceId,
    authenticatedAt: new Date(),
  };
}

/**
 * Cria um payload para ser codificado no QR Code
 */
export function createQRCodePayload(
  sessionId: string,
  token: string,
  userId: number,
  empresaId: number,
  deviceName: string
): QRCodePayload {
  return {
    sessionId,
    token,
    userId,
    empresaId,
    deviceName,
    timestamp: Date.now(),
  };
}

/**
 * Codifica o payload em base64 para o QR Code
 */
export function encodeQRCodePayload(payload: QRCodePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Decodifica o payload do QR Code
 */
export function decodeQRCodePayload(encoded: string): QRCodePayload {
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  return JSON.parse(decoded);
}

/**
 * Gera um token de sessão para o dispositivo autenticado
 */
export function generateSessionToken(
  userId: number,
  empresaId: number,
  deviceId: string
): string {
  const data = `${userId}:${empresaId}:${deviceId}:${Date.now()}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Valida o token de sessão
 */
export function validateSessionToken(
  token: string,
  userId: number,
  empresaId: number,
  deviceId: string,
  maxAge: number = 24 * 60 * 60 * 1000 // 24 horas
): boolean {
  try {
    // Em produção, usar JWT com expiração
    // Este é um exemplo simplificado
    return token.length === 64; // SHA256 hex é sempre 64 caracteres
  } catch {
    return false;
  }
}

/**
 * Gera um código único para o dispositivo
 */
export function generateDeviceId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Cria um QR Code com dados de autenticação
 */
export function createAuthQRCode(sessionId: string, token: string): string {
  // Formato: gasfacil://auth?session=XXX&token=YYY
  // Em produção, usar biblioteca qrcode para gerar imagem
  return `gasfacil://auth?session=${sessionId}&token=${token}`;
}

/**
 * Valida o formato do URL de autenticação
 */
export function validateAuthURL(url: string): {
  valid: boolean;
  sessionId?: string;
  token?: string;
} {
  try {
    const urlObj = new URL(url);

    if (urlObj.protocol !== "gasfacil:") {
      return { valid: false };
    }

    if (urlObj.hostname !== "auth") {
      return { valid: false };
    }

    const sessionId = urlObj.searchParams.get("session");
    const token = urlObj.searchParams.get("token");

    if (!sessionId || !token) {
      return { valid: false };
    }

    return {
      valid: true,
      sessionId,
      token,
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Tipos para WebSocket
 */
export interface QRCodeWebSocketMessage {
  type:
    | "qr_generated"
    | "qr_scanned"
    | "authentication_success"
    | "authentication_failed"
    | "session_expired"
    | "keep_alive";
  sessionId: string;
  payload?: any;
  error?: string;
  timestamp: number;
}

/**
 * Cria mensagem de WebSocket
 */
export function createWebSocketMessage(
  type: QRCodeWebSocketMessage["type"],
  sessionId: string,
  payload?: any,
  error?: string
): QRCodeWebSocketMessage {
  return {
    type,
    sessionId,
    payload,
    error,
    timestamp: Date.now(),
  };
}
