import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bell, MessageSquare, Mail, Smartphone, Truck, ShoppingCart, AlertTriangle, Package, Clock, Users } from "lucide-react";

interface NotificacaoConfig {
  id: string;
  label: string;
  descricao: string;
  icon: React.ElementType;
  canais: {
    push: boolean;
    whatsapp: boolean;
    email: boolean;
  };
}

const gatilhosIniciais: NotificacaoConfig[] = [
  {
    id: "novo_pedido",
    label: "Novo Pedido",
    descricao: "Quando um novo pedido é registrado no sistema",
    icon: ShoppingCart,
    canais: { push: true, whatsapp: false, email: false },
  },
  {
    id: "pedido_saiu",
    label: "Pedido Saiu para Entrega",
    descricao: "Quando o entregador inicia a rota com o pedido",
    icon: Truck,
    canais: { push: true, whatsapp: true, email: false },
  },
  {
    id: "pedido_entregue",
    label: "Pedido Entregue",
    descricao: "Confirmação de que o pedido foi entregue ao cliente",
    icon: Package,
    canais: { push: true, whatsapp: true, email: false },
  },
  {
    id: "estoque_baixo",
    label: "Estoque Baixo",
    descricao: "Quando um produto atinge o estoque mínimo configurado",
    icon: AlertTriangle,
    canais: { push: true, whatsapp: false, email: true },
  },
  {
    id: "jornada_excedida",
    label: "Jornada Excedida",
    descricao: "Alerta quando entregador ultrapassa limite de horas",
    icon: Clock,
    canais: { push: true, whatsapp: false, email: false },
  },
  {
    id: "novo_cliente",
    label: "Novo Cliente Cadastrado",
    descricao: "Quando um novo cliente se cadastra via app",
    icon: Users,
    canais: { push: false, whatsapp: false, email: true },
  },
];

export default function Notificacoes() {
  const [gatilhos, setGatilhos] = useState(gatilhosIniciais);

  const toggleCanal = (gatilhoId: string, canal: "push" | "whatsapp" | "email") => {
    setGatilhos((prev) =>
      prev.map((g) =>
        g.id === gatilhoId
          ? { ...g, canais: { ...g.canais, [canal]: !g.canais[canal] } }
          : g
      )
    );
  };

  const canaisAtivos = gatilhos.reduce(
    (acc, g) => {
      if (g.canais.push) acc.push++;
      if (g.canais.whatsapp) acc.whatsapp++;
      if (g.canais.email) acc.email++;
      return acc;
    },
    { push: 0, whatsapp: 0, email: 0 }
  );

  return (
    <MainLayout>
      <Header title="Notificações e Alertas" subtitle="Configure os gatilhos automáticos do sistema" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Resumo dos canais */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{canaisAtivos.push}</p>
                  <p className="text-sm text-muted-foreground">Push Ativo</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{canaisAtivos.whatsapp}</p>
                  <p className="text-sm text-muted-foreground">WhatsApp Ativo</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{canaisAtivos.email}</p>
                  <p className="text-sm text-muted-foreground">E-mail Ativo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de gatilhos */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Gatilhos Automáticos</CardTitle>
            </div>
            <CardDescription>
              Defina quais eventos disparam notificações e por qual canal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {gatilhos.map((gatilho, index) => {
              const Icon = gatilho.icon;
              return (
                <div key={gatilho.id}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{gatilho.label}</p>
                        <p className="text-sm text-muted-foreground">{gatilho.descricao}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 sm:gap-8 pl-11 sm:pl-0">
                      <div className="flex flex-col items-center gap-1">
                        <Switch
                          checked={gatilho.canais.push}
                          onCheckedChange={() => toggleCanal(gatilho.id, "push")}
                        />
                        <span className="text-[10px] text-muted-foreground">Push</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Switch
                          checked={gatilho.canais.whatsapp}
                          onCheckedChange={() => toggleCanal(gatilho.id, "whatsapp")}
                        />
                        <span className="text-[10px] text-muted-foreground">WhatsApp</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Switch
                          checked={gatilho.canais.email}
                          onCheckedChange={() => toggleCanal(gatilho.id, "email")}
                        />
                        <span className="text-[10px] text-muted-foreground">E-mail</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Como funciona?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  As notificações <strong>Push</strong> são enviadas diretamente no navegador. 
                  O canal <strong>WhatsApp</strong> utiliza links diretos para o número do cliente. 
                  O <strong>E-mail</strong> será enviado para o endereço cadastrado no perfil do destinatário.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
