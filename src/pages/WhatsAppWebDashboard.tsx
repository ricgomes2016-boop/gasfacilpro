import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function WhatsAppWebDashboard() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/whatsapp/credenciais", { replace: true }); }, [navigate]);
  return null;
}
