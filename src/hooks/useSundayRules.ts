/**
 * Hook centralizado com regras de negócio de domingo da Central Gás:
 * - Fechamento máximo às 14:00
 * - Sem entrega de água (apenas retirada presencial na portaria até 14h)
 */

import { useMemo } from "react";

const SUNDAY_MAX_CLOSING = "14:00";

interface SundayRulesResult {
  isSunday: boolean;
  /** Horário efetivo de fechamento (respeitando regra de domingo) */
  effectiveClosing: string;
  /** Horário de abertura (sem alteração) */
  effectiveOpening: string;
  /** Loja está aberta agora? */
  isOpen: boolean;
  /** Entrega de água permitida? */
  waterDeliveryAllowed: boolean;
  /** Mensagem explicativa sobre restrições de domingo */
  sundayMessage: string | null;
  /** Mensagem sobre água */
  waterMessage: string | null;
}

export function useSundayRules(
  horarioAbertura?: string | null,
  horarioFechamento?: string | null,
): SundayRulesResult {
  return useMemo(() => {
    const now = new Date();
    const brt = new Date(now.getTime() + (-3 * 60 + now.getTimezoneOffset()) * 60000);
    const isSunday = brt.getDay() === 0;
    const currentTime = `${String(brt.getHours()).padStart(2, "0")}:${String(brt.getMinutes()).padStart(2, "0")}`;

    const opening = horarioAbertura || "07:00";
    let closing = horarioFechamento || "18:00";

    if (isSunday) {
      // Domingo: max 14:00, a menos que o cadastrado seja anterior
      closing = closing > SUNDAY_MAX_CLOSING ? SUNDAY_MAX_CLOSING : closing;
    }

    const isOpen = currentTime >= opening && currentTime < closing;
    const waterDeliveryAllowed = !isSunday;

    return {
      isSunday,
      effectiveClosing: closing,
      effectiveOpening: opening,
      isOpen,
      waterDeliveryAllowed,
      sundayMessage: isSunday
        ? `Domingo: funcionamento até ${closing}. Apenas retirada presencial na portaria.`
        : null,
      waterMessage: isSunday
        ? `Aos domingos não há entrega de água. Retirada presencial na portaria até ${closing}.`
        : null,
    };
  }, [horarioAbertura, horarioFechamento]);
}

/** Pure utility for edge functions / non-React contexts */
export function getSundayRules(horarioAbertura: string, horarioFechamento: string) {
  const now = new Date();
  const brt = new Date(now.getTime() + (-3 * 60 + now.getTimezoneOffset()) * 60000);
  const isSunday = brt.getDay() === 0;
  let closing = horarioFechamento;

  if (isSunday) {
    closing = closing > SUNDAY_MAX_CLOSING ? SUNDAY_MAX_CLOSING : closing;
  }

  return { isSunday, effectiveClosing: closing, waterDeliveryAllowed: !isSunday };
}
