import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackPath?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log erro para monitoramento
    console.error("ErrorBoundary caught:", error, errorInfo);
    
    // Atualizar estado com informações completas
    this.setState({ error, errorInfo });
    
    // TODO: Integrar com Sentry quando disponível
    // Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  getHomeByPath = () => {
    const path = window.location.pathname;
    if (path.startsWith("/cliente")) return "/cliente";
    if (path.startsWith("/entregador")) return "/entregador";
    if (path.startsWith("/parceiro")) return "/parceiro";
    return "/";
  };

  handleGoBack = () => {
    this.setState({ hasError: false, error: null });
    window.history.back();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = this.getHomeByPath();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-4 max-w-md">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Algo deu errado</h1>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente novamente.
            </p>
            
            {/* Debug info em desenvolvimento */}
            {import.meta.env.DEV && this.state.error && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-left">
                <p className="text-xs font-mono text-red-700 break-words">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2 text-xs text-red-600">
                    <summary className="cursor-pointer font-semibold">Stack trace</summary>
                    <pre className="mt-2 overflow-auto bg-red-100 p-2 rounded text-xs">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}
            
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={this.handleGoBack}>
                Voltar
              </Button>
              <Button variant="outline" onClick={this.handleGoHome}>
                Início
              </Button>
              <Button onClick={this.handleReset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
