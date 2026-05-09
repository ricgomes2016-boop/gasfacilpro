import { Navigate } from "react-router-dom";

// Página mock antiga removida. A caixa de entrada real do WhatsApp está em /chat.
export default function WhatsAppWebDashboard() {
  return <Navigate to="/chat" replace />;
}
