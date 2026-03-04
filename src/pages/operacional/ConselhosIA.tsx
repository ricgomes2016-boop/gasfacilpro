import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Target,
  Users,
  Package,
  DollarSign,
} from "lucide-react";

const conselhos = [
  {
    id: 1,
    tipo: "alerta",
    titulo: "Estoque Baixo de P13",
    descricao:
      "O estoque de botijões P13 está em 15 unidades. Baseado na média de vendas, isso durará apenas 2 dias.",
    acao: "Fazer pedido de reposição",
    prioridade: "alta",
  },
  {
    id: 2,
    tipo: "oportunidade",
    titulo: "Cliente Inativo há 30 dias",
    descricao:
      "O cliente João Silva costumava comprar semanalmente e está há 30 dias sem pedidos.",
    acao: "Entrar em contato",
    prioridade: "media",
  },
  {
    id: 3,
    tipo: "insight",
    titulo: "Pico de Vendas às 18h",
    descricao:
      "Identificamos que 40% das suas vendas acontecem entre 17h e 19h. Considere ter mais entregadores nesse horário.",
    acao: "Ajustar escala",
    prioridade: "baixa",
  },
  {
    id: 4,
    tipo: "meta",
    titulo: "Meta Mensal em Risco",
    descricao:
      "Você está 15% abaixo da meta de vendas deste mês. Faltam 8 dias para o fechamento.",
    acao: "Ver estratégias",
    prioridade: "alta",
  },
];

const iconConfig = {
  alerta: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  oportunidade: { icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
  insight: { icon: Lightbulb, color: "text-purple-500", bg: "bg-purple-500/10" },
  meta: { icon: Target, color: "text-red-500", bg: "bg-red-500/10" },
};

export default function ConselhosIA() {
  return (
    <MainLayout>
      <Header title="Conselhos IA" subtitle="Insights baseados em inteligência artificial" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Button>
            <Sparkles className="h-4 w-4 mr-2" />
            Atualizar Análise
          </Button>
        </div>

        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{conselhos.length}</p>
                  <p className="text-sm text-muted-foreground">Insights Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">2</p>
                  <p className="text-sm text-muted-foreground">Alta Prioridade</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">+12%</p>
                  <p className="text-sm text-muted-foreground">Eficiência IA</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <DollarSign className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">R$ 2.5k</p>
                  <p className="text-sm text-muted-foreground">Economia Sugerida</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conselhos */}
        <div className="grid gap-4 lg:grid-cols-2">
          {conselhos.map((conselho) => {
            const config = iconConfig[conselho.tipo as keyof typeof iconConfig];
            const Icon = config.icon;
            return (
              <Card key={conselho.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{conselho.titulo}</CardTitle>
                        <Badge
                          variant={
                            conselho.prioridade === "alta"
                              ? "destructive"
                              : conselho.prioridade === "media"
                              ? "default"
                              : "secondary"
                          }
                          className="mt-1"
                        >
                          {conselho.prioridade === "alta"
                            ? "Alta Prioridade"
                            : conselho.prioridade === "media"
                            ? "Média Prioridade"
                            : "Baixa Prioridade"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{conselho.descricao}</p>
                  <Button variant="outline" size="sm">
                    {conselho.acao}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
