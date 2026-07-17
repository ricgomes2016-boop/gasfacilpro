import { ClienteLayout } from "@/components/cliente/ClienteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCliente } from "@/contexts/ClienteContext";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Gift,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Coins
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ClienteCarteira() {
  const { walletBalance, walletTransactions, referralCount } = useCliente();

  const totalEarned = walletTransactions
    .filter(t => t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalUsed = walletTransactions
    .filter(t => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <ClienteLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Minha Carteira</h1>

        {/* Balance Card */}
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-full">
                <Wallet className="h-6 w-6" />
              </div>
              <p className="text-primary-foreground/80">Saldo disponível</p>
            </div>
            <p className="text-4xl font-bold">
              R$ {walletBalance.toFixed(2)}
            </p>
            <p className="text-sm text-primary-foreground/70 mt-2">
              Use para abater em suas compras
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-success" />
                <span className="text-sm text-muted-foreground">Total ganho</span>
              </div>
              <p className="text-xl font-bold text-success">
                R$ {totalEarned.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-warning" />
                <span className="text-sm text-muted-foreground">Total usado</span>
              </div>
              <p className="text-xl font-bold text-warning">
                R$ {totalUsed.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Referral Summary */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Indicações</p>
                  <p className="text-sm text-muted-foreground">
                    {referralCount} amigo{referralCount !== 1 ? 's' : ''} indicado{referralCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Coins className="h-3 w-3" />
                R$ 10/indicação
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico de Transações</CardTitle>
          </CardHeader>
          <CardContent>
            {walletTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma transação ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {walletTransactions.map((transaction, index) => (
                  <div key={transaction.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        transaction.type === "credit" 
                          ? "bg-success/10 text-success" 
                          : "bg-warning/10 text-warning"
                      }`}>
                        {transaction.type === "credit" ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{transaction.description}</p>
                          <p className={`font-semibold ${
                            transaction.type === "credit" ? "text-success" : "text-warning"
                          }`}>
                            {transaction.type === "credit" ? "+" : "-"}R$ {transaction.amount.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>
                            {format(transaction.date, "dd MMM yyyy", { locale: ptBR })}
                          </span>
                          {transaction.referralName && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Gift className="h-3 w-3" />
                                {transaction.referralName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <ShoppingCart className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Como usar seu saldo?</p>
                <p className="text-muted-foreground">
                  Na hora de finalizar sua compra, você pode escolher usar o saldo 
                  da carteira para abater do valor total. Simples assim!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClienteLayout>
  );
}
