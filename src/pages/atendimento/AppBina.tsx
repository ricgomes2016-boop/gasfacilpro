import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Smartphone,
  PhoneCall,
  MessageSquare,
  Wifi,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  ExternalLink,
  Shield,
  Zap,
  Settings,
  QrCode,
  Terminal,
  Info,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const WEBHOOK_URL = `https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/bina-webhook`;

const steps = [
  {
    step: 1,
    title: "Exporte o projeto para o GitHub",
    desc: "No Lovable, vá em Settings → GitHub e exporte o projeto.",
    icon: ExternalLink,
  },
  {
    step: 2,
    title: "Clone o repositório no PC",
    desc: "git clone https://github.com/seu-usuario/seu-repo.git",
    code: "git clone <url-do-repositorio> && cd <nome-do-projeto>",
    icon: Terminal,
  },
  {
    step: 3,
    title: "Instale as dependências",
    desc: "npm install",
    code: "npm install",
    icon: Download,
  },
  {
    step: 4,
    title: "Adicione o Capacitor e plugins nativos",
    desc: "Instale o Capacitor e os plugins para detectar chamadas e notificações.",
    code: `npm install @capacitor/core @capacitor/android @capacitor/cli
npx cap init GasFacilBina app.lovable.f3c8aebde1dc48dab0b570789fbeca59
npx cap add android`,
    icon: Zap,
  },
  {
    step: 5,
    title: "Configure o arquivo capacitor.config.ts",
    desc: "Adicione a URL do app e a configuração do servidor.",
    code: `// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f3c8aebde1dc48dab0b570789fbeca59',
  appName: 'GasFacil Bina',
  webDir: 'dist',
  server: {
    url: 'https://f3c8aebd-e1dc-48da-b0b5-70789fbeca59.lovableproject.com',
    cleartext: true,
  },
};
export default config;`,
    icon: Settings,
  },
  {
    step: 6,
    title: "Adicione as permissões no AndroidManifest.xml",
    desc: "Abra android/app/src/main/AndroidManifest.xml e adicione antes de <application>:",
    code: `<uses-permission android:name="android.permission.READ_PHONE_STATE"/>
<uses-permission android:name="android.permission.READ_CALL_LOG"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"/>`,
    icon: Shield,
  },
  {
    step: 7,
    title: "Crie o serviço nativo de detecção de chamadas",
    desc: "Crie o arquivo android/app/src/main/java/app/lovable/.../CallReceiver.kt:",
    code: `// CallReceiver.kt
package app.lovable.f3c8aebde1dc48dab0b570789fbeca59

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class CallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
            val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
            val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)

            if (state == TelephonyManager.EXTRA_STATE_RINGING && !number.isNullOrEmpty()) {
                sendToWebhook(number, "celular")
            }
        }
    }

    private fun sendToWebhook(phone: String, type: String) {
        val client = OkHttpClient()
        val json = JSONObject()
        json.put("telefone", phone)
        json.put("tipo", type)

        val body = json.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("${WEBHOOK_URL}")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}
            override fun onResponse(call: Call, response: Response) { response.close() }
        })
    }
}`,
    icon: Terminal,
  },
  {
    step: 8,
    title: "Build e sincronize com o Android",
    desc: "Compile o projeto e abra no Android Studio.",
    code: `npm run build
npx cap sync android
npx cap open android`,
    icon: Smartphone,
  },
  {
    step: 9,
    title: "Instale no celular e conceda permissões",
    desc: "No Android Studio, clique em ▶ Run. No celular: conceda permissão de Telefone e, para WhatsApp, ative o app como Serviço de Notificação (Configurações → Notificações → Acesso a notificações).",
    icon: CheckCircle2,
  },
];

