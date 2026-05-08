/**
 * Configuração do Sentry para monitoramento de erros em produção
 * 
 * Para ativar:
 * 1. Instalar: npm install @sentry/react @sentry/tracing
 * 2. Adicionar VITE_SENTRY_DSN ao .env
 * 3. Importar e inicializar em main.tsx
 */

import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    console.warn("Sentry DSN não configurado. Monitoramento desativado.");
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      new BrowserTracing({
        // Rastrear performance de navegação
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          window.history
        ),
      }),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Capturar 100% das transações em desenvolvimento, 10% em produção
    tracesSampleRate: import.meta.env.MODE === "development" ? 1.0 : 0.1,
    // Capturar 100% das sessões de replay em desenvolvimento, 10% em produção
    replaysSessionSampleRate: import.meta.env.MODE === "development" ? 1.0 : 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

/**
 * Capturar exceção com contexto adicional
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
) {
  Sentry.captureException(error, {
    contexts: {
      app: context,
    },
  });
}

/**
 * Capturar mensagem de log
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info"
) {
  Sentry.captureMessage(message, level);
}

/**
 * Definir usuário para rastreamento
 */
export function setUser(userId: string, email?: string, username?: string) {
  Sentry.setUser({
    id: userId,
    email,
    username,
  });
}

/**
 * Limpar usuário
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * Adicionar breadcrumb para rastreamento de eventos
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = "info"
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    timestamp: Date.now() / 1000,
  });
}
