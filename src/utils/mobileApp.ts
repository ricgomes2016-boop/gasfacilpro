// UTILIDADES PARA APP DO ENTREGADOR

export const isMobileApp = () => {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad/i.test(navigator.userAgent);
};

export const abrirRota = (lat: number, lng: number) => {
  const url = `geo:${lat},${lng}`;
  window.open(url, "_system");
};

export const vibrar = (tempo = 200) => {
  if (navigator.vibrate) {
    navigator.vibrate(tempo);
  }
};

// Ajuste automático de UI para entregador
export const aplicarModoEntregador = () => {
  if (!isMobileApp()) return;

  document.body.classList.add("modo-entregador");
};
