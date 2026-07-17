import { useEffect, useState } from "react";
import { VendedorLayout } from "@/components/vendedor/VendedorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { PlusCircle, History, Users, Target, Megaphone, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function VendedorDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ hoje: 0, mes: 0, valorMes: 0 });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const hojeStr = new Date();
      hojeStr.setHours(0, 0, 0, 0);

      const { data } = await (supabase as any)
        .from("pedidos")
        .select("id, valor_total, created_at")
        .eq("vendedor_id", user.id)
        .gte("created_at", inicioMes.toISOString());

      const lista = (data || []) as any[];
      const valorMes = lista.reduce((s, p) => s + Number(p.valor_total || 0), 0);
      const hoje = lista.filter((p) => new Date(p.created_at) >= hojeStr).length;
      setStats({ hoje, mes: lista.length, valorMes });
    })();
  }, [user?.id]);

  const atalhos = [
    { path: "/vendedor/nova-venda", icon: PlusCircle, label: "Nova Venda", color: "bg-success" },
    { path: "/vendedor/historico", icon: History, label: "Histórico", color: "bg-info" },
    { path: "/vendedor/clientes", icon: Users, label: "Clientes", color: "bg-primary" },
    { path: "/vendedor/metas", icon: Target, label: "Metas", color: "bg-warning" },
    { path: "/vendedor/avisos", icon: Megaphone, label: "Avisos", color: "bg-primary" },
    { path: "/vendedor/bolao", icon: Trophy, label: "Bolão", color: "bg-warning" },
  ];

  return (
    <VendedorLayout title={`Olá, ${profile?.full_name?.split(" ")[0] || "Vendedor"}`}>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="text-2xl font-bold">{stats.hoje}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Mês</p>
              <p className="text-2xl font-bold">{stats.mes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">R$ mês</p>
              <p className="text-lg font-bold">
                {stats.valorMes.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Acessos rápidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {atalhos.map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.path}
                    to={a.path}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-accent transition"
                  >
                    <div className={`${a.color} text-white rounded-full p-3`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium text-center">{a.label}</span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Button asChild size="lg" className="w-full h-14">
          <Link to="/vendedor/nova-venda">
            <PlusCircle className="h-5 w-5 mr-2" /> Registrar nova venda
          </Link>
        </Button>
      </div>
    </VendedorLayout>
  );
}
