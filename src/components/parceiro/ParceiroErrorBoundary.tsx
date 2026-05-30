import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * ErrorBoundary específico do Portal do Parceiro.
 * Garante que o parceiro nunca fica preso numa tela branca:
 * - Mostra fallback amigável
 * - Tenta auto-recuperar 1x
 * - Sempre oferece: Tentar novamente, Início (/parceiro) e Sair
 */
export class ParceiroErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, retryCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ParceiroErrorBoundary]", error, info);
    // Auto-retry uma única vez para erros transitórios (chunks, contextos)
    if (this.state.retryCount === 0) {
      setTimeout(() => {
        this.setState((s) => ({ hasError: false, error: null, retryCount: s.retryCount + 1 }));
      }, 400);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleHome = () => {
    window.location.replace("/parceiro");
  };

  handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    window.location.replace("/auth");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Tivemos um problema</h1>
          <p className="text-sm text-muted-foreground">
            Não conseguimos carregar essa tela do Portal do Parceiro. Você pode tentar de novo ou voltar para o início — suas vendas não são perdidas.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button onClick={this.handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
            <Button variant="outline" onClick={this.handleHome} className="gap-2">
              <Home className="h-4 w-4" /> Início
            </Button>
            <Button variant="ghost" onClick={this.handleLogout} className="gap-2 text-muted-foreground">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
