import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function WhatsAppWebDashboard() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/whatsapp/web/login", { replace: true }); }, [navigate]);
  return null;
}
