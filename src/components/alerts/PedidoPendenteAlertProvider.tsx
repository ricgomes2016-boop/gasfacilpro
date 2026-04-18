import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePedidosPendentesAlert } from "@/hooks/usePedidosPendentesAlert";
import { useDeliveryAlarm } from "@/hooks/useDeliveryAlarm";
import { useNotifications } from "@/hooks/useNotifications";
import { PedidoPendenteModal } from "./PedidoPendenteModal";

const SOM_KEY = "erp_alerta_som_ativo";

export function PedidoPendenteAlertProvider() {
  const { pendentes, snoozePedido } = usePedidosPendentesAlert();
  const { startAlarm, stopAlarm } = useDeliveryAlarm();
  const { sendNotification } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [somAtivo, setSomAtivo] = useState<boolean>(() => {
    return localStorage.getItem(SOM_KEY) !== "false";
  });
  const ultimoBipeRef = useRef<number>(0);
  const notificadosRef = useRef<Set<string>>(new Set());
  const urgenteAtivoRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(SOM_KEY, String(somAtivo));
    if (!somAtivo) stopAlarm();
  }, [somAtivo, stopAlarm]);

  // Notificação push para pedidos novos
  useEffect(() => {
    pendentes.forEach((p) => {
      if (!notificadosRef.current.has(p.id)) {
        notificadosRef.current.add(p.id);
        if (document.hidden) {
          sendNotification({
            title: "🛵 Novo Pedido Pendente",
            body: `${p.cliente_nome} · R$ ${p.valor_total.toFixed(2)}`,
            tag: `pedido-${p.id}`,
          });
        }
      }
    });
  }, [pendentes, sendNotification]);

  // Lógica de bipe escalonado
  useEffect(() => {
    if (!somAtivo || pendentes.length === 0) {
      stopAlarm();
      urgenteAtivoRef.current = false;
      return;
    }

    const agora = Date.now();
    const maisAntigo = pendentes[0];
    const minutos = (agora - new Date(maisAntigo.created_at).getTime()) / 60000;

    // 10+ min → alarme contínuo urgente
    if (minutos >= 10) {
      if (!urgenteAtivoRef.current) {
        stopAlarm();
        startAlarm(true);
        urgenteAtivoRef.current = true;
      }
      return;
    }

    // Bipes pontuais (não contínuos)
    const intervaloBipe = minutos >= 5 ? 15000 : 30000;
    if (agora - ultimoBipeRef.current > intervaloBipe) {
      stopAlarm();
      urgenteAtivoRef.current = false;
      startAlarm(false);
      // Para o bipe após ~1 segundo (toca só uma vez)
      setTimeout(() => stopAlarm(), 800);
      ultimoBipeRef.current = agora;
    }

    const timer = setInterval(() => {
      // força reavaliação
      setSomAtivo((s) => s);
    }, 5000);
    return () => clearInterval(timer);
  }, [pendentes, somAtivo, startAlarm, stopAlarm]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => stopAlarm();
  }, [stopAlarm]);

  const handleAceitar = (id: string) => {
    snoozePedido(id, 60); // remove dos pendentes por 1h (até atendente mudar status)
    stopAlarm();
    if (!location.pathname.startsWith("/vendas/pedidos")) {
      navigate("/vendas/pedidos");
    }
  };

  // Não mostra modal nas páginas de pedidos (já está lá vendo)
  const ocultarModal = location.pathname.startsWith("/vendas/pedidos");
  const pedido = pendentes[0];

  if (!pedido || ocultarModal) return null;

  return (
    <PedidoPendenteModal
      pedido={pedido}
      totalPendentes={pendentes.length}
      somAtivo={somAtivo}
      onToggleSom={() => setSomAtivo((v) => !v)}
      onAceitar={() => handleAceitar(pedido.id)}
      onSnooze={() => snoozePedido(pedido.id, 1)}
    />
  );
}
