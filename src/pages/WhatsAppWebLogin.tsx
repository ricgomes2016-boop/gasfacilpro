import { Navigate } from "react-router-dom";

// Página mock antiga removida. Para conectar o WhatsApp use /integracoes (QR Evolution real).
export default function WhatsAppWebLogin() {
  return <Navigate to="/integracoes" replace />;
}