export default function AppBina() {
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const testWebhook = async (tipo: string) => {
    if (!testPhone.trim()) {
      toast.error("Digite um número de telefone para testar");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("bina-webhook", {
        body: { telefone: testPhone, tipo },
      });
      if (error) throw error;
      toast.success(`Chamada de ${tipo} simulada! Verifique a Central de Atendimento.`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao testar webhook");
    } finally {
      setTesting(false);
    }
  };

  return (
    <MainLayout>
      <Header
        title="App Bina (Caller ID)"
        subtitle="Identifique chamadas de celular, VoIP e WhatsApp em tempo real"
      />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <PhoneCall className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Celular (linha comum)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    App Android detecta chamadas recebidas via READ_PHONE_STATE e envia ao sistema automaticamente.
                  </p>
                  <Badge variant="secondary" className="mt-2 text-xs">Requer app instalado</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">WhatsApp</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mensagens: identificação automática via Z-API (já ativo). Chamadas de voz: capturadas via listener de notificação no app Android.
                  </p>
                  <Badge variant="secondary" className="mt-2 text-xs bg-green-100 text-green-700">Z-API ativo ✓</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Wifi className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">VoIP (GoTo Connect)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Webhook já configurado no sistema. Configure no GoTo Connect o endpoint abaixo para ativar a identificação automática de ramais.
                  </p>
                  <Badge variant="secondary" className="mt-2 text-xs bg-blue-100 text-blue-700">Webhook pronto ✓</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="android">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="android" className="gap-2">
              <Smartphone className="h-4 w-4" /> App Android
            </TabsTrigger>
            <TabsTrigger value="voip" className="gap-2">
              <Wifi className="h-4 w-4" /> GoTo Connect
            </TabsTrigger>
            <TabsTrigger value="test" className="gap-2">
              <Zap className="h-4 w-4" /> Testar
            </TabsTrigger>
          </TabsList>

          {/* ANDROID TAB */}
          <TabsContent value="android" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Guia de Instalação — App Android (Bina)
                </CardTitle>
                <CardDescription>
                  Siga os passos abaixo para instalar o app no celular Android dedicado do balcão.
                  Você precisará de: Node.js, Android Studio e um computador Windows/Mac/Linux.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {steps.map((s, idx) => (
                  <div key={s.step}>
                    {idx > 0 && <Separator className="my-4" />}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                        {s.step}
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="font-medium text-sm">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                        {s.code && (
                          <div className="relative bg-muted rounded-md p-3 font-mono text-xs overflow-x-auto">
                            <pre className="whitespace-pre-wrap break-all">{s.code}</pre>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="absolute top-2 right-2 h-6 w-6"
                              onClick={() => copyToClipboard(s.code!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Sobre chamadas WhatsApp</p>
                    <p className="text-xs text-muted-foreground">
                      O WhatsApp não oferece API pública para chamadas de voz. O app Android detecta chamadas 
                      lendo a notificação do sistema operacional via <strong>NotificationListenerService</strong>. 
                      Para isso, o usuário deve ir em: <strong>Configurações → Apps → Acesso especial → Acesso a notificações</strong> 
                      e ativar o app Bina.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VOIP TAB */}
          <TabsContent value="voip" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Configuração GoTo Connect
                </CardTitle>
                <CardDescription>
                  O webhook já está configurado e funcionando. Você só precisa apontar o GoTo Connect para ele.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">URL do Webhook (Bina)</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-muted rounded-md px-3 py-2 font-mono text-xs break-all">
                      {WEBHOOK_URL}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(WEBHOOK_URL)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <p className="text-sm font-medium">Passos no GoTo Connect</p>
                  {[
                    { n: 1, t: "Acesse admin.goto.com e faça login" },
                    { n: 2, t: "Vá em Integrations → Webhooks" },
                    { n: 3, t: "Clique em + New Webhook" },
                    { n: 4, t: "Cole a URL acima no campo Endpoint URL" },
                    { n: 5, t: "Selecione os eventos: Call Started, Incoming Call" },
                    { n: 6, t: "Salve e ative o webhook" },
                  ].map((item) => (
                    <div key={item.n} className="flex items-center gap-3 text-sm">
                      <ChevronRight className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{item.t}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Payload esperado do GoTo Connect</p>
                  <div className="bg-muted rounded-md p-3 font-mono text-xs">
                    <pre>{`{
  "callerNumber": "+5511999999999",
  "event": "IncomingCall",
  "channel": "phone"
}`}</pre>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O sistema já reconhece os campos <code>callerNumber</code>, <code>caller_number</code>, <code>from</code> e <code>phoneNumber</code>.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  URL do webhook para celular (app Android)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  O app Android envia chamadas para este mesmo endpoint. A URL já está codificada no app durante o build.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted rounded-md px-3 py-2 font-mono text-xs break-all">
                    {WEBHOOK_URL}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(WEBHOOK_URL)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TEST TAB */}
          <TabsContent value="test" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Testar Identificação de Chamada
                </CardTitle>
                <CardDescription>
                  Simule uma chamada recebida para verificar se o sistema está funcionando corretamente.
                  A chamada aparecerá no popup de Caller ID e na Central de Atendimento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Número de telefone para simular</label>
                  <input
                    type="tel"
                    placeholder="Ex: 11999998888"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={testing}
                    onClick={() => testWebhook("celular")}
                  >
                    <PhoneCall className="h-4 w-4" />
                    Simular Celular
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={testing}
                    onClick={() => testWebhook("whatsapp")}
                  >
                    <MessageSquare className="h-4 w-4 text-green-600" />
                    Simular WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={testing}
                    onClick={() => testWebhook("voip")}
                  >
                    <Wifi className="h-4 w-4 text-blue-600" />
                    Simular VoIP
                  </Button>
                </div>

                <div className="bg-muted rounded-md p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    O que acontece após o teste:
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                    <li>Um popup de Caller ID aparece no canto inferior direito da tela</li>
                    <li>A chamada é registrada na Central de Atendimento</li>
                    <li>Se o número estiver cadastrado, o nome do cliente aparece automaticamente</li>
                    <li>Você pode clicar em "Nova Venda" diretamente do popup</li>
                  </ul>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Resultado esperado</p>
                  <div className="flex items-start gap-3 p-3 rounded-md border">
                    <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      O popup de Caller ID aparece no canto inferior direito. Verifique também a página{" "}
                      <strong>Central de Atendimento</strong> para confirmar que a chamada foi registrada.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
