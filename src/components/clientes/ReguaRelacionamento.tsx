import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bell, MessageSquare, Clock, Flame } from "lucide-react";
import { toast } from "sonner";

interface ClienteLembrete {
  id: string;
  nome: string;
  telefone: string | null;
  bairro: string | null;
  diasDesdeUltimoPedido: number;
  ultimoPedido: string;
  tipo: "lembrete" | "reengajamento" | "urgente";
}

export function ReguaRelacionamento() {
  const [clientes, setClientes] = useState<ClienteLembrete[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: clientesAtivos } = await supabase
        .from("clientes")
        .select("id, nome, telefone, bairro")
        .eq("ativo", true)
        .not("telefone", "is", null)
        .limit(500);

      if (!clientesAtivos || clientesAtivos.length === 0) {
        setClientes([]);
        return;
      }

      const ids = clientesAtivos.map(c => c.id);
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("cliente_id, created_at")
        .in("cliente_id", ids)
        .order("created_at", { ascending: false });

      const ultimoPedidoMap = new Map<string, string>();
      pedidos?.forEach(p => {
        if (p.cliente_id && !ultimoPedidoMap.has(p.cliente_id)) {
          ultimoPedidoMap.set(p.cliente_id, p.created_at);
        }
      });

      const now = new Date();
      const result: ClienteLembrete[] = [];

      clientesAtivos.forEach(c => {
        const ultimo = ultimoPedidoMap.get(c.id);
        if (!ultimo) return; // skip clients without orders

        const dias = Math.floor((now.getTime() - new Date(ultimo).getTime()) / (1000 * 60 * 60 * 24));

        // Gas cylinder typically lasts 30-45 days
        let tipo: ClienteLembrete["tipo"];
        if (dias >= 60) {
          tipo = "urgente";
        } else if (dias >= 40) {
          tipo = "reengajamento";
        } else if (dias >= 25) {
          tipo = "lembrete";
        } else {
          return; // too recent, no action needed
        }

        result.push({
          id: c.id,
          nome: c.nome,
          telefone: c.telefone,
          bairro: c.bairro,
          diasDesdeUltimoPedido: dias,
          ultimoPedido: ultimo,
          tipo,
        });
      });

      result.sort((a, b) => b.diasDesdeUltimoPedido - a.diasDesdeUltimoPedido);
      setClientes(result);
    } catch (e) {
      console.error("Erro na régua de relacionamento:", e);
    } finally {
      setLoading(false);
    }
  };

  const enviarWhatsApp = (telefone: string, nome: string, tipo: ClienteLembrete["tipo"]) => {
    const mensagens: Record<string, string> = {
      lembrete: `Olá ${nome}! 😊 Tudo bem? Estamos passando para lembrar que seu gás pode estar acabando. Precisa de uma nova entrega? Responda SIM para fazer seu pedido!`,
      reengajamento: `Olá ${nome}! Sentimos sua falta! 🔥 Faz um tempo desde sua última compra de gás. Que tal garantir o seu antes que acabe? Temos entrega rápida na sua região!`,
      urgente: `${nome}, faz mais de 60 dias desde seu último pedido de gás! ⚠️ Não fique sem gás em casa. Peça agora e receba ainda hoje! Responda para fazer seu pedido.`,
    };

    const tel = telefone.replace(/\D/g, "");
    const msg = encodeURIComponent(mensagens[tipo]);
    window.open(`https://wa.me/55${tel}?text=${msg}`, "_blank");
    toast.success(`Mensagem aberta para ${nome}`);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const lembretes = clientes.filter(c => c.tipo === "lembrete");
  const reengajamento = clientes.filter(c => c.tipo === "reengajamento");
  const urgentes = clientes.filter(c => c.tipo === "urgente");

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-info/10">
                <Bell className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{lembretes.length}</p>
                <p className="text-sm text-muted-foreground">Lembrete (25-39 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reengajamento.length}</p>
                <p className="text-sm text-muted-foreground">Reengajamento (40-59 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-destructive/10">
                <Flame className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{urgentes.length}</p>
                <p className="text-sm text-muted-foreground">Urgente (60+ dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {clientes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            🎉 Todos os clientes estão em dia! Nenhum lembrete pendente.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5" />
              Clientes para contato ({clientes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Último pedido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.slice(0, 20).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{c.telefone || "-"}</TableCell>
                    <TableCell>{c.bairro || "-"}</TableCell>
                    <TableCell>
                      {new Date(c.ultimoPedido).toLocaleDateString("pt-BR")}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({c.diasDesdeUltimoPedido}d)
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={c.tipo === "urgente" ? "destructive" : "outline"}
                        className={
                          c.tipo === "lembrete" ? "border-info text-info" :
                          c.tipo === "reengajamento" ? "border-warning text-warning" : ""
                        }
                      >
                        {c.tipo === "lembrete" ? "Lembrete" : c.tipo === "reengajamento" ? "Reengajar" : "Urgente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.telefone && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => enviarWhatsApp(c.telefone!, c.nome, c.tipo)}
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1" />
                          WhatsApp
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {clientes.length > 20 && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Mostrando 20 de {clientes.length} clientes
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
