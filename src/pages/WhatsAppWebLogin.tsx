/**
 * Página de Login WhatsApp Web - Visual idêntico ao WhatsApp Web real
 * 
 * Design:
 * - Background verde escuro com padrão doodle
 * - Card central branco com QR Code
 * - Cores e tipografia do WhatsApp
 * - Animações suaves
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, CheckCircle2, X } from "lucide-react";

type ConnectionStatus = "idle" | "loading" | "qr_ready" | "connecting" | "connected" | "error" | "expired";

export default function WhatsAppWebLogin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [qrCode, setQrCode] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>("");
  const [provedor, setProvedor] = useState<string>("");

  // Buscar unidades do usuário
  const { data: unidades } = useQuery({
    queryKey: ["unidades"],
    queryFn: async () => {
      const { data } = await supabase.from("unidades").select("id, nome").order("nome");
      return data || [];
    },
  });

  // Buscar integração ativa
  const { data: integracao, refetch: refetchIntegracao } = useQuery({
    queryKey: ["integracao-whatsapp", selectedUnidadeId],
    queryFn: async () => {
      let query = supabase
        .from("integracoes_whatsapp")
        .select("*")
        .eq("ativo", true);
      if (selectedUnidadeId) {
        query = query.eq("unidade_id", selectedUnidadeId);
      }
      const { data } = await query.limit(1).maybeSingle();
      return data;
    },
    enabled: true,
  });

  // Auto-selecionar unidade
  useEffect(() => {
    if (unidades?.length && !selectedUnidadeId) {
      setSelectedUnidadeId(unidades[0].id);
    }
  }, [unidades, selectedUnidadeId]);

  // Verificar status da integração
  useEffect(() => {
    if (integracao) {
      setProvedor(integracao.provedor || "");
      if (integracao.status_conexao === "conectado") {
        setStatus("connected");
        setPhoneNumber(integracao.numero_telefone || "");
      } else if (integracao.qr_code_base64) {
        const expiresAt = integracao.qr_code_expira_em ? new Date(integracao.qr_code_expira_em) : null;
        if (expiresAt && expiresAt < new Date()) {
          setStatus("expired");
        } else {
          setQrCode(integracao.qr_code_base64);
          setStatus("qr_ready");
        }
      }
    }
  }, [integracao]);

  // Realtime: escutar mudanças na integração
  useEffect(() => {
    if (!integracao?.id) return;
    const channel = supabase
      .channel(`whatsapp-login-${integracao.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "integracoes_whatsapp",
        filter: `id=eq.${integracao.id}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.status_conexao === "conectado") {
          setStatus("connected");
          setPhoneNumber(updated.numero_telefone || "");
          toast.success("WhatsApp conectado com sucesso!");
        } else if (updated.qr_code_base64) {
          setQrCode(updated.qr_code_base64);
          setStatus("qr_ready");
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [integracao?.id]);

  // Gerar QR Code
  const handleGenerateQR = useCallback(async () => {
    try {
      setStatus("loading");
      setErrorMessage("");
      if (!integracao) {
        setErrorMessage("Nenhuma integração WhatsApp configurada.");
        setStatus("error");
        return;
      }
      const currentProvedor = integracao.provedor;
      if (currentProvedor === "evolution") {
        const { data, error } = await supabase.functions.invoke("evolution-proxy", {
          body: { action: "qrcode", instance_id: integracao.instance_id, unidade_id: selectedUnidadeId },
        });
        if (error) throw new Error(error.message);
        if (data?.qrcode?.base64 || data?.base64) {
          const qrBase64 = data.qrcode?.base64 || data.base64;
          setQrCode(qrBase64);
          setStatus("qr_ready");
          await supabase.from("integracoes_whatsapp").update({
            qr_code_base64: qrBase64,
            qr_code_expira_em: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            status_conexao: "aguardando",
          }).eq("id", integracao.id);
        } else if (data?.instance?.state === "open") {
          setStatus("connected");
          setPhoneNumber(data.instance?.phoneNumber || "");
          toast.success("WhatsApp já está conectado!");
        } else {
          throw new Error("Não foi possível gerar QR Code");
        }
      } else if (currentProvedor === "gateway" || integracao.base_url) {
        const { data, error } = await supabase.functions.invoke("whatsapp-gateway-api", {
          body: { action: "qrcode", instance_name: integracao.instance_id },
        });
        if (error) throw new Error(error.message);
        if (data?.qrcode) {
          setQrCode(data.qrcode);
          setStatus("qr_ready");
        } else {
          throw new Error("QR Code não disponível");
        }
      } else {
        setErrorMessage("A API Meta Cloud não usa QR Code. Use o Embedded Signup em Configurações.");
        setStatus("error");
      }
    } catch (err: any) {
      console.error("Erro ao gerar QR:", err);
      setErrorMessage(err.message || "Erro ao gerar QR Code");
      setStatus("error");
    }
  }, [integracao, selectedUnidadeId]);

  // Verificar status
  const handleCheckStatus = useCallback(async () => {
    try {
      if (!integracao) return;
      if (integracao.provedor === "evolution") {
        const { data } = await supabase.functions.invoke("evolution-proxy", {
          body: { action: "status", instance_id: integracao.instance_id, unidade_id: selectedUnidadeId },
        });
        if (data?.instance?.state === "open") {
          setStatus("connected");
          setPhoneNumber(data.instance?.phoneNumber || integracao.numero_telefone || "");
          await supabase.from("integracoes_whatsapp").update({ status_conexao: "conectado" }).eq("id", integracao.id);
          toast.success("WhatsApp conectado!");
        }
      }
    } catch (err) {
      console.error("Erro ao verificar status:", err);
    }
  }, [integracao, selectedUnidadeId]);

  return (
    <MainLayout>
      <Header title="WhatsApp Web" subtitle="Conexao Z-API da unidade selecionada" />
      <div className="h-[calc(100vh-8.5rem)] min-h-[560px] flex flex-col overflow-hidden">
        {/* WhatsApp Green Header Bar */}
        <div className="h-[127px] bg-[#00a884] flex-shrink-0" />

        {/* Main Content - overlapping the green bar */}
        <div className="flex-1 bg-[#d1d7db] -mt-[80px] flex items-start justify-center px-4 pt-0 pb-8">
          <div className="w-full max-w-[1000px] bg-white rounded-sm shadow-lg flex overflow-hidden" style={{ minHeight: '500px' }}>
            
            {/* Left Panel - Info */}
            <div className="hidden md:flex flex-col items-center justify-center flex-1 border-r border-[#e9edef] p-8 bg-[#f0f2f5]">
              {/* WhatsApp Logo */}
              <div className="mb-6">
                <svg viewBox="0 0 212 212" width="200" height="200" className="opacity-20">
                  <path fill="#DFE5E7" d="M106.251.5C164.653.5 212 47.846 212 106.25S164.653 212 106.25 212C47.846 212 .5 164.654.5 106.25S47.846.5 106.251.5z" />
                  <path fill="#FFF" d="M173.561 171.615a62.767 62.767 0 0 0-2.065-2.955 67.7 67.7 0 0 0-2.608-3.299 70.112 70.112 0 0 0-3.184-3.527 71.097 71.097 0 0 0-5.924-5.47 72.458 72.458 0 0 0-10.204-7.026 75.2 75.2 0 0 0-5.98-3.055c-.062-.028-.118-.059-.18-.087-9.792-4.44-22.106-7.529-37.416-7.529s-27.624 3.089-37.416 7.529c-.338.153-.653.318-.985.474a75.37 75.37 0 0 0-6.229 3.298 72.589 72.589 0 0 0-9.15 6.395 71.243 71.243 0 0 0-5.924 5.47 70.064 70.064 0 0 0-3.184 3.527 67.142 67.142 0 0 0-2.609 3.299 63.292 63.292 0 0 0-2.065 2.955 56.33 56.33 0 0 0-1.447 2.324c-.033.056-.073.119-.104.174a47.92 47.92 0 0 0-1.07 1.926c-.559 1.068-.818 1.678-.818 1.678v.398c18.285 17.927 43.322 28.985 70.945 28.985 27.678 0 52.761-11.103 71.055-29.095v-.289s-.619-1.45-1.992-3.778a58.346 58.346 0 0 0-1.446-2.322zM106.002 125.5c2.645 0 5.212-.253 7.68-.737a38.272 38.272 0 0 0 3.624-.896 37.124 37.124 0 0 0 5.12-1.958 36.307 36.307 0 0 0 6.15-3.67 35.923 35.923 0 0 0 9.489-10.48 36.558 36.558 0 0 0 2.422-4.84 37.051 37.051 0 0 0 1.716-5.25c.299-1.208.542-2.443.725-3.701.275-1.887.417-3.827.417-5.811s-.142-3.925-.417-5.811a38.734 38.734 0 0 0-1.215-5.494 36.68 36.68 0 0 0-3.648-8.298 35.923 35.923 0 0 0-9.489-10.48 36.347 36.347 0 0 0-6.15-3.67 37.124 37.124 0 0 0-5.12-1.958 37.67 37.67 0 0 0-3.624-.896 39.875 39.875 0 0 0-7.68-.737c-21.162 0-37.345 16.183-37.345 37.345 0 21.159 16.183 37.342 37.345 37.342z" />
                </svg>
              </div>
              <h1 className="text-[#41525d] text-3xl font-light mb-3 text-center">
                WhatsApp Web
              </h1>
              <p className="text-[#667781] text-sm text-center max-w-sm leading-relaxed">
                Envie e receba mensagens sem precisar manter seu celular conectado à internet.
              </p>
              <p className="text-[#667781] text-xs text-center mt-4 opacity-70">
                Use o WhatsApp em até 4 aparelhos conectados ao mesmo tempo
              </p>
            </div>

            {/* Right Panel - QR Code / Status */}
            <div className="flex flex-col items-center justify-center flex-1 p-8">
              
              {/* Seletor de Unidade */}
              {unidades && unidades.length > 1 && (
                <div className="w-full max-w-xs mb-6">
                  <label className="text-xs text-[#667781] mb-1 block">Unidade</label>
                  <select
                    className="w-full border border-[#e9edef] rounded px-3 py-2 text-sm text-[#3b4a54] focus:border-[#00a884] focus:outline-none transition-colors"
                    value={selectedUnidadeId}
                    onChange={(e) => setSelectedUnidadeId(e.target.value)}
                  >
                    {unidades.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* IDLE - Mostrar botão para gerar QR */}
              {(status === "idle" || status === "expired") && (
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-[264px] h-[264px] border-2 border-dashed border-[#e9edef] rounded-lg flex flex-col items-center justify-center">
                    <svg viewBox="0 0 24 24" width="64" height="64" className="text-[#00a884] opacity-40 mb-3">
                      <path fill="currentColor" d="M3 11h2V9H3v2zm0 4h2v-2H3v2zm0-8h2V5H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zm0-10v2h14V5H7z"/>
                    </svg>
                    <p className="text-[#667781] text-sm">
                      {status === "expired" ? "QR Code expirado" : "Clique para gerar o QR Code"}
                    </p>
                  </div>
                  
                  <button
                    onClick={handleGenerateQR}
                    disabled={!integracao}
                    className="bg-[#00a884] hover:bg-[#008f72] disabled:bg-[#e9edef] disabled:text-[#8696a0] text-white px-6 py-3 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {status === "expired" ? "Gerar Novo QR Code" : "Gerar QR Code"}
                  </button>

                  {!integracao && (
                    <div className="text-center">
                      <p className="text-[#667781] text-xs mb-2">
                        Nenhuma integração WhatsApp configurada.
                      </p>
                      <button
                        onClick={() => navigate("/config/integracoes?open=whatsapp")}
                        className="text-[#00a884] text-sm hover:underline"
                      >
                        Configurar WhatsApp →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* LOADING */}
              {status === "loading" && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-[264px] h-[264px] flex items-center justify-center">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-[#e9edef] border-t-[#00a884] rounded-full animate-spin" />
                    </div>
                  </div>
                  <p className="text-[#667781] text-sm">Gerando QR Code...</p>
                </div>
              )}

              {/* QR READY */}
              {status === "qr_ready" && qrCode && (
                <div className="flex flex-col items-center space-y-5">
                  <div className="relative">
                    {/* QR Code com borda verde */}
                    <div className="p-3 border-[3px] border-[#00a884] rounded-lg bg-white">
                      <img
                        src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                        alt="QR Code WhatsApp"
                        className="w-[240px] h-[240px] object-contain"
                      />
                    </div>
                    {/* WhatsApp icon overlay */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-1 rounded">
                      <svg viewBox="0 0 32 32" width="32" height="32">
                        <path fill="#25D366" d="M16 0C7.163 0 0 7.163 0 16c0 2.837.736 5.502 2.034 7.818L.105 31.517a.5.5 0 0 0 .613.613l7.699-1.929A15.93 15.93 0 0 0 16 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm8.2 22.8c-.344.968-1.7 1.772-2.775 2.007-.738.157-1.7.282-4.942-1.062-4.15-1.72-6.82-5.94-7.026-6.214-.198-.268-1.668-2.22-1.668-4.234 0-2.015 1.055-3.005 1.43-3.415.344-.376.752-.47 1.003-.47.25 0 .502.003.72.013.232.01.543-.088.85.648.344.824 1.168 2.85 1.27 3.055.103.206.172.447.034.715-.137.268-.206.435-.41.67-.205.236-.43.527-.614.707-.206.198-.42.413-.18.81.24.397 1.068 1.76 2.293 2.853 1.575 1.405 2.903 1.84 3.315 2.047.41.206.65.172.89-.103.24-.275 1.03-1.2 1.305-1.613.275-.41.55-.344.924-.206.376.137 2.38 1.123 2.79 1.328.41.206.682.31.783.48.103.172.103.993-.24 1.96z"/>
                      </svg>
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <h3 className="text-[#3b4a54] text-base font-normal">
                      Para usar o WhatsApp no computador:
                    </h3>
                    <ol className="text-[#667781] text-sm space-y-1.5 text-left">
                      <li className="flex items-start gap-2">
                        <span className="text-[#00a884] font-medium">1.</span>
                        Abra o WhatsApp no celular
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#00a884] font-medium">2.</span>
                        Toque em <strong>Menu ⋮</strong> → <strong>Aparelhos conectados</strong>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#00a884] font-medium">3.</span>
                        Aponte o celular para esta tela para escanear o código
                      </li>
                    </ol>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateQR}
                      className="text-[#00a884] hover:bg-[#00a884]/5 px-4 py-2 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 border border-[#00a884]/30"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Novo QR
                    </button>
                    <button
                      onClick={handleCheckStatus}
                      className="text-[#667781] hover:bg-[#f0f2f5] px-4 py-2 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 border border-[#e9edef]"
                    >
                      Verificar conexão
                    </button>
                  </div>
                </div>
              )}

              {/* CONNECTED */}
              {status === "connected" && (
                <div className="flex flex-col items-center space-y-5 text-center">
                  <div className="w-20 h-20 rounded-full bg-[#00a884] flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-[#3b4a54] text-xl font-normal mb-1">
                      WhatsApp Conectado
                    </h3>
                    {phoneNumber && (
                      <p className="text-[#667781] text-sm">{phoneNumber}</p>
                    )}
                    {provedor && (
                      <span className="inline-block mt-2 px-2 py-0.5 bg-[#e7f8f0] text-[#00a884] text-xs rounded-full">
                        via {provedor}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => navigate("/whatsapp/conversas")}
                    className="bg-[#00a884] hover:bg-[#008f72] text-white px-8 py-3 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M19.005 3.175H4.674C3.642 3.175 3 3.789 3 4.821V21.02l3.544-3.514h12.461c1.033 0 2.064-1.06 2.064-2.093V4.821c-.001-1.032-1.032-1.646-2.064-1.646zm-4.989 9.869H7.041V11.1h6.975v1.944zm3-4H7.041V7.1h9.975v1.944z"/>
                    </svg>
                    Abrir Conversas
                  </button>
                </div>
              )}

              {/* ERROR */}
              {status === "error" && (
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#ea4335]/10 flex items-center justify-center">
                    <X className="h-8 w-8 text-[#ea4335]" />
                  </div>
                  <div>
                    <h3 className="text-[#3b4a54] text-base font-normal mb-1">
                      Erro na conexão
                    </h3>
                    <p className="text-[#667781] text-sm max-w-xs">{errorMessage}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateQR}
                      className="bg-[#00a884] hover:bg-[#008f72] text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
                    >
                      Tentar novamente
                    </button>
                    <button
                      onClick={() => navigate("/config/integracoes?open=whatsapp")}
                      className="text-[#00a884] hover:bg-[#00a884]/5 px-5 py-2.5 rounded-full text-sm font-medium transition-colors border border-[#00a884]/30"
                    >
                      Configurar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
